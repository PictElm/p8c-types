import { Type, TypeFunction, TypeTable } from "./typing";

export class TypeSomeOp<T extends any[] = unknown[]> {

  protected args: T;
  public constructor(...args: T) { this.args = args; }

  public toString() { return this.constructor.name; }
  public represent(to: string): string { throw new Error(`Unhandled operation-on-type: representing "${this}" applied to "${to}"`) }
  public resolve(to: Type): Type[] { throw new Error(`Unhandled operation-on-type: resolving "${this}" applied to "${to}"`) }


  public static __add = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __sub = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __mul = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __div = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __mod = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __pow = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __concat = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __unm = class extends TypeSomeOp<[]> {
  }

  public static __len = class extends TypeSomeOp<[]> {
  }

  public static __eq = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __lt = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __le = class extends TypeSomeOp<[left: Type, right: Type]> {
  }

  public static __index = class extends TypeSomeOp<[key: string | number | Type]> {

    public override represent(to: string): string {
      const key = this.args[0];
      return 'string' === typeof key
        ? `${to}.${key}` // XXX: again, assumes '.'
        : 'number' === typeof key
          ? `${to}[${key}]`
          : `${to}[${key instanceof TypeFunction
              ? "function"
              : key instanceof TypeTable
                ? "table"
                : key}]`;
    }

    public override resolve(to: Type): Type[] {
      const key = this.args[0];

      if ('string' === typeof key)
        return to instanceof TypeTable
          ? to.getField(key).resolved()
          : [Type.noType()];
      else if ('number' === typeof key)
        return to instanceof TypeTable
          ? to.getIndex(key).resolved()
          : [Type.noType()];
      else throw new Error("Not implemented: indexing by type");
    }

  }

  public static __newindex = class extends TypeSomeOp<[key: string | number | Type]> {
  }

  public static __call = class extends TypeSomeOp<[parameters: Type[]]> {

    public override represent(to: string): string {
      return `${to}(${this.args[0].join(", ")})`;
    }

    public override resolve(to: Type): Type[] {
      return to instanceof TypeFunction
          ? to.getReturns(this.args[0]).map(it => it.resolved()[0]) // XXX: tuple gap
          : [Type.noType()];
    }

  }

  public static __metatable = class extends TypeSomeOp<unknown[]> {} // YYY: not implemented yet
  public static __ipairs = class extends TypeSomeOp<unknown[]> {} // YYY: not implemented yet
  public static __pairs = class extends TypeSomeOp<unknown[]> {} // YYY: not implemented yet
  public static __tostring = class extends TypeSomeOp<unknown[]> {} // YYY: not implemented yet

}
