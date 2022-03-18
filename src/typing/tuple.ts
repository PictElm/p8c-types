import { BaseType, Resolved, Type } from './internal';

export class TypeTuple extends BaseType {

  public constructor(outself: Type,
    protected readonly types: Type[]
  ) { super(outself); }

  public getTypes() {
    return this.types;
  }

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

export class TypeVararg extends TypeTuple {

  public constructor(outself: Type, types?: Type[]) { super(outself, types ?? []); }

  public override toString() {
    return this.types.length
      ? `...: ${super.toString()}`
      : "...";
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeVararg, this.types));
  }

}
