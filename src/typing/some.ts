import assert from 'assert';
import { MetaOpsType } from '../operating';
import { Scope, VarInfo } from '../scoping';
import { TypeFunction } from './function';
import { BaseType, Type } from './internal';
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
export abstract class TypeSomeOp<T extends unknown[] = unknown[]> {

  public args: T;
  private next?: TypeSomeOp;

  public constructor(...args: T) { this.args = args; }
  public then(op: TypeSomeOp) {
    if (this.next) this.next.then(op);
    else this.next = op;
  }

  public toString() { return this.constructor.name + (this.next ? ` then ${this.next}` : ""); }
  public toJSON(key: string) {
    return {
      [this.constructor.name]: this.args.map((it: any) => 'function' === typeof it.toJSON
        ? it.toJSON(this.constructor.name)
        : 'function' === typeof it.type?.toJSON
          ? it.type.toJSON(this.constructor.name)
          : 'object' != typeof it
            ? it
            : null),
    }
  };

  public represent(to: string): string { assert(false, `TypeSomeOp.represent: operation "${this}" applied to "${to}" not implemented yet`); }
  /** chains, but no 'new' or 'resolved' */
  public apply(to: VarInfo): VarInfo { assert(false, `TypeSomeOp.resolve: operation "${this}" applied to "${to}" not implemented yet`); }

  protected nextRepresent(to: string) { return this.next?.represent(to) ?? to; }
  protected nextResolve(to: VarInfo) { return this.next?.apply(to) ?? to; }


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
            : `${to}[${key.type instanceof TypeFunction
                ? "function"
                : key.type instanceof TypeTable
                  ? "table"
                  : key.type}]`
      );
    }

    public override apply(to: VarInfo) {
      const [key] = this.args;
      let r: VarInfo;

      if ('string' === typeof key || 'number' === typeof key)
        r = to.type instanceof TypeTable
          ? to.type.getField(key.toString())
          : { type: Type.noType() };
      else
        r = to.type instanceof TypeTable
          ? to.type.getIndexer(key.type)[1]
          : { type: Type.noType() };

      return this.nextResolve(r);
    }

  }

  public static __newindex = class __newindex extends TypeSomeOp<[key: string | number | VarInfo, value: VarInfo]> {

    public override represent(to: string) {
      const [key, value] = this.args;

      return this.nextRepresent(
        'string' === typeof key
          ? `${to}(.${key}: ${value.type})` // XXX: again, assumes '.'
          : 'number' === typeof key
            ? `${to}([${key}]: ${value.type})`
            : `${to}([${key.type instanceof TypeFunction
                ? "function"
                : key.type instanceof TypeTable
                  ? "table"
                  : key.type}]: ${value.type})`
      );
    }

    public override apply(to: VarInfo) {
      const [key, value] = this.args;

      if ('string' === typeof key || 'number' === typeof key) {
        if (to.type instanceof TypeTable)
          to.type.setField(key.toString(), value);
      } else {
        if (to.type instanceof TypeTable)
          to.type.setIndexer(key.type, value);
      }

      return this.nextResolve(to);
    }

  }

  public static __call = class __call extends TypeSomeOp<[parameters: VarInfo[]]> {

    public override represent(to: string) {
      const [parameters] = this.args;
      return this.nextRepresent(`${to}(${parameters.map(it => it.type).join(", ")})`);
    }

    public override apply(to: VarInfo) {
      const [parameters] = this.args;
      return this.nextResolve(
        to.type instanceof TypeFunction
          ? to.type.getReturns(parameters)
          : { type: Type.noType() }
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

  public acts?: VarInfo;
  private done?: TypeSomeOp;

  public constructor(
    protected scope: Scope,
    private from: string,
  ) { super(); }

  /** in-place applied (the type is modified) */
  public setApplied(operation: TypeSomeOp) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  /** not in-place applied (a new type is created) */
  public getApplied(operation: TypeSomeOp) {
    //const repr = this.from && operation.represent(this.from);
    const r = { type: Type.make(TypeSome, this.scope, this.from) };

    // "acts as `this` with `operation` `done` on it"
    r.type.acts = { type: this };
    r.type.done = operation;

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
    const to = this.acts?.type.toString()
      ?? this.scope.has(this.from)
        ? this.scope.get(this.from).type.toString()
        : `<${this.from ?? "?"}>`;
    return this.done?.represent(to) ?? to;
  }

  public override toJSON() {
    return {
      type: this.constructor.name,
      acts: this.acts?.type.toJSON('acts'),
      from: this.from
        ? `${this.scope}::${this.from}`
        : null,
      done: this.done?.toJSON('done') ?? null,
    };
  }

  public override resolved(): VarInfo {
    const to = this.acts?.type.resolved()
      ?? this.scope.get(this.from);
    const r = this.done?.apply(to) ?? to;
    return r;
  }

  public override metaOps: Partial<MetaOpsType> = {
    __index(self, key) {
      assert(self.type instanceof TypeSome, "not a TypeSome, but a " + self.type.constructor.name);
      return self.type.getApplied(new TypeSomeOp.__index(key));
    },
    __newindex(self, key, value) {
      assert(self.type instanceof TypeSome, "not a TypeSome, but a " + self.type.constructor.name);
      self.type.setApplied(new TypeSomeOp.__newindex(key, value));
    },
    __call(self, parameters) {
      assert(self.type instanceof TypeSome, "not a TypeSome, but a " + self.type.constructor.name);
      return self.type.getApplied(new TypeSomeOp.__call(parameters));
    },
  };

}
