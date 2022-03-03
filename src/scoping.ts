import { Location, Range } from './locating';
import { log } from './logging';
import { Type, TypeNil } from './typing';

type VarInfo = { type: Type/*, range: Range*/ };

class Scope {

  public variables: Record<string, VarInfo>;
  private range: Range;

  constructor(parent: Scope, start: Location) {
    this.variables = Object.create(parent.variables);
    this.range = new Range(start, null!);
  }

  public close(end: Location) {
    this.range.end = end;
  }

  public static makeGlobal() {
    const r = new Scope({ variables: {} } as any, Location.beginning());
    r.close(Location.ending());
    return r;
  }

}

export class Scoping {

  private global = Scope.makeGlobal();
  private local = this.global;
  private stack = [this.global];

  private contexts: Record<string, any[]> = {};

  public fork(location: Location) {
    this.stack.push(new Scope(this.local, location));
  }

  public join(location: Location) {
    this.stack.pop()?.close(location);
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
    return this.local.variables[name]?.type ?? new TypeNil();
  }

}
