import { MetaOpsType } from '../operating';
import { BaseType, Type } from './internal';

export class TypeNil extends BaseType {

  public override toString() { return "nil"; }
  public override toJSON() { return null; }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeNil);
    return BaseType.mark(info, this.outself);
  }

}

export class TypeBoolean extends BaseType {

  public override toString() { return "boolean"; }
  public override toJSON() { return null; }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeBoolean);
    return BaseType.mark(info, this.outself);
  }

}

export class TypeNumber extends BaseType {

  public override toString() { return "number"; }
  public override toJSON() { return null; }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeNumber);
    return BaseType.mark(info, this.outself);
  }

  public override metaOps: Partial<MetaOpsType> = {
    __add(left, right) {
      return { type: Type.make(TypeNumber) };
    },
  };

}

export class TypeString extends BaseType {

  public override toString() { return "string"; }
  public override toJSON() { return null; }

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeString);
    return BaseType.mark(info, this.outself);
  }

}

export class TypeLiteralBoolean extends TypeBoolean {

  constructor(outself: Type, protected value: boolean) { super(outself); }

  public override toString() { return this.value.toString(); }
  public override toJSON(): any { return this.value; }

  public resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeLiteralBoolean, this.value);
    return BaseType.mark(info, this.outself);
  }

}

export class TypeLiteralNumber extends TypeNumber {

  constructor(outself: Type, protected value: number) { super(outself); }

  public override toString() { return this.value.toString(); }
  public override toJSON(): any { return this.value; }

  public resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeLiteralNumber, this.value);
    return BaseType.mark(info, this.outself);
  }

  public override metaOps: Partial<MetaOpsType> = {
    __add(left, right) {
      const mate = right.type.itself;
      if (mate instanceof TypeLiteralNumber) {
        const add = left.type.as(TypeLiteralNumber)!.value + mate.value;
        return { type: Type.make(TypeLiteralNumber, add) };
      }
      return { type: Type.make(TypeNumber) };
    },
  };

}

export class TypeLiteralString extends TypeString {

  constructor(outself: Type, protected value: string) { super(outself); }

  public override toString() { return `'${this.value}'`; }
  public override toJSON(): any { return this.value; }

  public resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);
    info.type = Type.make(TypeLiteralString, this.value);
    return BaseType.mark(info, this.outself);
  }

}
