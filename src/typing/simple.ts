import { MetaOpsType } from '../operating';
import { BaseType, Type } from './internal';

export class TypeNil extends BaseType {

  public override toString() { return "nil"; }
  public override toJSON() {
    return {
      type: this.constructor.name,
    };
  }

}

export class TypeBoolean extends BaseType {

  public override toString() { return "boolean"; }
  public override toJSON() {
    return {
      type: this.constructor.name,
    };
  }

}

export class TypeNumber extends BaseType {

  public override toString() { return "number"; }
  public override toJSON() {
    return {
      type: this.constructor.name,
    };
  }

  public override metaOps: Partial<MetaOpsType> = {
    __add(left, right) {
      return { type: Type.make(TypeNumber) };
    },
  };

}

export class TypeString extends BaseType {

  public override toString() { return "string"; }
  public override toJSON() {
    return {
      type: this.constructor.name,
    };
  }

}

export class TypeLiteralBoolean extends TypeBoolean {

  constructor(protected value: boolean) { super(); }

  public override toString() { return this.value.toString(); }
  public override toJSON(): any {
    return {
      type: this.constructor.name,
      value: this.value,
    };
  }

}

export class TypeLiteralNumber extends TypeNumber {

  constructor(protected value: number) { super(); }

  public override toString() { return this.value.toString(); }
  public override toJSON(): any {
    return {
      type: this.constructor.name,
      value: this.value,
    };
  }

  public override metaOps: Partial<MetaOpsType> = {
    __add(left, right) {
      const l = left.type;
      const r = right.type;
      if (l instanceof TypeLiteralNumber && r instanceof TypeLiteralNumber)
        return { type: Type.make(TypeLiteralNumber, l.value + r.value) };
      return { type: Type.make(TypeNumber) };
    },
  };

}

export class TypeLiteralString extends TypeString {

  constructor(protected value: string) { super(); }

  public override toString() { return `'${this.value}'`; }
  public override toJSON(): any {
    return {
      type: this.constructor.name,
      value: this.value,
    };
  }

}
