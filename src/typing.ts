import assert from 'assert';
import { Metadata } from './documenting';
import { TypeSomeOp } from './operating';

export type Resolved = Type & { marked: boolean };

abstract class BaseType { // YYY?

  public constructor (protected readonly outself: Type) { }

  public abstract toString(): string;
  public abstract resolved(): Resolved;

  protected static mark(type: Type) {
    const r = type as Resolved;

    assert(!r.marked, `BaseType.mark: type was already resolved: ${r}`);

    r.marked = true;
    return r;
  }

}

// help :'
type Ctors
  = typeof TypeNil
  | typeof TypeBoolean
  | typeof TypeNumber
  | typeof TypeString
  | typeof TypeThread
  | typeof TypeVararg
  | typeof TypeTable
  | typeof TypeFunction
  | typeof TypeSome
  ;

export class Type {

  private static _lastId = 0;
  protected readonly _id = ++Type._lastId;

  private _itself: BaseType = null!;
  public get itself() { return this._itself; }

  private _metadata?: Metadata;
  public set metadata(value) { this._metadata = value; }
  public get metadata() { return this._metadata; }

  private constructor() { }

  public as<Z extends Ctors>(ctor: Z) { return this._itself instanceof ctor ? this._itself as InstanceType<Z> : undefined; }
  public mutate<T extends BaseType>(into: T) { return this._itself = into; }

  public toString() { return `_id${this._id}`; }

  public static Nil() { const r = new Type(); r.mutate(new TypeNil(r)); return r; }
  public static Boolean() { const r = new Type(); r.mutate(new TypeBoolean(r)); return r; }
  public static Number() { const r = new Type(); r.mutate(new TypeNumber(r)); return r; }
  public static String() { const r = new Type(); r.mutate(new TypeString(r)); return r; }
  public static Thread() { const r = new Type(); r.mutate(new TypeThread(r)); return r; }
  public static Vararg() { const r = new Type(); r.mutate(new TypeVararg(r)); return r; }
  public static Table() { const r = new Type(); r.mutate(new TypeTable(r)); return r; }
  public static Function(names: string[]) { const r = new Type(); r.mutate(new TypeFunction(r, names)); return r; }
  public static Some(from?: string) { const r = new Type(); r.mutate(new TypeSome(r, from)); return r; }

  public static noType() { return Type.Nil(); } // YYY?

}

export class TypeNil extends BaseType {

  public override toString() { return "nil"; }
  public override resolved(): Resolved { return BaseType.mark(Type.Nil()); }

}

export class TypeBoolean extends BaseType {

  public override toString() { return "boolean"; }
  public override resolved(): Resolved { return BaseType.mark(Type.Boolean()); }

}

export class TypeNumber extends BaseType {

  public override toString() { return "number"; }
  public override resolved(): Resolved { return BaseType.mark(Type.Number()); }

}

export class TypeString extends BaseType {

  public override toString() { return "string"; }
  public override resolved(): Resolved { return BaseType.mark(Type.String()); }

}

export class TypeThread extends BaseType {

  public constructor(outself: Type) { super(outself); throw "not implemented: TypeThread"; }

  public override toString() { return "thread"; }
  public override resolved(): Resolved { return BaseType.mark(Type.Thread()); }

}

export class TypeVararg extends BaseType {

  public constructor(outself: Type) { super(outself); throw "not implemented: TypeVararg"; }

  public override toString() { return "..."; }
  public override resolved(): Resolved { return BaseType.mark(Type.Vararg()); }

}

export class TypeTable extends BaseType {

  private fields: Record<string, Type> = {};
  private indices: Array<Type> = [];

  public setField(field: string, type: Type) {
    this.fields[field] = type;
  }

  public getField(field: string): Type {
    return this.fields[field] ?? Type.noType();
  }

  public setIndex(index: number, type: Type) {
    this.indices[index] = type;
  }

  public getIndex(index: number): Type {
    return this.indices[index] ?? Type.noType();
  }

  public override toString() {
    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key].itself}`);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.push(`[${k}]: ${this.indices[k].itself}`);

    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public override resolved(): Resolved {
    const r = Type.Table();
    const tableType = r.as(TypeTable)!;

    for (const key in this.fields)
      tableType.setField(key, this.fields[key].itself.resolved());

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        tableType.setIndex(k, this.indices[k].itself.resolved());

    return BaseType.mark(r);
  }

}

export class TypeFunction extends BaseType {

  private returns: Type[] = [];
  private parameters: [name: string, type: Type][];

  public constructor(outself: Type, names: string[]) {
    super(outself);
    this.parameters = names.map(it => [it, Type.Some(it)]);
  }

  public getParameters() {
    return this.parameters;
  }

  public setReturns(types: Type[]) {
    this.returns = types;
  }

  public getReturns(applying: Type[]): Type[] {
    const toRevert: TypeSome[] = [];

    this.parameters.forEach(([_, type], k) => {
      if (type.itself instanceof TypeSome) {
        toRevert.push(type.itself);
        type.itself.actsAs(applying[k]);
      }
    });

    const r = this.returns.map(it => it.itself.resolved()); // XXX: tuple gap

    toRevert.forEach(it => it.revert());

    return r
  }

  public override toString() {
    const parameters = this.parameters
      .map(([name, type]) => `${name}: ${type.itself}`)
      .join(", ");

    let returns: string = "";
    if (this.returns.length) {
      const toRevert: TypeSome[] = [];

      this.parameters.forEach(([_, type]) => {
        if (type.itself instanceof TypeSome) {
          toRevert.push(type.itself);
          type.itself.actsAs(type);
        }
      });

      returns = this.returns
        .map(it => `${it.itself}`)
        .join(", "); // XXX: tuple gap [?]

      toRevert.forEach(it => it.revert());
    }

    return `(${parameters}) -> [${returns}]`;
  }

  public override resolved(): Resolved {
    const r = Type.Function(this.parameters.map(it => it[0]));
    const functionType = r.as(TypeFunction)!;

    const returns = this.returns.map(ret => {
      const k = this.parameters.findIndex(par => par[1] === ret);
      if (-1 < k) return functionType.parameters[k][1]; // ret itself _is_ a param of this

      throw "hey"; // XXX/TODO/FIXME/...: find a way to trigger that
      // summary:
      //  if a this param somewhere in the type description of ret,
      //  it needs to be replaced with the corresponding r param
    });
    functionType.setReturns(returns);

    return BaseType.mark(r);
  }

}

export class TypeSome extends BaseType {

  private acts?: Type;
  private done?: TypeSomeOp;

  public constructor(outself: Type, private from?: string) { super(outself); }

  // in-place applied (the type is modified)
  public setApplied<T extends any[]>(operation: TypeSomeOp<T>) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  // not in-place applied (a new type is created)
  public getApplied<T extends any[]>(operation: TypeSomeOp<T>) {
    //const repr = this.from && operation.represent(this.from);
    const r = Type.Some();
    const someType = r.as(TypeSome)!;

    // "acts as `this` with `operation` done on it"
    someType.acts = this.outself;
    someType.done = operation;

    return r;
  }

  public actsAs(type: Type) {
    assert(!this.acts, "TypeSome.as: already acts as " + this.acts);
    this.acts = type;
  }
  public revert() {
    assert(this.acts, "TypeSome.revert: not acting as anything");
    this.acts = undefined;
  }

  public override toString() {
    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this === this.acts.itself
        ? `<${this.from ?? "?"}>`
        : `${this.acts.itself}`;

    const what = this.done;
    const to = this === this.acts.itself
      ? `<${this.from ?? "?"}>`
      : `${this.acts.itself}`;

    return what.represent(to);
  }

  public override resolved() {
    if (!this.acts) return Type.noType().itself.resolved();
    if (!this.done) return this === this.acts.itself
        ? BaseType.mark(this.outself)
        : this.acts.itself.resolved();

    const what = this.done;
    const to = this === this.acts.itself
      ? BaseType.mark(this.outself)
      : this.acts.itself.resolved();

    return what.resolve(to);
  }

}
