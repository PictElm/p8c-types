import { VarInfo } from '../scoping';
import { BaseType } from './internal';

export class TypeTuple extends BaseType {

  public constructor(protected /*readonly*/ infos: VarInfo[]) { super(); }

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
    return `[${this.infos.map(it => it.type).join(", ")}]`;
  }

  public override toJSON() {
    return {
      type: this.constructor.name,
      infos: this.infos.map((it, k) => it.type.toJSON(k.toString()))
    };
  }

  public override resolved() {
    this.infos = this.infos.map(it => it.type.resolved())
    return { type: this };
  }

}

export class TypeVararg extends TypeTuple {

  public constructor(infos?: VarInfo[]) { super(infos ?? []); } // XXX: vararg from eg. alias

  public override toString() {
    return this.infos.length
      ? `...: ${super.toString()}`
      : "...";
  }

  // public override resolved() {
  //   this.infos = this.infos.map(it => it.type.resolved())
  //   return { type: this };
  // }

}
