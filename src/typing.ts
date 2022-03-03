import { TypeSomeOp } from "./operating";

export abstract class Type {

  protected _id = Math.random() * 1000;
  public abstract toString(): string;
  public abstract resolved(): Type[];

  public static noType() { return new TypeNil(); }
  public static loopType() { return new Type.TypeLoop(); }

  // XXX: very partial support..
  private static TypeLoop = class extends Type {
    public toString() { return "*"; }
    public resolved() { return [Type.noType()]; }
  }

}

export class TypeNil extends Type {
  public toString() { return "nil"; }
  public resolved() { return [new TypeNil()]; }
}

export class TypeBoolean extends Type {
  public toString() { return "boolean"; }
  public resolved() { return [new TypeBoolean()]; }
}

export class TypeNumber extends Type {
  public toString() { return "number"; }
  public resolved() { return [new TypeNumber()]; }
}

export class TypeString extends Type {
  public toString() { return "string"; }
  public resolved() { return [new TypeString()]; }
}

export class TypeTable extends Type {

  private fields: Record<string, Type> = {};
  private indices: Array<Type> = [];
  private resolving: boolean = false; // YYY: prevents infinite recursions -- not sure ever useful

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

  public toString() {
    if (this.resolving) return (Type.loopType()).toString();
    this.resolving = true;

    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key]}`);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.push(`[${k}]: ${this.indices[k]}`);

    this.resolving = false;
    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public resolved(): Type[] {
    if (this.resolving) return (Type.loopType()).resolved();
    this.resolving = true;

    const r = new TypeTable();

    for (const key in this.fields)
      r.setField(key, this.fields[key].resolved()[0]);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.setIndex(k, this.indices[k].resolved()[0]);

    this.resolving = false;
    return [r];
  }

}

export class TypeFunction extends Type {

  private returns: Type[] = [];
  private parameters: [name: string, type: Type][];
  private resolving: boolean = false; // YYY: prevents infinite recursions -- not sure ever useful

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

  public getReturns(applying?: Type[]): Type[] {
    if (!applying) return this.returns;

    const toRevert: TypeSome[] = [];

    this.parameters.forEach(([_, type], k) => {
      if (type instanceof TypeSome) {
        toRevert.push(type);
        type.as(applying[k]);
      }
    });

    const r = this.returns.map(it => it.resolved()[0]); // XXX: tuple gap

    toRevert.forEach(it => it.revert());

    return r
  }

  public override toString() {
    if (this.resolving) return (Type.loopType()).toString();
    this.resolving = true;

    const parameters = this.parameters
      .map(([name, type]) => `${name}: ${type}`);
    const returns = this.returns.length
      ? this.returns.join(", ")
      : "nil";

    this.resolving = false;
    return `(${parameters}) -> [${returns}]`;
  }

  public override resolved(): Type[] {
    if (this.resolving) return (Type.loopType()).resolved();
    this.resolving = true;

    const r = new TypeFunction(this.parameters.map(it => it[0]));

    for (let k = 0; k < r.parameters.length; k++)
      r.parameters[k][1] = this.parameters[k][1].resolved()[0];

    this.resolving = false;
    return [r];
  }

}

export class TypeSome extends Type {

  private acts?: Type;
  private done?: TypeSomeOp;
  private resolving: boolean = false; // YYY: prevents infinite recursions -- not sure ever useful

  public constructor(private from?: string) { super(); }

  public applied<T extends any[]>(operation: TypeSomeOp<T>): TypeSome {
    const repr = this.from && operation.represent(this.from);
    const r = new TypeSome(repr);

    // "acts as `this` with `operation` done on it"
    r.acts = this;
    r.done = operation;

    return r;
  }

  public as(type: Type) { this.acts = type; }
  public revert() { this.acts = undefined; }

  public override toString() {
    if (this.resolving) return (Type.loopType()).toString();
    this.resolving = true;

    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this.acts.toString();

    const what = this.done;
    let to = this.acts.toString();

    this.resolving = false;
    return what.represent(to);
  }

  public override resolved(): Type[] {
    if (this.resolving) return (Type.loopType()).resolved();
    this.resolving = true;

    if (!this.acts) return [Type.noType()];
    if (!this.done) return [this.acts];

    const what = this.done;
    const to = this.acts.resolved()[0];

    this.resolving = false;
    return what.resolve(to);
  }

}
