import assert from 'assert';
import { TypeSomeOp } from './operating';
import { VarInfo } from './scoping';

/**
 * when a type is resolved, it is marked
 * 
 * (idea was preventing a same entity to be resolved multiple times)
 */
export type Resolved = Type & { marked: boolean };

/** this is the underlying abstract class for a type `itself` */
abstract class BaseType {

  public constructor (protected readonly outself: Type) { }

  public abstract toString(): string;
  public abstract toJSON(key: string): any;
  public abstract resolved(): Resolved;

  protected static mark(type: Type) {
    const r = type as Resolved;

    assert(!r.marked, `BaseType.mark: type was already resolved: ${r}`);

    r.marked = true;
    return r;
  }

}

/** underlying abstract class for literal types (boolean, number, string) */
abstract class BaseTypeLiteral<Eq> extends BaseType {

  public constructor(outself: Type,
    protected value: Eq
  ) { super(outself); }

  public setLiterals(literal: Eq) {
    this.value = literal;
  }

  public getLiterals() {
    return this.value;
  }

}

type OmitFirst<A extends any[]> = A extends [unknown, ...infer T] ? T : never;

/**
 * this is the class to use to create a typing information
 * 
 * it also acts as a wrapper around this typing information (which is
 * accessible with `itself` and `as`) this is to add a layer of indirection
 * (allows mutating a type in-place and keep every references valides)
 */
export class Type {

  private static _lastId = 0;
  protected readonly _id = ++Type._lastId;

  private _itself: BaseType = null!;
  public get itself() { return this._itself; }

  private constructor() { }

  /** checks if the type itself is instance of given parameter, if not returns `undefined` */
  public as<Z extends new (...args: any[]) => BaseType>(ctor: Z) { return this._itself instanceof ctor ? this._itself as InstanceType<Z> : undefined; }
  /** mutates the type itself to be the new given type (remark: not sure this will be used anymore though...) */
  public mutate<T extends BaseType>(into: T) { return this._itself = into; }

  public toString() { return `Type@_id${this._id}`; }
  public toJSON(key: string) { const name = this.itself.constructor.name; return { [name]: this.itself.toJSON(name) } };

  public static make<Z extends new (...args: [Type, ...OmitFirst<ConstructorParameters<Z>>]) => BaseType>(ctor: Z, ...args: OmitFirst<ConstructorParameters<Z>>) {
    const r = new Type();
    r.mutate(new ctor(r, ...args));
    return r;
  }

  public static noType() { return Type.make(TypeNil); } // YYY?

}

export class TypeNil extends BaseType {

  public override toString() { return "nil"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeNil)); }

}

export class TypeBoolean extends BaseType {

  public override toString() { return "boolean"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeBoolean)); }

}

export class TypeNumber extends BaseType {

  public override toString() { return "number"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeNumber)); }

}

export class TypeString extends BaseType {

  public override toString() { return "string"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeString)); }

}

export class TypeLiteralBoolean extends BaseTypeLiteral<boolean> {

  public override toString() { return this.value.toString(); }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralBoolean, this.value));
  }

}

export class TypeLiteralNumber extends BaseTypeLiteral<number> {

  public override toString() { return this.value.toString(); }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralNumber, this.value));
  }

}

export class TypeLiteralString extends BaseTypeLiteral<string> {

  public override toString() { return `'${this.value}'`; }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralString, this.value));
  }

}

export class TypeTuple extends BaseType {

  public constructor(outself: Type,
    private types: Type[]
  ) { super(outself); }

  public override toString() {
    return `[${this.types.map(it => it.itself).join(", ")}]`;
  }

  public override toJSON() {
    return this.types.map((it, k) => it.toJSON(k.toString()));
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeTuple, this.types.map(it => it.itself.resolved())));
  }

}

export class TypeVararg extends BaseType { // TypeTuple

  public constructor(outself: Type) { super(outself); throw "not implemented: TypeVararg"; }

  public override toString() { return "..."; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeVararg)); }

}

export class TypeTable extends BaseType {

  private fields: Record<string, VarInfo> = {};
  private indices: Array<VarInfo> = [];

  /** set an entry of known (string) name */
  public setField(field: string, type: VarInfo) {
    this.fields[field] = type;
  }

  /** get an entry of known (string) name */
  public getField(field: string): VarInfo {
    return this.fields[field] ?? Type.noType();
  }

  // XXX: not sure the setIndex/getIndex methods make sense
  // may be more appropriate for a tuple type; here would rather
  // have a setTyped/getTyped with the type being 'number' or something...

  /** set an entry of known (numeric) index */
  public setIndex(index: number, type: VarInfo) {
    this.indices[index] = type;
  }

  /** get an entry of known (numeric) index */
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

  public override toJSON() {
    return {
      fields: Object.fromEntries(Object.entries(this.fields).map(([k, v]) => [k, v.type.toJSON(k)])),
      indices: this.indices.map((it, k) => it.type.itself.toJSON(k.toString())),
    };
  }

  public override resolved(): Resolved {
    const r = Type.make(TypeTable);
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
    this.parameters = names.map(name => [name, { type: Type.make(TypeSome, name) }]);
  }

  /** get the parameters info */
  public getParameters() {
    return this.parameters;
  }

  /** update the returns (tuple) info */
  public setReturns(infos: VarInfo[]) {
    this.returns = infos;
  }

  /**
   * get the returns (tuple) info
   * 
   * if `applying` is provided, first resolves the info
   * as if the function was called with these as parameters
   * 
   * @param applying info for the parameters of the (Lua) function
   */
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

  public override toJSON() {
    return {
      parameters: this.parameters.map(([k, v]) => [k, v.type.toJSON(k)]),
      returns: this.returns.map((it, k) => it.type.toJSON(k.toString())),
    };
  }

  public override resolved(): Resolved {
    const r = Type.make(TypeFunction, this.parameters.map(it => it[0]));
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

export class TypeThread extends BaseType { // TypeFunction

  public constructor(outself: Type) { super(outself); throw "not implemented: TypeThread"; }

  public override toString() { return "thread"; }
  public override toJSON() { return "TODO"; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeThread)); }

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
  public setApplied<T extends any[]>(operation: TypeSomeOp<T>) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  /** not in-place applied (a new type is created) */
  public getApplied<T extends any[]>(operation: TypeSomeOp<T>) {
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

  public override toJSON() {
    return {
      acts: this.acts?.type.toJSON('acts'),
      from: this.from ?? null,
      done: this.done?.constructor.name ?? null,
    };
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

// TODO: properly
export class TypeUnion extends BaseType {

  public constructor(outself: Type,
    private left: Type,
    private right: Type,
  ) { super(outself); }

  public override toString() {
    return `${this.left.itself} | ${this.right.itself}`;
  }

  public override toJSON() {
    return {
      left: this.left,
      right: this.right,
    };
  }

  public override resolved(): Resolved {
    return this.left.itself.constructor === this.right.itself.constructor
      ? this.left.itself.resolved()
      : Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

// TODO: properly
export class TypeIntersection extends BaseType {

  public constructor(outself: Type,
    private left: Type,
    private right: Type,
  ) { super(outself); }

  public override toString() {
    return `${this.left.itself} & ${this.right.itself}`;
  }

  public override toJSON() {
    return {
      left: this.left,
      right: this.right,
    };
  }

  public override resolved(): Resolved {
    return this.left.itself.constructor === this.right.itself.constructor
      ? this.left.itself.resolved()
      : Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

// TODO: alias types registry
export class TypeAlias extends BaseType {

  public constructor(outself: Type,
    public readonly alias: string
  ) { super(outself); }

  public override toString() {
    return this.alias;
  }

  public override toJSON() {
    return {
      alias: this.alias,
    };
  }

  public override resolved() {
    return Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

// { a: boolean } | { b: number } more or less = { a?: boolean, b?: number } (only 1 of them can diverge)
// { b: number } & { c: string } == { b: number, c: string }

// { a: boolean } | { a: number } == { a: boolean | number }
// { a: number } & { a: string } == { a: number & string } (ie never)
