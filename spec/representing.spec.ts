import { expect } from 'chai';

import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeSome, TypeString, TypeTable } from '../src/typing';

describe("representing", () => {

  const expectString = (object: unknown) => expect(`${object}`);

  describe("represents primitives", () => {

    it("does", () => {
      expectString(Type.make(TypeNil)).to.equal("nil");
      expectString(Type.make(TypeBoolean)).to.equal("boolean");
      expectString(Type.make(TypeNumber)).to.equal("number");
      expectString(Type.make(TypeString)).to.equal("string");
      // expectString(Type.make(TypeThread)).to.equal("thread");
    });

  });

  describe("represents tables", () => {

    it("tables", () => {
      expectString(Type.make(TypeTable)).to.equal("{}");

      const a = Type.make(TypeTable).as(TypeTable)!;
      a.setField("key", { type: Type.make(TypeBoolean) })
      expectString(a).to.equal("{ key: boolean }");
    });

  });

  describe("represents functions", () => {

    it("simple", () => {
      expectString(Type.make(TypeFunction, { names: [], infos: [], vararg: null })).to.equal("() -> []");
    });

    it("parameter - (1)", () => {
      const params = { names: ["p"], infos: [{ type: Type.make(TypeSome, "p") }], vararg: null };
      expectString(Type.make(TypeFunction, params)).to.equal("(p: <p>) -> []");
    });

    it("return - (1)", () => {
      const a = Type.make(TypeFunction, { names: [], infos: [], vararg: null }).as(TypeFunction)!;
      a.setReturns([{ type: Type.make(TypeBoolean) }]);
      expectString(a).to.equal("() -> boolean");
    });

    it("circular", () => {
      const params = { names: ["p"], infos: [{ type: Type.make(TypeSome, "p") }], vararg: null };
      const b = Type.make(TypeFunction, params).as(TypeFunction)!;
      b.setReturns(b.getParameters().infos);
      expectString(b).to.equal("(p: <p>) -> <p>");
    });

  });

});
