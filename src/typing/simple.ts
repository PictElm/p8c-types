import { BaseType, Resolved, Type } from './internal';

export class TypeNil extends BaseType {

  public override toString() { return "nil"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeNil)); }

}

export class TypeBoolean extends BaseType {

  public override toString() { return "boolean"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeBoolean)); }

}

export class TypeNumber extends BaseType {

  public override toString() { return "number"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeNumber)); }

}

export class TypeString extends BaseType {

  public override toString() { return "string"; }
  public override toJSON() { return null; }
  public override resolved(): Resolved { return BaseType.mark(Type.make(TypeString)); }

}

// XXX: keep?
/** underlying abstract class for literal types (boolean, number, string) */
abstract class BaseTypeLiteral<Eq> extends BaseType {

  public constructor(outself: Type,
    protected value: Eq
  ) { super(outself); }

  public setLiterals(literal: Eq) {
    this.value = literal;
  }

  public getLiterals() {
    return this.value;
  }

}

export class TypeLiteralBoolean extends BaseTypeLiteral<boolean> {

  public override toString() { return this.value.toString(); }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralBoolean, this.value));
  }

}

export class TypeLiteralNumber extends BaseTypeLiteral<number> {

  public override toString() { return this.value.toString(); }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralNumber, this.value));
  }

}

export class TypeLiteralString extends BaseTypeLiteral<string> {

  public override toString() { return `'${this.value}'`; }
  public override toJSON() { return this.value; }

  public resolved(): Resolved {
    return BaseType.mark(Type.make(TypeLiteralString, this.value));
  }

}
