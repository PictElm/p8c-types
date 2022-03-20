import { VarInfo } from '../scoping';
import { BaseType, Type } from './internal';

export class TypeTuple extends BaseType {

  public constructor(outself: Type,
    protected /*readonly*/ infos: VarInfo[]
  ) { super(outself); }

  public getInfos() {
    return this.infos;
  }

  public override toString() {
    // XXX: would need loopProtection, but there is no way (as of now)
    // to construct a circular tuple type (that i can think of)
    // ```
    // function a() return a(), 0 end
    // ```
    // the type of a, within its own scope, is not entirely defined
    // in particular its return type is simply an empty tuple...
    // note that is also affects the .resolved, but here circularity is
    // already handled (with the marking mechanism)
    return `[${this.infos.map(it => it.type.itself).join(", ")}]`;
  }

  public override toJSON() {
    return this.infos.map((it, k) => it.type.toJSON(k.toString()));
  }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);

    info.type = Type.make(TypeTuple, []);
    const asTuple = info.type.as(TypeTuple)!;

    asTuple.infos = this.infos.map(it => it.type.itself.resolved());

    return BaseType.mark(info, this.outself);
  }

}

export class TypeVararg extends TypeTuple {

  public constructor(outself: Type, infos?: VarInfo[]) { super(outself, infos ?? []); } // XXX: vararg from eg. alias

  public override toString() {
    return this.infos.length
      ? `...: ${super.toString()}`
      : "...";
  }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);

    info.type = Type.make(TypeVararg, []);
    const asTuple = info.type.as(TypeVararg)!;

    asTuple.infos = this.infos.map(it => it.type.itself.resolved());

    return BaseType.mark(info, this.outself);
  }

}
