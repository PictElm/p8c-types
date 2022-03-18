import assert from 'assert';
import { TypeSomeOp } from '../operating';
import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type } from './internal';

/**
 * represents a yet-unknown type, especially a function's parameters,
 * to which one (or more) operations are performed
 * 
 * using the `actsAs` method enables resolving to what it would be if
 * the type `acts` as was applied the operations `done` to `this`
 */
 export class TypeSome extends BaseType {

  private acts?: VarInfo;
  private done?: TypeSomeOp;

  public constructor(outself: Type,
    private from?: string
  ) { super(outself); }

  /** in-place applied (the type is modified) */
  public setApplied(operation: TypeSomeOp) {
    if (this.done) this.done.then(operation);
    else this.done = operation;
  }

  /** not in-place applied (a new type is created) */
  public getApplied(operation: TypeSomeOp) {
    //const repr = this.from && operation.represent(this.from);
    const r = { type: Type.make(TypeSome) };
    const someType = r.type.as(TypeSome)!;

    // "acts as `this` with `operation` `done` on it"
    someType.acts = { type: this.outself }; // XXX: doc gap
    someType.done = operation;

    return r;
  }

  public actsAs(type: VarInfo) {
    assert(!this.acts, "TypeSome.as: already acts as " + this.acts);
    this.acts = type;
  }
  public revert() {
    assert(this.acts, "TypeSome.revert: not acting as anything");
    this.acts = undefined;
  }

  public override toString(): string {
    if (!this.acts) return `<${this.from ?? "?"}>`;
    if (!this.done) return this === this.acts.type.itself
        ? `<${this.from ?? "?"}>`
        : `${this.acts.type.itself}`;

    const what = this.done;
    const to = this === this.acts.type.itself
      ? `<${this.from ?? "?"}>`
      : `${this.acts.type.itself}`;

    return what.represent(to);
  }

  public override toJSON() {
    return {
      acts: this.acts?.type.toJSON('acts'),
      from: this.from ?? null,
      done: this.done?.constructor.name ?? null,
    };
  }

  public override resolved(): Resolved {
    if (!this.acts) return Type.noType().itself.resolved();
    if (!this.done) return this === this.acts.type.itself
        ? BaseType.mark(this.outself)
        : this.acts.type.itself.resolved();

    const what = this.done;
    const to = this === this.acts.type.itself
      ? BaseType.mark(this.outself)
      : this.acts.type.itself.resolved();

    return what.resolve(to);
  }

}
