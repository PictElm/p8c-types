import assert from 'assert';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Metadata } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { Type } from './typing';

type VarInfo = { type: Type, doc?: Metadata/*, range: Range*/ }; // YYY?

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

namespace Context {

  abstract class Base<Tag extends string> {
    protected constructor(public readonly tag: Tag) { }
  }

  export class Function extends Base<'Function'> {
    // Type and not TypeFunction because it can be mutated into a TypeThread
    public constructor(public readonly theFunction: Type) { super('Function'); }
  }
  export class Table extends Base<'Table'> {
    public constructor(public readonly theTable: Type) { super('Table'); }
  }

}

type ContextKind = keyof typeof Context;
type ContextType<T extends ContextKind> = InstanceType<typeof Context[T]>;

export enum LocateReason {
  Text = 1,
  Read = 2,
  Write = 3
}

interface ScopingEvents {
  'fork': (location: Location, openingScope: Scope) => void;
  'join': (location: Location, closingScope: Scope) => void;
  'pushContext': <T extends ContextKind>(location: Location, context: ContextType<T>) => void;
  'popContext': <T extends ContextKind>(location: Location, context: ContextType<T>) => void;
  'locate': (range: Range, name: string, type: Type, reason: LocateReason) => void;
}

export class Scoping extends TypedEmitter<ScopingEvents> {

  private readonly global = Scope.makeGlobal();
  private local = this.global;

  private readonly scopes = [this.global];

  private readonly contexts: { [T in ContextKind]?: ContextType<T>[] } = {};

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

  public pushContext<T extends ContextKind>(location: Location, tag: T, ...args: ConstructorParameters<typeof Context[T]>) {
    const context = new (Context[tag] as any)(...args) as ContextType<T>; // YYY: craps the bed otherwise
    if (!this.contexts[tag]) this.contexts[tag] = [];
    this.contexts[tag]!.push(context as any);

    this.emit('pushContext', location, context);
  }

  public findContext<T extends ContextKind>(tag: T) {
    const it = this.contexts[tag];
    assert(it, `Scoping.findContext: no context were pushed with the tag '${tag}'`);
    assert(it.length, `Scoping.findContext: no context left with the tag '${tag}'`);
    return it[it.length-1] as ContextType<T>; // YYY: craps the bed otherwise
  }

  public popContext<T extends ContextKind>(location: Location, tag: T) {
    const it = this.contexts[tag];
    assert(it, `Scoping.popContext: no context were pushed with the tag '${tag}'`);
    const r = it.pop();
    assert(r, `Scoping.popContext: no context left with the tag '${tag}'`);

    this.emit('popContext', location, r);
  }

  public locate(range: Range, name: string, type: Type, reason: LocateReason) {
    this.emit('locate', range, name, type, reason);
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
