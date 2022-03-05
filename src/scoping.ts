import { assert } from 'console';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Documentation } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { Type } from './typing';

type VarInfo = { type: Type, doc?: Documentation/*, range: Range*/ };

class Scope {

  private static _lastId = 0;
  protected readonly _id = ++Scope._lastId;

  public readonly variables: Record<string, VarInfo>;
  private range = Range.emptyRange();

  private constructor(public parent?: Scope) {
    this.variables = Object.create(parent?.variables ?? null);
  }

  public open(start: Location) { this.range = new Range(start, this.range.end); }
  public close(end: Location) { this.range = new Range(this.range.start, end); }

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

type BaseEvent = { location: Location; }

interface ScopingEvents {
  'fork': (location: Location, openingScope: Scope) => void;
  'join': (location: Location, closingScope: Scope) => void;
  'pushContext': (location: Location, tag: string, what: any) => void;
  'popContext': (location: Location, tag: string, what: any) => void;
  'locate': (range: Range, name: string, type: Type) => void;
}

export class Scoping extends TypedEmitter<ScopingEvents> {

  private readonly global = Scope.makeGlobal();
  private local = this.global;

  private readonly scopes = [this.global];

  private readonly contexts: Record<string, any[]> = {};

  public fork(location: Location) {
    this.local = Scope.makeFrom(this.local);
    this.local.open(location);

    this.emit('fork', location, this.local);
    this.scopes.push(this.local);
  }

  public join(location: Location) {
    this.emit('join', location, this.local);

    this.local.close(location);
    this.local = this.local.parent!;
  }

  public pushContext(location: Location, tag: string, what: any) {
    if (!this.contexts[tag]) this.contexts[tag] = [];
    this.contexts[tag].push(what);

    this.emit('pushContext', location, tag, what);
  }

  public findContext(tag: string): any {
    const it = this.contexts[tag];
    assert(it, `Scoping.findContext: no context were pushed with the tag '${tag}'`);
    assert(it.length, `Scoping.findContext: no context left with the tag '${tag}'`);
    return it[it.length-1];
  }

  public popContext(location: Location, tag: string) {
    const it = this.contexts[tag];
    assert(it, `Scoping.popContext: no context were pushed with the tag '${tag}'`);
    assert(it.length, `Scoping.popContext: no context left with the tag '${tag}'`);

    this.emit('popContext', location, tag, it.pop());
  }

  public locate(range: Range, name: string, type: Type) {
    this.emit('locate', range, name, type);
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
