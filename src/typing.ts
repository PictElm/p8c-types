import assert from 'assert';
import { TypeSomeOp } from './operating';
import { VarInfo } from './scoping';

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

abstract class BaseTypeLiteral<Eq> extends BaseType {

  public constructor(outself: Type,
    protected value: Eq
  ) { super(outself); }

  public setLiterals(literal: Eq) {
    this.value;
  }

  public getLiterals() {
    return this.value;
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
  | typeof TypeUnion
  | typeof TypeIntersection
  | typeof TypeLiteralBoolean
  | typeof TypeLiteralNumber
  | typeof TypeLiteralString
  ;

export class Type {

  private static _lastId = 0;
  protected readonly _id = ++Type._lastId;

  private _itself: BaseType = null!;
  public get itself() { return this._itself; }

  private constructor() { }

  public as<Z extends Ctors>(ctor: Z) { return this._itself instanceof ctor ? this._itself as InstanceType<Z> : undefined; }
  public mutate<T extends BaseType>(into: T) { return this._itself = into; }

  public toString() { return `Type@_id${this._id}`; }

  public static Nil() { const r = new Type(); r.mutate(new TypeNil(r)); return r; }
  public static Boolean() { const r = new Type(); r.mutate(new TypeBoolean(r)); return r; }
  public static Number() { const r = new Type(); r.mutate(new TypeNumber(r)); return r; }
  public static String() { const r = new Type(); r.mutate(new TypeString(r)); return r; }
  public static Thread() { const r = new Type(); r.mutate(new TypeThread(r)); return r; }
  public static Vararg() { const r = new Type(); r.mutate(new TypeVararg(r)); return r; }
  public static Table() { const r = new Type(); r.mutate(new TypeTable(r)); return r; }
  public static Function(names: string[]) { const r = new Type(); r.mutate(new TypeFunction(r, names)); return r; }
  public static Some(from?: string) { const r = new Type(); r.mutate(new TypeSome(r, from)); return r; }
  public static Union(left: Type, right: Type) { const r = new Type(); r.mutate(new TypeUnion(r, left, right)); return r; }
  public static Intersection(left: Type, right: Type) { const r = new Type(); r.mutate(new TypeIntersection(r, left, right)); return r; }
  public static LiteralBoolean(value: boolean) { const r = new Type(); r.mutate(new TypeLiteralBoolean(r, value)); return r; }
  public static LiteralNumber(value: number) { const r = new Type(); r.mutate(new TypeLiteralNumber(r, value)); return r; }
  public static LiteralString(value: string) { const r = new Type(); r.mutate(new TypeLiteralString(r, value)); return r; }

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

export class TypeLiteralBoolean extends BaseTypeLiteral<boolean> {

  public override toString() {
    return this.value.toString();
  }

  public resolved(): Resolved {
    return BaseType.mark(Type.LiteralBoolean(this.value));
  }

}

export class TypeLiteralNumber extends BaseTypeLiteral<number> {

  public override toString() {
    return this.value.toFixed(); // TBD or something
  }

  public resolved(): Resolved {
    return BaseType.mark(Type.LiteralNumber(this.value));
  }

}

export class TypeLiteralString extends BaseTypeLiteral<string> {

  public override toString() {
    return `'${this.value}'`;
  }

  public resolved(): Resolved {
    return BaseType.mark(Type.LiteralString(this.value));
  }

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

  private fields: Record<string, VarInfo> = {};
  private indices: Array<VarInfo> = [];

  public setField(field: string, type: VarInfo) {
    this.fields[field] = type;
  }

  public getField(field: string): VarInfo {
    return this.fields[field] ?? Type.noType();
  }

  public setIndex(index: number, type: VarInfo) {
    this.indices[index] = type;
  }

  public getIndex(index: number): VarInfo {
    return this.indices[index] ?? Type.noType();
  }

  public override toString() {
    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key].type.itself}`);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.push(`[${k}]: ${this.indices[k].type.itself}`);

    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public override resolved(): Resolved {
    const r = Type.Table();
    const tableType = r.as(TypeTable)!;

    for (const key in this.fields)
      tableType.setField(key, {
        type: this.fields[key].type.itself.resolved(),
        doc: this.fields[key].doc,
      });

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        tableType.setIndex(k, {
          type: this.indices[k].type.itself.resolved(),
          doc: this.indices[k].doc,
        });

    return BaseType.mark(r);
  }

}

export class TypeFunction extends BaseType {

  private returns: VarInfo[] = [];
  private parameters: [name: string, type: VarInfo][];

  public constructor(outself: Type, names: string[]) {
    super(outself);
    this.parameters = names.map(name => [name, { type: Type.Some(name) }]);
  }

  public getParameters() {
    return this.parameters;
  }

  public setReturns(infos: VarInfo[]) {
    this.returns = infos;
  }

  public getReturns(applying?: VarInfo[]): VarInfo[] {
    if (!applying) return this.returns;

    const toRevert: TypeSome[] = [];

    this.parameters.forEach(([_, info], k) => {
      if (info.type.itself instanceof TypeSome) {
        toRevert.push(info.type.itself);
        info.type.itself.actsAs(applying[k]);
      }
    });

    const r = this.returns.map(info => ({
      type: info.type.itself.resolved(),
      doc: info.doc,
    })); // XXX: tuple gap

    toRevert.forEach(type => type.revert());

    return r
  }

  public override toString() {
    const parameters = this.parameters
      .map(([name, info]) => `${name}: ${info.type.itself}`)
      .join(", ");

    let returns: string = "";
    if (this.returns.length) {
      const toRevert: TypeSome[] = [];

      this.parameters.forEach(([_, info]) => {
        if (info.type.itself instanceof TypeSome) {
          toRevert.push(info.type.itself);
          info.type.itself.actsAs(info);
        }
      });

      returns = this.returns
        .map(info => `${info.type.itself}`)
        .join(", "); // XXX: tuple gap [?]

      toRevert.forEach(type => type.revert());
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

  private acts?: VarInfo;
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
    const r = { type: Type.Some() };
    const someType = r.type.as(TypeSome)!;

    // "acts as `this` with `operation` done on it"
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

  public override toString() {
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

  public override resolved() {
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

}

export class TypeUnion extends BaseType {

  public constructor(outself: Type,
    private left: Type,
    private right: Type,
  ) { super(outself); }

  public override toString() {
    return `${this.left.itself} | ${this.right.itself}`;
  }

  public override resolved(): Resolved {
    return this.left.itself.constructor === this.right.itself.constructor
      ? this.left.itself.resolved()
      : Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

export class TypeIntersection extends BaseType {

  public constructor(outself: Type,
    private left: Type,
    private right: Type,
  ) { super(outself); }

  public override toString() {
    return `${this.left.itself} & ${this.right.itself}`;
  }

  public override resolved(): Resolved {
    return this.left.itself.constructor === this.right.itself.constructor
      ? this.left.itself.resolved()
      : Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

