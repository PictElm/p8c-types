import { expect, use } from 'chai';
import chaiExclude from 'chai-exclude';
use(chaiExclude);

import { parseType } from '../src/parsing';
import { Type } from '../src/typing';

function expectCommon(o: Type | undefined, type: Type) {
  expect(o, "parsed result").to.not.be.undefined;
  expect(o?.itself, "type itself").to.be.instanceOf(type.itself.constructor);
  expect(o?.itself, "type itself").excludingEvery('_id').to.deep.equal(type.itself);
}

describe("parses primitives", () => {

  it("does", () => {
    expectCommon(parseType("nil"), Type.Nil());
    expectCommon(parseType("boolean"), Type.Boolean());
    expectCommon(parseType("number"), Type.Number());
    expectCommon(parseType("string"), Type.String());
    // expectCommon(parseType("thread"), Type.Thread());
  });

});

describe("parses tables", () => {

  it("tables", () => {
    expectCommon(parseType("{}"), Type.Table());
  });

});

describe("parses functions", () => {

  it("functions", () => {
    expectCommon(parseType("() -> []"), Type.Function([]));
  });

});
