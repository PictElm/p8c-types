import { expect } from 'chai';

import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeString, TypeTable } from '../src/typing';

const expectString = (object: unknown) => expect(`${object}`);

describe("represents primitives", () => {

  it("does", () => {
    expectString(Type.make(TypeNil).itself).to.equal("nil");
    expectString(Type.make(TypeBoolean).itself).to.equal("boolean");
    expectString(Type.make(TypeNumber).itself).to.equal("number");
    expectString(Type.make(TypeString).itself).to.equal("string");
    // expectString(Type.make(TypeThread).itself).to.equal("thread");
  });

});

describe("represents tables", () => {

  it("tables", () => {
    expectString(Type.make(TypeTable).itself).to.equal("{}");

    const a = Type.make(TypeTable).as(TypeTable)!;
    a.setField("key", { type: Type.make(TypeBoolean) })
    expectString(a).to.equal("{ key: boolean }");
  });

});

describe("represents functions", () => {

  it("simple", () => {
    expectString(Type.make(TypeFunction, []).itself).to.equal("() -> []");
  });

  it("parameter - (1)", () => {
    expectString(Type.make(TypeFunction["p"]).itself).to.equal("(p: <p>) -> []");
  });

  it("return - (1)", () => {
    const a = Type.make(TypeFunction, []).as(TypeFunction)!;
    a.setReturns([{ type: Type.make(TypeBoolean) }]);
    expectString(a).to.equal("() -> [boolean]");
  });

  it("circular", () => {
    const b = Type.make(TypeFunction["p"]).as(TypeFunction)!;
    b.setReturns([b.getParameters()[0][1]]);
    expectString(b).to.equal("(p: <p>) -> [<p>]");
  });

});
