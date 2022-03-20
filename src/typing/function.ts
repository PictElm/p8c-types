import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type, TypeSome } from './internal';
import { TypeTuple } from './tuple';

export class TypeFunction extends BaseType {

  protected returns: VarInfo = { type: Type.make(TypeTuple, []) };

  /**
   * when set do not compute (there is a circular reference somewhere)
   * 
   * @see TypeFunction#toString
   * @see TypeFunction#resolved
   */
  private loopProtection: boolean = false;

  public constructor(outself: Type,
    protected parameters: { names: string[], infos: VarInfo[], vararg: VarInfo | null }
  ) { super(outself); }

  /** get the parameters info */
  public getParameters() {
    return this.parameters;
  }

  /** update the returns (tuple) info */
  public setReturns(infos: VarInfo[]) {
    // XXX: unpack tuple here? (if info[0] instanceof TypTuple)
    this.returns = 1 === infos.length
      ? infos[0]
      : { type: Type.make(TypeTuple, infos) };
  }

  /**
   * get the returns (tuple) info
   * 
   * if `applying` is provided, first resolves the info
   * as if the function was called with these as parameters
   * 
   * @param applying info for the parameters of the (Lua) function
   */
  public getReturns(applying?: VarInfo[]): VarInfo {
    if (!applying) return this.returns;

    const toRevert: TypeSome[] = [];

    this.parameters.infos.forEach((info, k) => {
      if (info.type.itself instanceof TypeSome) {
        toRevert.push(info.type.itself);
        info.type.itself.actsAs(applying[k]);
      }
    });

    const r = {
      type: this.returns.type.itself.resolved(),
      doc: this.returns.doc,
    };

    toRevert.forEach(type => type.revert());

    return r;
  }

  public override toString() {
    if (this.loopProtection) return "*" + this.outself.toString(); // YYY: _id
    this.loopProtection = true;

    const parameters = this.parameters
      .names
      .map((name, k) => `${name}: ${this.parameters.infos[k].type.itself}`)
      .join(", ");

    const toRevert: TypeSome[] = [];

    this.parameters.infos.forEach(info => {
      if (info.type.itself instanceof TypeSome) {
        toRevert.push(info.type.itself);
        info.type.itself.actsAs(info);
      }
    });

    const returns = `${this.returns.type.itself}`;
    // const asTuple = this.returns.type.as(TypeTuple);
    // const returns = asTuple
    //   ? `${asTuple}`
    //   : `[${this.returns.type.itself}]`; // YYY: keep the "[]"?

    toRevert.forEach(type => type.revert());

    const r = `(${parameters}) -> ${returns}`;
    this.loopProtection = false;
    return r;
  }

  public override toJSON(): unknown {
    return {
      parameters: {
        names: this.parameters.names,
        types: this.parameters.infos.map((it, k) => it.type.toJSON(this.parameters.names[k])),
      },
      returns: this.returns.type.toJSON('return'),
    };
  }

  public override resolved(): Resolved {
    if (this.loopProtection) return Type.noType().itself.resolved();
    this.loopProtection = true;

    const r = Type.make(TypeFunction, this.parameters);
    const functionType = r.as(TypeFunction)!;

    const asTuple = this.returns.type.as(TypeTuple);
    if (asTuple) { // XXX/TODO/FIXME: all wrong, very likely
      const returns = asTuple.getInfos().map(ret => {
        const k = this.parameters.infos.findIndex(par => par === ret);
        if (-1 < k) return functionType.parameters.infos[k]; // ret itself _is_ a param of this

        throw "hey"; // XXX/TODO/FIXME/...: find a way to trigger that
        // summary:
        //  if a this param somewhere in the type description of ret,
        //  it needs to be replaced with the corresponding r param
      });
      functionType.setReturns(returns);
    } else functionType.setReturns([{
        type: this.returns.type.itself.resolved(),
        doc: this.returns.doc,
      }]);

    this.loopProtection = false;
    return BaseType.mark(r);
  }

  public override metaOps: Partial<MetaOpsType> = {
    __call(self, parameters) {
      const asFunction = self.type.as(TypeFunction)!;
      return asFunction.getReturns(parameters);
    },
  };

}
