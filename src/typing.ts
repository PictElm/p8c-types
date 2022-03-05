import assert from 'assert';
import { TypeSomeOp } from './operating';

export type Resolved = Type & { marked: boolean };
export abstract class Type {

  // type 0 is "no type at all" (does not make sens)
  private static _lastId = 0;
  protected _id = ++Type._lastId;

  public abstract toString(): string;
  public abstract resolved(): Resolved;

  public static noType() { return new TypeNil(); }
  public static loopType() { return new Type.TypeLoop(); }

  // XXX: very partial support..
  private static TypeLoop = class extends Type {
    public override toString() { return "*"; }
    public override resolved() { return Type.noType().resolved(); }
  }

  protected static mark(type: Type) {
    const r = type as Resolved;

    assert(!r.marked, `Type.mark: type was already resolved: ${r._id}`);

    r.marked = true;
    return r;
  }

}

export class TypeGlobal extends Type {

  public constructor(private name: string) { super(); }

  public override toString() { return `<$${this.name}>`; } // "$" <- ugh ><
  // translates the not-yet-defined global types (only on Identifiers probably)
  public override resolved(): Resolved { throw "not implemented: CurrentDocument.getGlobal(this.name).resolved()"; }

}

export class TypeNil extends Type {

  public override toString() { return "nil"; }
  public override resolved() { return Type.mark(new TypeNil()); }

}

export class TypeBoolean extends Type {

  public override toString() { return "boolean"; }
  public override resolved(): Resolved { return Type.mark(new TypeBoolean()); }

}

export class TypeNumber extends Type {

  public override toString() { return "number"; }
  public override resolved(): Resolved { return Type.mark(new TypeNumber()); }

}

export class TypeString extends Type {

  public override toString() { return "string"; }
  public override resolved(): Resolved { return Type.mark(new TypeString()); }

}

export class TypeThread extends Type {

  public constructor() { super(); throw "not implemented: TypeThread"; } // unreachable (?)

  public override toString() { return "thread"; }
  public override resolved(): Resolved { return Type.mark(new TypeThread()); }

}

export class TypeVararg extends Type {

  public constructor() { super(); throw "not implemented: TypeVararg"; }

  public override toString() { return "..."; }
  public override resolved(): Resolved { return Type.mark(new TypeVararg()); }

}

export class TypeTable extends Type {

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
      r.push(`${key}: ${this.fields[key]}`);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.push(`[${k}]: ${this.indices[k]}`);

    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public override resolved(): Resolved {
    const r = new TypeTable();

    for (const key in this.fields)
      r.setField(key, this.fields[key].resolved());

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.setIndex(k, this.indices[k].resolved());

    return Type.mark(r);
  }

}

export class TypeFunction extends Type {

  private returns: Type[] = [];
  private parameters: [name: string, type: Type][];

  public constructor(names: string[]) {
    super();
    this.parameters = names.map(it => [it, new TypeSome(it)]);
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
      if (type instanceof TypeSome) {
        toRevert.push(type);
        type.as(applying[k]);
      }
    });

    const r = this.returns.map(it => it.resolved()); // XXX: tuple gap

    toRevert.forEach(it => it.revert());

    return r
  }

  public override toString() {
    const parameters = this.parameters
      .map(([name, type]) => `${name}: ${type}`)
      .join(", ");

    let returns: string = "";
    if (this.returns.length) {
      const toRevert: TypeSome[] = [];

      this.parameters.forEach(([_, type], k) => {
        if (type instanceof TypeSome) {
          toRevert.push(type);
          type.as(type);
        }
      });

      returns = this.returns.join(", "); // XXX: tuple gap [?]

      toRevert.forEach(it => it.revert());
    }

    return `(${parameters}) -> [${returns}]`;
  }

  public override resolved(): Resolved {
    const r = new TypeFunction(this.parameters.map(it => it[0]));

    for (let k = 0; k < r.parameters.length; k++)
      r.parameters[k][1] = this.parameters[k][1].resolved();

    return Type.mark(r);
  }

}

export class TypeSome extends Type {

  private acts?: Type;
  private done?: TypeSomeOp;

  public constructor(private from?: string) { super(); }

  // in-place applied (the type is modified)
  public setApplied<T extends any[]>(operation: TypeSomeOp<T>) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  // not in-place applied (a new type is created)
  public getApplied<T extends any[]>(operation: TypeSomeOp<T>): TypeSome {
    //const repr = this.from && operation.represent(this.from);
    const r = new TypeSome();

    // "acts as `this` with `operation` done on it"
    r.acts = this;
    r.done = operation;

    return r;
  }

  public as(type: Type) {
    assert(!this.acts, "TypeSome.as: already acts as " + this.acts);
    this.acts = type;
  }
  public revert() {
    assert(this.acts, "TypeSome.revert: not acting as anything");
    this.acts = undefined;
  }

  public override toString() {
    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this === this.acts
        ? `<${this.from ?? "?"}>`
        : this.acts.toString();

    const what = this.done;
    const to = this === this.acts
      ? `<${this.from ?? "?"}>`
      : this.acts.toString();

    return what.represent(to);
  }

  public override resolved() {
    if (!this.acts) return Type.noType().resolved();
    if (!this.done) return this === this.acts
        ? Type.mark(this)
        : this.acts.resolved();

    const what = this.done;
    const to = this === this.acts
      ? Type.mark(this)
      : this.acts.resolved();

    return what.resolve(to);
  }

}
