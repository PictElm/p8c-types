import { expect, use } from 'chai';
import chaiExclude from 'chai-exclude';
use(chaiExclude);

import { parseType } from '../src/parsing';
import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeString, TypeTable } from '../src/typing';

function expectCommon(o: Type | undefined, type: Type) {
  expect(o, "parsed result").to.not.be.undefined;
  expect(o?.itself, "type itself").to.be.instanceOf(type.itself.constructor);
  expect(o?.itself, "type itself").excludingEvery('_id').to.deep.equal(type.itself);
}

describe("parses primitives", () => {

  it("does", () => {
    expectCommon(parseType("nil"), Type.make(TypeNil));
    expectCommon(parseType("boolean"), Type.make(TypeBoolean));
    expectCommon(parseType("number"), Type.make(TypeNumber));
    expectCommon(parseType("string"), Type.make(TypeString));
    // expectCommon(parseType("thread"), Type.make(TypeThread));
  });

});

describe("parses tables", () => {

  it("tables", () => {
    expectCommon(parseType("{}"), Type.make(TypeTable));
  });

});

describe("parses functions", () => {

  it("functions", () => {
    expectCommon(parseType("() -> []"), Type.make(TypeFunction, []));
  });

});
