import assert from 'assert';
import { Resolved, Type, TypeFunction, TypeTable } from './typing';

export abstract class TypeSomeOp<T extends any[] = unknown[]> {

  protected args: T;
  private next?: TypeSomeOp;

  public constructor(...args: T) { this.args = args; }
  public then(op: TypeSomeOp) { this.next = op; }

  public toString() { return this.constructor.name + (this.next ? ` then ${this.next}` : ""); }

  public represent(to: string): string { assert(false, `TypeSomeOp.represent: operation "${this}" applied to "${to}"`); }
  public resolve(to: Resolved): Resolved { assert(false, `TypeSomeOp.resolve: operation "${this}" applied to "${to}"`); }

  protected nextRepresent(to: string) { return this.next?.represent(to) ?? to; }
  protected nextResolve(to: Resolved) { return this.next?.resolve(to) ?? to; }

  public static __add = class __add extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __sub = class __sub extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __mul = class __mul extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __div = class __div extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __mod = class __mod extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __pow = class __pow extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __concat = class __concat extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __unm = class __unm extends TypeSomeOp<[]> {
  }

  public static __len = class __len extends TypeSomeOp<[]> {
  }

  public static __eq = class __eq extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __lt = class __lt extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __le = class __le extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __index = class __index extends TypeSomeOp<[key: string | number | Type]> {

    public override represent(to: string) {
      const [key] = this.args;

      return this.nextRepresent(
        'string' === typeof key
          ? `${to}.${key}` // XXX: again, assumes '.'
          : 'number' === typeof key
            ? `${to}[${key}]`
            : `${to}[${key.itself instanceof TypeFunction
                ? "function"
                : key.itself instanceof TypeTable
                  ? "table"
                  : key.itself}]`
      );
    }

    public override resolve(to: Resolved) {
      const [key] = this.args;
      let r: Resolved;

      if ('string' === typeof key)
        r = to.itself instanceof TypeTable
          ? to.itself.getField(key).itself.resolved()
          : Type.noType().itself.resolved();
      else if ('number' === typeof key)
        r = to.itself instanceof TypeTable
          ? to.itself.getIndex(key).itself.resolved()
          : Type.noType().itself.resolved();
      else throw "not implemented: __index by type";

      return this.nextResolve(r);
    }

  }

  public static __newindex = class __newindex extends TypeSomeOp<[key: string | number | Type, value: Type]> {

    public override represent(to: string) {
      const [key, value] = this.args;

      return this.nextRepresent(
        'string' === typeof key
          ? `${to}(.${key}: ${value.itself})` // XXX: again, assumes '.'
          : 'number' === typeof key
            ? `${to}([${key}]: ${value.itself})`
            : `${to}([${key.itself instanceof TypeFunction
                ? "function"
                : key.itself instanceof TypeTable
                  ? "table"
                  : key.itself}]: ${value.itself})`
      );
    }

    public override resolve(to: Resolved) {
      const [key, value] = this.args;

      if ('string' === typeof key) {
        if (to.itself instanceof TypeTable)
          to.itself.setField(key, value);
      } else if ('number' === typeof key) {
        if (to.itself instanceof TypeTable)
          to.itself.setIndex(key, value);
      } else throw "not implemented: __newindex by type";

      return this.nextResolve(to);
    }

  }

  public static __call = class __call extends TypeSomeOp<[parameters: Type[]]> {

    public override represent(to: string) {
      const [parameters] = this.args;
      return this.nextRepresent(`${to}(${parameters.join(", ")})`);
    }

    public override resolve(to: Resolved) {
      const [parameters] = this.args;
      return this.nextResolve(
        to.itself instanceof TypeFunction
          ? to.itself.getReturns(parameters)[0].itself.resolved() // XXX: tuple gap
          : Type.noType().itself.resolved()
      );
    }

  }

  public static __metatable = class __metatable extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __ipairs = class __ipairs extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __pairs = class __pairs extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet
  public static __tostring = class __tostring extends TypeSomeOp<unknown[]> { } // YYY: not implemented yet

}
