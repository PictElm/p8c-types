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
  });

  it("functions", () => {
    expectString(new TypeFunction([])).to.equal("() -> []");
  });

});
