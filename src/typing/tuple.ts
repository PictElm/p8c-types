import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type } from './internal';

export class TypeTuple extends BaseType {

  public constructor(outself: Type,
    protected readonly types: VarInfo[]
  ) { super(outself); }

  public getTypes() {
    return this.types;
  }

  public override toString() {
    return `[${this.types.map(it => it.type.itself).join(", ")}]`;
  }

  public override toJSON() {
    return this.types.map((it, k) => it.type.toJSON(k.toString()));
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeTuple, this.types.map(it => ({
      type: it.type.itself.resolved(),
      doc: it.doc,
    }))));
  }

}

export class TypeVararg extends TypeTuple {

  public constructor(outself: Type, types?: VarInfo[]) { super(outself, types ?? []); } // XXX: vararg from eg. alias

  public override toString() {
    return this.types.length
      ? `...: ${super.toString()}`
      : "...";
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeVararg, this.types));
  }

}
