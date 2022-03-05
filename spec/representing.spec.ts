import { expect } from 'chai';

import { TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeString, TypeTable } from '../src/typing';

describe("represent", () => {

  const expectString = (object: unknown) => expect(`${object}`);

  it("primitives", () => {
    expectString(new TypeNil()).to.equal("nil");
    expectString(new TypeBoolean()).to.equal("boolean");
    expectString(new TypeNumber()).to.equal("number");
    expectString(new TypeString()).to.equal("string");
    // expectString(new TypeThread()).to.equal("thread");
  });

  it("tables", () => {
    expectString(new TypeTable()).to.equal("{}");

    const a = new TypeTable();
    a.setField("key", new TypeBoolean())
    expectString(a).to.equal("{ key: boolean }");
  });

  it("functions", () => {
    expectString(new TypeFunction([])).to.equal("() -> []");

    expectString(new TypeFunction(["p"])).to.equal("(p: <p>) -> []");

    const a = new TypeFunction([]);
    a.setReturns([new TypeBoolean]);
    expectString(a).to.equal("() -> [boolean]");

    const b = new TypeFunction(["p"]);
    b.setReturns([b.getParameters()[0][1]]);
    expectString(b).to.equal("(p: <p>) -> [<p>]");
  });

});
