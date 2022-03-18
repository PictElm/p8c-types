import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type, TypeSome } from './internal';

export class TypeFunction extends BaseType {

  protected returns: VarInfo[] = [];

  public constructor(outself: Type,
    protected parameters: { names: string[], infos: VarInfo[], vararg: VarInfo | null }
  ) { super(outself); }

  /** get the parameters info */
  public getParameters() {
    return this.parameters;
  }

  /** update the returns (tuple) info */
  public setReturns(infos: VarInfo[]) {
    this.returns = infos;
  }

  /**
   * get the returns (tuple) info
   * 
   * if `applying` is provided, first resolves the info
   * as if the function was called with these as parameters
   * 
   * @param applying info for the parameters of the (Lua) function
   */
  public getReturns(applying?: VarInfo[]): VarInfo[] {
    if (!applying) return this.returns;

    const toRevert: TypeSome[] = [];

    this.parameters.infos.forEach((info, k) => {
      if (info.type.itself instanceof TypeSome) {
        toRevert.push(info.type.itself);
        info.type.itself.actsAs(applying[k]);
      }
    });

    const r = this.returns.map(info => ({
      type: info.type.itself.resolved(),
      doc: info.doc,
    })); // XXX: tuple gap

    toRevert.forEach(type => type.revert());

    return r
  }

  public override toString() {
    const parameters = this.parameters
      .names
      .map((name, k) => `${name}: ${this.parameters.infos[k].type.itself}`)
      .join(", ");

    let returns: string = "";
    if (this.returns.length) {
      const toRevert: TypeSome[] = [];

      this.parameters.infos.forEach(info => {
        if (info.type.itself instanceof TypeSome) {
          toRevert.push(info.type.itself);
          info.type.itself.actsAs(info);
        }
      });

      returns = this.returns
        .map(info => `${info.type.itself}`)
        .join(", "); // XXX: tuple gap [?]

      toRevert.forEach(type => type.revert());
    }

    return `(${parameters}) -> [${returns}]`;
  }

  public override toJSON(): unknown {
    return {
      parameters: {
        names: this.parameters.names,
        types: this.parameters.infos.map((it, k) => it.type.toJSON(this.parameters.names[k])),
      },
      returns: this.returns.map((it, k) => it.type.toJSON(k.toString())),
    };
  }

  public override resolved(): Resolved {
    const r = Type.make(TypeFunction, this.parameters);
    const functionType = r.as(TypeFunction)!;

    const returns = this.returns.map(ret => {
      const k = this.parameters.infos.findIndex(par => par === ret);
      if (-1 < k) return functionType.parameters.infos[k]; // ret itself _is_ a param of this

      throw "hey"; // XXX/TODO/FIXME/...: find a way to trigger that
      // summary:
      //  if a this param somewhere in the type description of ret,
      //  it needs to be replaced with the corresponding r param
    });
    functionType.setReturns(returns);

    return BaseType.mark(r);
  }

}
