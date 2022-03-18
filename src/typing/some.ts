import assert from 'assert';
import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { TypeFunction } from './function';
import { BaseType, Resolved, Type } from './internal';
import { TypeTable } from './table';

/**
 * @notice moved from operating.ts, in the middle of being refactored
 * 
 * represents an operation performed on an unknown type
 * 
 * for now, the operations this models are the metamethodes
 * 
 * @todo TODO: same as Handling.handlers, would like it refactored
 * so it can easily be augmented/adapted for new kinds of usages
 */
abstract class TypeSomeOp<T extends unknown[] = unknown[]> {

  protected args: T;
  private next?: TypeSomeOp;

  public constructor(...args: T) { this.args = args; }
  public then(op: TypeSomeOp) { this.next = op; }

  public toString() { return this.constructor.name + (this.next ? ` then ${this.next}` : ""); }

  public represent(to: string): string { assert(false, `TypeSomeOp.represent: operation "${this}" applied to "${to}"`); }
  public resolve(to: Resolved): Resolved { assert(false, `TypeSomeOp.resolve: operation "${this}" applied to "${to}"`); }

  protected nextRepresent(to: string) { return this.next?.represent(to) ?? to; }
  protected nextResolve(to: Resolved) { return this.next?.resolve(to) ?? to; }

  public static __add = class __add extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __sub = class __sub extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __mul = class __mul extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __div = class __div extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __mod = class __mod extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __pow = class __pow extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __concat = class __concat extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __unm = class __unm extends TypeSomeOp<[]> {
  }

  public static __len = class __len extends TypeSomeOp<[]> {
  }

  public static __eq = class __eq extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __lt = class __lt extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __le = class __le extends TypeSomeOp<[left: VarInfo, right: VarInfo]> {
  }

  public static __index = class __index extends TypeSomeOp<[key: string | number | VarInfo]> {

    public override represent(to: string) {
      const [key] = this.args;

      return this.nextRepresent(
        'string' === typeof key
          ? `${to}.${key}` // XXX: again, assumes '.'
          : 'number' === typeof key
            ? `${to}[${key}]`
            : `${to}[${key.type.itself instanceof TypeFunction
                ? "function"
                : key.type.itself instanceof TypeTable
                  ? "table"
                  : key.type.itself}]`
      );
    }

    public override resolve(to: Resolved) {
      const [key] = this.args;
      let r: Resolved;

      if ('string' === typeof key || 'number' === typeof key)
        r = to.itself instanceof TypeTable
          ? to.itself.getField(key.toString()).type.itself.resolved()
          : Type.noType().itself.resolved();
      else
        r = to.itself instanceof TypeTable
          ? to.itself.getIndexer(key.type)[1].type.itself.resolved()
          : Type.noType().itself.resolved();

      return this.nextResolve(r);
    }

  }

  public static __newindex = class __newindex extends TypeSomeOp<[key: string | number | VarInfo, value: VarInfo]> {

    public override represent(to: string) {
      const [key, value] = this.args;

      return this.nextRepresent(
        'string' === typeof key
          ? `${to}(.${key}: ${value.type.itself})` // XXX: again, assumes '.'
          : 'number' === typeof key
            ? `${to}([${key}]: ${value.type.itself})`
            : `${to}([${key.type.itself instanceof TypeFunction
                ? "function"
                : key.type.itself instanceof TypeTable
                  ? "table"
                  : key.type.itself}]: ${value.type.itself})`
      );
    }

    public override resolve(to: Resolved) {
      const [key, value] = this.args;

      if ('string' === typeof key || 'number' === typeof key) {
        if (to.itself instanceof TypeTable)
          to.itself.setField(key.toString(), value);
      } else {
        if (to.itself instanceof TypeTable)
          to.itself.setIndexer(key.type, value);
      }

      return this.nextResolve(to);
    }

  }

  public static __call = class __call extends TypeSomeOp<[parameters: VarInfo[]]> {

    public override represent(to: string) {
      const [parameters] = this.args;
      return this.nextRepresent(`${to}(${parameters.join(", ")})`);
    }

    public override resolve(to: Resolved) {
      const [parameters] = this.args;
      return this.nextResolve(
        to.itself instanceof TypeFunction
          ? to.itself.getReturns(parameters).type.itself.resolved()
          : Type.noType().itself.resolved()
      );
    }

  }

  // XXX: see todo above class, this may be moved outside, to be implemented as a specific usage
  public static __metatable = class __metatable extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __ipairs = class __ipairs extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __pairs = class __pairs extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __tostring = class __tostring extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet

}

/**
 * represents a yet-unknown type, especially a function's parameters,
 * to which one (or more) operations are performed
 * 
 * using the `actsAs` method enables resolving to what it would be if
 * the type `acts` as was applied the operations `done` to `this`
 */
 export class TypeSome extends BaseType {

  private acts?: VarInfo;
  private done?: TypeSomeOp;

  public constructor(outself: Type,
    private from?: string
  ) { super(outself); }

  /** in-place applied (the type is modified) */
  public setApplied(operation: TypeSomeOp) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  /** not in-place applied (a new type is created) */
  public getApplied(operation: TypeSomeOp) {
    //const repr = this.from && operation.represent(this.from);
    const r = { type: Type.make(TypeSome) };
    const someType = r.type.as(TypeSome)!;

    // "acts as `this` with `operation` `done` on it"
    someType.acts = { type: this.outself }; // XXX: doc gap
    someType.done = operation;

    return r;
  }

  public actsAs(type: VarInfo) {
    assert(!this.acts, "TypeSome.as: already acts as " + this.acts);
    this.acts = type;
  }
  public revert() {
    assert(this.acts, "TypeSome.revert: not acting as anything");
    this.acts = undefined;
  }

  public override toString(): string {
    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this === this.acts.type.itself
        ? `<${this.from ?? "?"}>`
        : `${this.acts.type.itself}`;

    const what = this.done;
    const to = this === this.acts.type.itself
      ? `<${this.from ?? "?"}>`
      : `${this.acts.type.itself}`;

    return what.represent(to);
  }

  public override toJSON() {
    return {
      acts: this.acts?.type.toJSON('acts'),
      from: this.from ?? null,
      done: this.done?.constructor.name ?? null,
    };
  }

  public override resolved(): Resolved {
    if (!this.acts) return Type.noType().itself.resolved();
    if (!this.done) return this === this.acts.type.itself
        ? BaseType.mark(this.outself)
        : this.acts.type.itself.resolved();

    const what = this.done;
    const to = this === this.acts.type.itself
      ? BaseType.mark(this.outself)
      : this.acts.type.itself.resolved();

    return what.resolve(to);
  }

  public override metaOps: Partial<MetaOpsType> = {
    __index(self, key) {
      const asSome = self.type.as(TypeSome)!;
      return asSome.getApplied(new TypeSomeOp.__index(key));
    },
    __newindex(self, key, value) {
      const asSome = self.type.as(TypeSome)!;
      return asSome.getApplied(new TypeSomeOp.__newindex(key, value));
    },
    __call(self, parameters) {
      const asSome = self.type.as(TypeSome)!;
      return asSome.getApplied(new TypeSomeOp.__call(parameters));
    }
  };

}
