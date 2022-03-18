import { TypeFunction } from './function';
import { BaseType, Resolved, Type } from './internal';

export class TypeThread extends TypeFunction {

  private created: boolean = false; // YYY when set create, no longer extends TypeFunction..?!
  private signatures: TypeFunction['parameters'][];

  public constructor(outself: Type,
    parameters: TypeFunction['parameters'],
    ...following: TypeFunction['parameters'][]
  ) {
    super(outself, parameters);
    this.signatures = following;
  }

  public setNextSignature(signature: TypeFunction['parameters']) {
    this.signatures.push(signature);
  }

  public getNextSignature(): TypeThread {
    const parameters = this.signatures[0] ?? this.parameters;
    const rest = this.signatures.slice(1);
    return Type.make(TypeThread, parameters, ...rest).itself as TypeThread;
  }

  public override toString() { return "thread"; }

  public override toJSON() {
    return {
      signatures: [this.parameters, ...this.signatures].map(parameters => ({
        parameters: {
          names: parameters.names,
          types: parameters.infos.map((it, k) => it.type.toJSON(parameters.names[k])),
        },
      }))
    };
  }

  public override resolved(): Resolved {
    return BaseType.mark(Type.make(TypeThread, this.signatures[0], ...this.signatures.slice(1)));
  }

}
