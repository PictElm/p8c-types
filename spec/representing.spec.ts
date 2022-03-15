import { expect } from 'chai';

import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeSome, TypeString, TypeTable } from '../src/typing';

describe("representing", () => {

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
      expectString(Type.make(TypeFunction, { names: [], infos: [], vararg: null }).itself).to.equal("() -> []");
    });

    it("parameter - (1)", () => {
      const params = { names: ["p"], infos: [{ type: Type.make(TypeSome, "p") }], vararg: null };
      expectString(Type.make(TypeFunction, params).itself).to.equal("(p: <p>) -> []");
    });

    it("return - (1)", () => {
      const a = Type.make(TypeFunction, { names: [], infos: [], vararg: null }).as(TypeFunction)!;
      a.setReturns([{ type: Type.make(TypeBoolean) }]);
      expectString(a).to.equal("() -> [boolean]");
    });

    it("circular", () => {
      const params = { names: ["p"], infos: [{ type: Type.make(TypeSome, "p") }], vararg: null };
      const b = Type.make(TypeFunction, params).as(TypeFunction)!;
      b.setReturns([b.getParameters().infos[0]]);
      expectString(b).to.equal("(p: <p>) -> [<p>]");
    });

  });

});
