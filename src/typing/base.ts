import assert from 'assert';
import { Metadata } from '../documenting';
import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { TypeNil } from './internal';

/**
 * when a type is resolved, it is marked
 * 
 * (idea was preventing a same entity to be resolved multiple times)
 */
export type Marked = Type & { marked: boolean };
export type ResolvedInfo = Omit<VarInfo, 'type'> & { type: Marked };
export type ResolvingInfo = Omit<VarInfo, 'type'> & { type?: Type };

/** this is the underlying abstract class for a type `itself` */
export abstract class BaseType {

  public constructor (protected readonly outself: Type) { }

  public abstract toString(): string;
  public abstract toJSON(key: string): unknown;
  public abstract resolved(): ResolvedInfo;

  /**
   * entries of this object are to be called from the MetaOps namespace only!
   * 
   * @todo TODO: not quite like that, or the only way to properly extend and inherit
   * is through `Object.create` (which may by fine, but maybe another way could be better)
   * -> move it to prototype in some way
   */
  public metaOps: Partial<MetaOpsType> = {};

  private static alreadyMarked: Record<string, ResolvingInfo> | undefined;
  private static startedMarkingSession: string | undefined;

  protected static mark(niwVarInfo: ResolvingInfo, forType: Type) {
    const r = niwVarInfo.type as Marked;

    assert(!r.marked, `BaseType.mark: type was already resolved: ${r}`);

    assert(BaseType.alreadyMarked, "BaseType.mark: not in a resolving session (missing a call to tryFindMarker at the beginning of a .resolved)");
    if (forType.toString() === BaseType.startedMarkingSession) { // YYY: toString -> _id
      assert(BaseType.alreadyMarked, `BaseType.mark: not in a resolving session (trying to close it with: "${BaseType.startedMarkingSession}")`);
      BaseType.alreadyMarked = undefined;
      BaseType.startedMarkingSession = undefined;
    }

    r.marked = true;
    return niwVarInfo as ResolvedInfo;
  }

  protected static marked(niwVarInfo: ResolvingInfo) {
    return niwVarInfo as ResolvedInfo;
  }

  protected static marking(niwVarInfo: ResolvingInfo, forType: Type) {
    const toString = forType.toString(); // YYY: toString -> _id
    if (!BaseType.alreadyMarked) {
      assert(!BaseType.startedMarkingSession, `BaseType.tryFindMarked: already in a resolving session (previous started: "${BaseType.startedMarkingSession}", new proposed started: "${toString}")`);
      BaseType.alreadyMarked = {};
      BaseType.startedMarkingSession = toString;
    }
    if (!BaseType.alreadyMarked[toString])
      BaseType.alreadyMarked[toString] = niwVarInfo;
    return BaseType.alreadyMarked[toString];
  }

}

type OmitFirst<A extends unknown[]> = A extends [unknown, ...infer T] ? T : never;

/**
 * this is the class to use to create a typing information
 * 
 * it also acts as a wrapper around this typing information (which is
 * accessible with `itself` and `as`) this is to add a layer of indirection
 * (allows mutating a type in-place and keep every references valide)
 */
export class Type {

  private static _lastId = 0;
  protected readonly _id = ++Type._lastId;

  private _itself: BaseType = null!; // is set with mutate right away (see Type.make)
  public get itself() { return this._itself; }

  private constructor() { }

  /** checks if the type itself is instance of given parameter, if not returns `undefined` */
  public as<Z extends new (...args: any[]) => BaseType>(ctor: Z) { return this._itself instanceof ctor ? this._itself as InstanceType<Z> : undefined; }
  /** mutates the type itself to be the new given type (remark: not sure this will be used anymore though...) */
  public mutate<T extends BaseType>(into: T) { return this._itself = into; }

  /* istanbul ignore next */
  public toString() { return `Type@_id${this._id}`; }
  public toJSON(key: string) { const name = this.itself.constructor.name; return { [name]: this.itself.toJSON(name) } };

  public static make<Z extends new (...args: [Type, ...OmitFirst<ConstructorParameters<Z>>]) => BaseType>(ctor: Z, ...args: OmitFirst<ConstructorParameters<Z>>) {
    const r = new Type();
    r.mutate(new ctor(r, ...args));
    return r;
  }

  public static noType(/* details / reasons / ..? */) { return Type.make(TypeNil); }

}

//#region union & intersection

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

  public override resolved() {
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

  public override resolved() {
    return this.left.itself.constructor === this.right.itself.constructor
      ? this.left.itself.resolved()
      : Type.noType().itself.resolved(); // XXX: absolutely not
  }

}

//#endregion

export class TypeAlias extends BaseType {

  public constructor(outself: Type,
    public readonly alias: string,
    public readonly doc?: Metadata,
    public forType?: Type
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
