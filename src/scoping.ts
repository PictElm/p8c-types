import assert from 'assert';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Metadata } from './documenting';
import { Location, Range } from './locating';
import { Type, TypeFunction, TypeSome, TypeTable, TypeUnion } from './typing';

/** describes a variable within a scope */
export type VarInfo = { type: Type, doc?: Metadata }; // (move to ./typing/base.ts?)

/**
 * `variable` uses Object.create and prototype inheritance to
 * have variables of enclosing scopes visible and updatable from
 * children scopes
 */
export class Scope {

  private static _lastId = 0;
  protected readonly _id = ++Scope._lastId;

  private readonly variables: Record<string, VarInfo>;
  private range = Range.emptyRange();

  private constructor(public parent: Scope|undefined, private strategy: ScopeStrategy) {
    this.variables = Object.create(parent?.variables ?? null);
  }

  public set(name: string, info: VarInfo) {
    this.variables[name] = info;
  }

  public get(name: string): VarInfo {
    return this.variables[name] ?? { type: Type.make(TypeSome, this.parent, name) };
  }

  public getLocal(name: string): VarInfo {
    return Object.prototype.hasOwnProperty.call(this.variables, name)
      ? this.variables[name]
      : { type: Type.make(TypeSome, this.parent, name) };
  }

  public has(name: string): boolean {
    return !!this.variables[name];
  }

  public hasLocal(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.variables, name);
  }

  public all() {
    const r: [string, VarInfo][] = [];

    for (const key in this.variables)
      r.push([key, this.variables[key]]);

    return r;
  }

  public open(start: Location) { this.range = new Range(start, this.range.end); }
  public close(end: Location) { this.range = new Range(this.range.start, end); }

  /* istanbul ignore next */
  public toString() { return `Scope@_id${this._id}`; }

  /**
   * creates a new scope that inherits the variables of its parent
   * 
   * (this also simulates closures, for anywhen function side-effect are attempt of implemented in)
   */
  public static makeFrom(parent: Scope, strategy: ScopeStrategy) {
    return new Scope(parent, strategy);
  }

  /**
   * makes the global scope
   * 
   * @todo remark: the Chunk creates a new scope this 'global' scope is parent of...
   * this may lead to mistakes/discrepancies if ever trying to edit what is though
   * as being the Chunk's scope... maybe not
   */
  public static makeGlobal() {
    const r = new Scope(undefined, ScopeStrategy.INHERIT);
    r.open(Location.beginning());
    r.close(Location.ending());
    return r;
  }

}

export enum ScopeStrategy {
  INHERIT,
  UPVALUE,
}

/* ignore next? */
/** the various types of context */
namespace Context {
  // TODO:
  //  'FunctionCall' theFunction
  //  'FunctionCallArgument' index?
  //  'TableConstructor' theTable
  //  'TableConstructorKey' key, something
  //  'TableConstructorKeyString' key, something
  //  'TableConstructorKeyValue' autoIndex, something

  abstract class Base<Tag extends string> {
    protected constructor(public readonly tag: Tag) { }
  }

  /**
   * with this context type, a 'ReturnStatement' can update a function's
   * return type (same will be for eg. `yield` calls)
   */
  export class Function extends Base<'Function'> {
    public constructor(public readonly theFunction: TypeFunction) { super('Function'); }
  }

  /**
   * will probably be needed for the `self`? maybe not actually...
   */
  export class Table extends Base<'Table'> {
    public constructor(public readonly theTable: TypeTable) { super('Table'); }
  }

  export class Do extends Base<'Do'> {
    public constructor() { super('Do'); }
  }

  export class While extends Base<'While'> {
    public constructor() { super('While'); }
  }

}

type ContextKind = keyof typeof Context;
type ContextType<T extends ContextKind> = InstanceType<typeof Context[T]>;

/** for use with the 'locate' Scoping event */
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

  'locate': (range: Range, name: string, variable: VarInfo, reason: LocateReason) => void;

}

/**
 * @emits 'fork'|'join' for scope operations
 * @emits 'pushContext'|'popContext' for context operations
 * @emits 'locates' when a word is located within the document
 */
export class Scoping extends TypedEmitter<ScopingEvents> {

  private readonly global = Scope.makeGlobal();
  private local = this.global;

  private readonly scopes = [this.global];
  public get current() { return this.local; }

  private readonly contexts: { [T in ContextKind]?: ContextType<T>[] } = {};

  /** opens a new local scope inheriting from the current scope */
  public fork(location: Location, strategy: ScopeStrategy) {
    this.local = Scope.makeFrom(this.local, strategy);
    this.local.open(location);

    this.emit('fork', location, this.local);
    this.scopes.push(this.local);
  }

  /** closes the current local scope and reverts to its parent */
  public join(location: Location) {
    assert(this.local.parent, "Scoping.join: trying to one too many scope");
    this.emit('join', location, this.local);

    this.local.close(location);
    this.local = this.local.parent;
  }

  /** pushes to the relevant context stack */
  public pushContext<T extends ContextKind>(location: Location, tag: T, ...args: ConstructorParameters<typeof Context[T]>) {
    const ctor = Context[tag] as new (...args: ConstructorParameters<typeof Context[T]>) => ContextType<T>; // typing me failing -.-
    const context = new ctor(...args);
    if (!this.contexts[tag]) this.contexts[tag] = [];
    this.contexts[tag]!.push(context as any); // -.-

    this.emit('pushContext', location, context);
  }

  /** searches for the first enclosing context in the relevant context stack */
  public findContext<T extends ContextKind>(tag: T) {
    const it = this.contexts[tag];
    assert(it, `Scoping.findContext: no context were pushed with the tag '${tag}'`);
    assert(it.length, `Scoping.findContext: no context left with the tag '${tag}'`);
    return it[it.length-1] as ContextType<T>; // -.-
  }

  /** pops from the relevant context stack */
  public popContext<T extends ContextKind>(location: Location, tag: T) {
    const it = this.contexts[tag];
    assert(it, `Scoping.popContext: no context were pushed with the tag '${tag}'`);
    const r = it.pop();
    assert(r, `Scoping.popContext: no context left with the tag '${tag}'`);

    this.emit('popContext', location, r);
  }

  public locate(range: Range, name: string, variable: VarInfo, reason: LocateReason) {
    this.emit('locate', range, name, variable, reason);
  }

  // public setGlobal(name: string, type: Type) {
  //   this.global.variables[name] = { type };
  // }

  // public getGlobal(name: string) {
  //   return this.global.variables[name];
  // }

  public set(name: string, variable: VarInfo) {
    //log.info(`[local scope]: setting "${name}: ${variable.type}"`);
    this.local.set(name, variable);
  }

  public get(name: string) {
    //log.info(`[local scope]: getting "${name}"`);
    return this.local.get(name);
  }

  /* istanbul ignore next */
  /**
   * get a record of every names (and their info) in the global scope
   * 
   * warning: the entries returned should probably be regarded as immutable
   */
  public getGlobals() {
    return Object.fromEntries(this.global.all());
  }

  /* istanbul ignore next */
  /**
   * get a record of every names (and their info) in the current local scope
   * 
   * warning: the entries returned should probably be regarded as immutable
   */
  public getLocals() {
    return Object.fromEntries(this.local.all());
  }

}
