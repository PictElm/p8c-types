import { expect } from 'chai';

import { Type, TypeFunction, TypeTable } from '../src/typing';

const expectString = (object: unknown) => expect(`${object}`);

describe("represents primitives", () => {

  it("does", () => {
    expectString(Type.Nil().itself).to.equal("nil");
    expectString(Type.Boolean().itself).to.equal("boolean");
    expectString(Type.Number().itself).to.equal("number");
    expectString(Type.String().itself).to.equal("string");
    // expectString(Type.Thread().itself).to.equal("thread");
  });

});

describe("represents tables", () => {

  it("tables", () => {
    expectString(Type.Table().itself).to.equal("{}");

    const a = Type.Table().as(TypeTable)!;
    a.setField("key", { type: Type.Boolean() })
    expectString(a).to.equal("{ key: boolean }");
  });

});

describe("represents functions", () => {

  it("simple", () => {
    expectString(Type.Function([]).itself).to.equal("() -> []");
  });

  it("parameter - (1)", () => {
    expectString(Type.Function(["p"]).itself).to.equal("(p: <p>) -> []");
  });

  it("return - (1)", () => {
    const a = Type.Function([]).as(TypeFunction)!;
    a.setReturns([{ type: Type.Boolean() }]);
    expectString(a).to.equal("() -> [boolean]");
  });

  it("circular", () => {
    const b = Type.Function(["p"]).as(TypeFunction)!;
    b.setReturns([b.getParameters()[0][1]]);
    expectString(b).to.equal("(p: <p>) -> [<p>]");
  });

});
