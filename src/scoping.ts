import { Documentation } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { Type } from './typing';

type VarInfo = { type: Type, doc?: Documentation/*, range: Range*/ };

class Scope {

  private static _lastId = 0;
  protected _id = ++Scope._lastId;

  public variables: Record<string, VarInfo>;
  private range = Range.emptyRange();

  private constructor(public parent?: Scope) {
    this.variables = Object.create(parent?.variables ?? null);
  }

  public open(start: Location) { this.range.start = start; }
  public close(end: Location) { this.range.end = end; }

  public static makeFrom(parent: Scope) {
    return new Scope(parent);
  }

  public static makeGlobal() {
    const r = new Scope();
    r.open(Location.beginning());
    r.close(Location.ending());
    return r;
  }

}

export class Scoping {

  private global = Scope.makeGlobal();
  private local = this.global;

  private scopes = [this.global];

  private contexts: Record<string, any[]> = {};

  public fork(location: Location) {
    this.local = Scope.makeFrom(this.local);
    this.local.open(location);

    this.scopes.push(this.local);
  }

  public join(location: Location) {
    this.local.close(location);
    this.local = this.local.parent!;
  }

  public pushContext(tag: string, what: any) {
    if (!this.contexts[tag]) this.contexts[tag] = [];
    this.contexts[tag].push(what);
  }

  public findContext(tag: string): any {
    const it = this.contexts[tag];
    return it[it.length-1];
  }

  public popContext(tag: string) {
    this.contexts[tag].pop();
  }

  // public setGlobal(name: string, type: Type) {
  //   this.global.variables[name] = { type };
  // }

  // public getGlobal(name: string) {
  //   return this.global.variables[name];
  // }

  public set(name: string, type: Type) {
    log.info(`[local scope]: setting "${name}: ${type}"`);
    this.local.variables[name] = { type };
  }

  public get(name: string) {
    log.info(`[local scope]: getting "${name}"`);
    return this.local.variables[name]?.type ?? Type.noType();
  }

  public getGlobals() {
    const r: Record<string, VarInfo> = {};

    for (const key in this.global.variables)
      if (!r[key]) r[key] = this.global.variables[key];

    return r;
  }

  public getLocals() {
    const r: Record<string, VarInfo> = {};

    for (const key in this.local.variables)
      if (!r[key]) r[key] = this.local.variables[key];

    return r;
  }

}
