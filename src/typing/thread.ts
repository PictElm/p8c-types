import { TypeFunction } from './function';
import { BaseType, Type } from './internal';

export class TypeThread extends TypeFunction {

  private created: boolean = false; // YYY when set create, no longer extends TypeFunction..?!
  private signatures: TypeFunction['parameters'][];

  public constructor(
    parameters: TypeFunction['parameters'],
    ...following: TypeFunction['parameters'][]
  ) {
    super(parameters);
    this.signatures = following;
  }

  public setNextSignature(signature: TypeFunction['parameters']) {
    this.signatures.push(signature);
  }

  public getNextSignature(): TypeThread {
    const parameters = this.signatures[0] ?? this.parameters;
    const rest = this.signatures.slice(1);
    return Type.make(TypeThread, parameters, ...rest) as TypeThread;
  }

  public override toString() { return "thread"; }

  public override toJSON() {
    return {
      type: this.constructor.name,
      signatures: [this.parameters, ...this.signatures].map(parameters => ({
        parameters: {
          names: parameters.names,
          types: parameters.infos.map((it, k) => it.type.toJSON(parameters.names[k])),
        },
      }))
    };
  }

  public override resolved() {
    throw "not implemented: resolving a TypeThread";
    return { type: this };
  }

}
