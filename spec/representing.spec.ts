import { expect } from 'chai';

import { Type, TypeFunction, TypeTable } from '../src/typing';

describe("represent", () => {

  const expectString = (object: unknown) => expect(`${object}`);

  it("primitives", () => {
    expectString(Type.Nil()).to.equal("nil");
    expectString(Type.Boolean()).to.equal("boolean");
    expectString(Type.Number()).to.equal("number");
    expectString(Type.String()).to.equal("string");
    // expectString(Type.Thread()).to.equal("thread");
  });

  it("tables", () => {
    expectString(Type.Table()).to.equal("{}");

    const a = Type.Table().as(TypeTable);
    a.setField("key", { type: Type.Boolean() })
    expectString(a).to.equal("{ key: boolean }");
  });

  it("functions", () => {
    expectString(Type.Function([])).to.equal("() -> []");

    expectString(Type.Function(["p"])).to.equal("(p: <p>) -> []");

    const a = Type.Function([]).as(TypeFunction);
    a.setReturns([{ type: Type.Boolean() }]);
    expectString(a).to.equal("() -> [boolean]");

    const b = Type.Function(["p"]).as(TypeFunction);
    b.setReturns([b.getParameters()[0][1]]);
    expectString(b).to.equal("(p: <p>) -> [<p>]");
  });

});
