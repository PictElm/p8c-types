import { log } from "./logging";

export abstract class Type {

  protected _id = Math.random() * 1000;
  abstract toString(): string;
  abstract resolved(): Type[];

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

  public setField(field: string, type: Type) {
    this.fields[field] = type;
  }

  public getField(field: string): Type {
    return this.fields[field] ?? new TypeNil();
  }

  public setIndex(index: number, type: Type) {
    this.indices[index] = type;
  }

  public getIndex(index: number): Type {
    return this.indices[index] ?? new TypeNil();
  }

  public toString() {
    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key]}`);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.push(`[${k}]: ${this.indices[k]}`);

    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public resolved() {
    const r = new TypeTable();

    for (const key in this.fields)
      r.setField(key, this.fields[key].resolved()[0]);

    // TODO: should deal with table-as-list better
    for (let k = 0; k < this.indices.length; k++)
      if (this.indices[k])
        r.setIndex(k, this.indices[k].resolved()[0]);

    return [r];
  }

}

export class TypeFunction extends Type {

  private returns: Type[] = [];
  private parameters: [name: string, type: Type][];

  constructor(names: string[]) {
    super();
    this.parameters = names.map(it => [it, new TypeUnknown(it)]);
  }

  public getParameters() {
    return this.parameters;
  }

  public setReturns(types: Type[]) {
    this.returns = types;
  }

  public getReturns(applying?: Type[]): Type[] {
    if (!applying) return this.returns;

    const toRevert: TypeUnknown[] = [];

    this.parameters.forEach(([_, type], k) => {
      if (type instanceof TypeUnknown) {
        toRevert.push(type);
        type.as(applying[k]);
      }
    });

    const r = this.returns.map(it => it.resolved()[0]); // XXX: tuple gap

    toRevert.forEach(it => it.revert());

    return r
  }

  public toString() {
    const parameters = this.parameters
      .map(([name, type]) => `${name}: ${type}`);
    const returns = this.returns.length
      ? this.returns.join(", ")
      : "nil";
    return `(${parameters}) -> [${returns}]`;
  }

  public resolved() {
    const r = new TypeFunction(this.parameters.map(it => it[0]));

    for (let k = 0; k < r.parameters.length; k++)
      r.parameters[k][1] = this.parameters[k][1].resolved()[0];

    return [r];
  }

}

type TypeUnknownOperation
  = { field: string } // member
  | { index: number } // index
  | { parameters: Type[] } // call
  ;
function isMemberOperation(o?: TypeUnknownOperation): o is { field: string } { return o && (o as any).field; }
function isIndexOperation(o?: TypeUnknownOperation): o is { index: number } { return o && (o as any).index; }
function isCallOperation(o?: TypeUnknownOperation): o is { parameters: Type[] } { return o && (o as any).parameters; }
/*
type _Base_TypeSomeOp<name extends string, args> = { name: name, args: args };
type TypeSomeOp__add = _Base_TypeSomeOp<'add', { left: Type, right: Type }>;
type TypeSomeOp__sub = _Base_TypeSomeOp<'sub', { left: Type, right: Type }>;
type TypeSomeOp__mul = _Base_TypeSomeOp<'mul', { left: Type, right: Type }>;
type TypeSomeOp__div = _Base_TypeSomeOp<'div', { left: Type, right: Type }>;
type TypeSomeOp__mod = _Base_TypeSomeOp<'mod', { left: Type, right: Type }>;
type TypeSomeOp__pow = _Base_TypeSomeOp<'pow', { left: Type, right: Type }>;
type TypeSomeOp__concat = _Base_TypeSomeOp<'concat', { left: Type, right: Type }>;
type TypeSomeOp__unm = _Base_TypeSomeOp<'unm', null>;
type TypeSomeOp__len = _Base_TypeSomeOp<'len', null>;
type TypeSomeOp__eq = _Base_TypeSomeOp<'eq', { left: Type, right: Type }>;
type TypeSomeOp__lt = _Base_TypeSomeOp<'lt', { left: Type, right: Type }>;
type TypeSomeOp__le = _Base_TypeSomeOp<'le', { left: Type, right: Type }>;
type TypeSomeOp__index = _Base_TypeSomeOp<'index', { key: string }>;
type TypeSomeOp__newindex = _Base_TypeSomeOp<'newindex', { key: string }>;
type TypeSomeOp__call = _Base_TypeSomeOp<'call', { args: Type[] }>;
//type TypeSomeOp__metatable = _Base_TypeSomeOp<'metatable', unknown> // YYY: not implemented yet
//type TypeSomeOp__ipairs = _Base_TypeSomeOp<'ipairs', unknown> // YYY: not implemented yet
//type TypeSomeOp__pairs = _Base_TypeSomeOp<'pairs', unknown> // YYY: not implemented yet
//type TypeSomeOp__tostring = _Base_TypeSomeOp<'tostring', unknown> // YYY: not implemented yet

export type TypeSomeOp
  = TypeSomeOp__add
  | TypeSomeOp__sub
  | TypeSomeOp__mul
  | TypeSomeOp__div
  | TypeSomeOp__mod
  | TypeSomeOp__pow
  | TypeSomeOp__concat
  | TypeSomeOp__unm
  | TypeSomeOp__len
  | TypeSomeOp__eq
  | TypeSomeOp__lt
  | TypeSomeOp__le
  | TypeSomeOp__index
  | TypeSomeOp__newindex
  | TypeSomeOp__call
  ;
*/
export class TypeUnknown extends Type {

  private acts?: Type;
  private done?: TypeUnknownOperation;

  constructor(private from?: string) { super(); }

  public applied(operation: TypeUnknownOperation): TypeUnknown {
    let niwFrom: string | undefined;

    // YYY: kept, but not sure is useful/meaningful
    if (isMemberOperation(operation))
      niwFrom = `${this.from}.${operation.field}`; // XXX: again, assumes '.'
    else if (isIndexOperation(operation))
      niwFrom = `${this.from}[${operation.index}]`;
    else if (isCallOperation(operation))
      niwFrom = `${this.from}(${operation.parameters.join(", ")})`;

    const r = new TypeUnknown(niwFrom);

    // "acts as `this` with `operation` done on it"
    r.acts = this;
    r.done = operation;

    return r;
  }

  public as(type: Type) { this.acts = type; }
  public revert() { this.acts = undefined; }

  // public toString() {
  //   return this.acts?.toString() ?? `<${this.from ?? "?"}>`;
  // }
  public toString() {
    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this.acts.toString();

    const what = this.done;
    let to = this.acts.toString();

    if (isMemberOperation(what))
      return `${to}.${what.field}`; // XXX: again, assumes '.'
    else if (isIndexOperation(what))
      return `${to}[${what.index}]`;
    else if (isCallOperation(what))
      return `${to}(${what.parameters.join(", ")})`;

    throw "unreachable"; //return `<${this.from ?? "?"}>`;
  }

  public resolved(): Type[] {
    if (!this.acts) return [new TypeNil()];
    if (!this.done) return [this.acts];

    const what = this.done;
    const to = this.acts.resolved()[0];

    if (isMemberOperation(what))
      return to instanceof TypeTable
        ? to.getField(what.field).resolved()
        : [new TypeNil()];
    else if (isIndexOperation(what))
      return to instanceof TypeTable
        ? to.getIndex(what.index).resolved()
        : [new TypeNil()];
    else if (isCallOperation(what))
      return to instanceof TypeFunction
        ? to.getReturns(what.parameters).map(it => it.resolved()[0]) // XXX: tuple gap
        : [new TypeNil()];

    throw "unreachable"; //return [new TypeNil()];
  }

}
