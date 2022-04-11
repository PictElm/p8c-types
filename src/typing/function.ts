import assert from 'assert';
import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { BaseType, Type, TypeSome, TypeTuple } from './internal';

export class TypeFunction extends BaseType {

  protected returns: VarInfo = { type: Type.noType() }; //{ type: Type.make(TypeTuple, []) };

  public constructor(
    protected parameters: { names: string[], infos: VarInfo[], vararg: VarInfo | null }
  ) { super(); }

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
  public getReturns(applying: VarInfo[]): VarInfo {
    const toRevert: TypeSome[] = [];
    // const toRevert: [TypeSome, VarInfo|undefined][] = [];

    // TODO/IDK: cheat the parameter of the function
    // under the key of this function?

    this.parameters.infos.forEach((info, k) => {
      if (info.type instanceof TypeSome) {
        toRevert.push(info.type);
        // toRevert.push([info.type, info.type.acts]);
        info.type.actsAs(applying[k]);
      }
    });

    const r = this.returns.type.resolved();

    toRevert.forEach(type => type.revert());
    // toRevert.forEach(([type, info]) => type.actsAs(info!));

    return r;
  }

  /** when set do not compute (there is a circular reference somewhere) */
  private loopProtection: boolean = false;
  public override toString() {
    if (this.loopProtection) return "*" + this._id; // YYY: _id
    this.loopProtection = true;

    const parameters = this.parameters
      .names
      .map((name, k) => `${name}: ${this.parameters.infos[k].type}`)
      .join(", ");

    const toRevert: TypeSome[] = [];

    // this.parameters.infos.forEach(info => {
    //   if (info.type instanceof TypeSome) {
    //     toRevert.push(info.type);
    //     info.type.actsAs(info);
    //   }
    // });

    const returns = `${this.returns.type}`;

    toRevert.forEach(type => type.revert());

    const r = `(${parameters}) -> ${returns}`;
    this.loopProtection = false;
    return r;
  }

  public override toJSON(): unknown {
    return {
      type: this.constructor.name,
      parameters: {
        names: this.parameters.names,
        types: this.parameters.infos.map((it, k) => it.type.toJSON(this.parameters.names[k])),
      },
      returns: this.returns.type.toJSON('return'),
    };
  }

  public override resolved() {
    if (this.loopProtection) return { type: this };
    this.loopProtection = true;

    // this.parameters.infos = this.parameters.infos.map(it => it.type.resolved());

    this.setReturns([this.returns.type.resolved()]);

    this.loopProtection = false;
    return { type: this };
  }

  public override metaOps: Partial<MetaOpsType> = {
    __call(self, parameters) {
      assert(self.type instanceof TypeFunction, "not a TypeFunction, but a " + self.type.constructor.name);
      return self.type.getReturns(parameters);
    },
  };

}
