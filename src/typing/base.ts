import assert from 'assert';
import { Metadata } from '../documenting';
import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { TypeNil } from './internal';

export function toPOJO(type: BaseType): unknown {
  const r = type.toJSON("");
  for (const k in r)
    if ('function' === typeof r[k].toJSON)
      r[k] = r[k].toJSON(k);
  return r;
}

/** this is the underlying abstract class for a type `itself` */
export abstract class BaseType {

  private static _lastId = 0;
  protected readonly _id = ++BaseType._lastId;

  public constructor () { }

  /** returns the string representation of the type */
  public abstract toString(): string;
  /** returns a POJO describing the type; it may be recursive (initially mainly meant for debug purposes) */
  public abstract toJSON(key?: string): any; // YYY: could type that, why not, that could be _fun_
  /** returns a new type identical to this one */
  public /* abstract default */ resolved(): VarInfo { return { type: this }; }

  /**
   * entries of this object are to be called from the MetaOps namespace only!
   * 
   * @todo TODO: not quite like that, or the only way to properly extend and inherit
   * is through `Object.create` (which may by fine, but maybe another way could be better)
   * -> move it to prototype in some way
   */
  public metaOps: Partial<MetaOpsType> = {};

}

export type Type = BaseType;

export namespace Type {

  // XXX: tsc should warn when it encouters on of these... anyhow, this was to
  // temporarily circumvent the "Type instantiation is excessively deep and possibly infinite."
  // dont know when to remove, so here's a XXX; please see me o/
  // @ts-ignore
  // export function make<Z extends new (...args: [...ConstructorParameters<Z>]) => BaseType>(ctor: Z, ...args: ConstructorParameters<Z>): InstanceType<Z> {
  export function make<Z extends new (...args: any[]) => BaseType>(ctor: Z, ...args: any[]): InstanceType<Z> {
    // const r = new Type();
    // r.mutate(new ctor(r, ...args));
    // return r;
    return new ctor(...args) as InstanceType<Z>;
  }

  export function noType(/* details / reasons / ..? */) { return Type.make(TypeNil); }

}

//#region union & intersection

// TODO: properly
export class TypeUnion extends BaseType {

  public constructor(
    private left: Type,
    private right: Type,
  ) { super(); }

  public override toString() {
    return `${this.left} | ${this.right}`;
  }

  public override toJSON() {
    return {
      type: this.constructor.name,
      left: this.left.toJSON('left'),
      right: this.right.toJSON('right'),
    };
  }

  public override resolved() {
    return this.left.constructor === this.right.constructor
      ? this.left.resolved()
      : Type.noType().resolved(); // XXX: absolutely not
  }

}

// TODO: properly
export class TypeIntersection extends BaseType {

  public constructor(
    private left: Type,
    private right: Type,
  ) { super(); }

  public override toString() {
    return `${this.left} & ${this.right}`;
  }

  public override toJSON() {
    return {
      type: this.constructor.name,
      left: this.left.toJSON('left'),
      right: this.right.toJSON('right'),
    };
  }

  public override resolved() {
    return this.left.constructor === this.right.constructor
      ? this.left.resolved()
      : Type.noType().resolved(); // XXX: absolutely not
  }

}

//#endregion

export class TypeAlias extends BaseType {

  public constructor(
    public readonly alias: string,
    public readonly doc?: Metadata,
    public forType?: Type
  ) { super(); }

  public override toString() {
    return this.alias;
  }

  public override toJSON() {
    return {
      type: this.constructor.name,
      alias: this.alias,
    };
  }

  public override resolved() {
    return Type.noType().resolved(); // XXX: absolutely not
  }

}
