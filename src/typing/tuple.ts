import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type } from './internal';

export class TypeTuple extends BaseType {

  public constructor(outself: Type,
    protected readonly infos: VarInfo[]
  ) { super(outself); }

  public getInfos() {
    return this.infos;
  }

  public override toString() {
    return `[${this.infos.map(it => it.type.itself).join(", ")}]`;
  }

  public override toJSON() {
    return this.infos.map((it, k) => it.type.toJSON(k.toString()));
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeTuple, this.infos.map(it => ({
      type: it.type.itself.resolved(),
      doc: it.doc,
    }))));
  }

}

export class TypeVararg extends TypeTuple {

  public constructor(outself: Type, infos?: VarInfo[]) { super(outself, infos ?? []); } // XXX: vararg from eg. alias

  public override toString() {
    return this.infos.length
      ? `...: ${super.toString()}`
      : "...";
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeVararg, this.infos));
  }

}
