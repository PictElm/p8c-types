import { expect } from 'chai';

import { Options, parse } from 'pico8parse';
import { Scoping, VarInfo } from '../src/scoping';
import { Documenting } from '../src/documenting';
import { Handling } from '../src/handling';
import { Document } from '../src/locating';
import { TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeSome, TypeString, TypeTable } from '../src/typing';
import { log } from '../src/logging';

log.level = 'none';

const options: Partial<Options> = {
  comments: true,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

let scoping: Scoping;
let documenting: Documenting;
let handling: Handling;

function setupClean(): [Scoping, Documenting, Handling] {
  scoping = new Scoping();
  documenting = new Documenting();
  handling = new Handling(scoping, documenting);
  return [scoping, documenting, handling];
}

function handleStatement(src: string, nth: number = 0) {
  Document.loadString(src, Math.random().toString());
  setupClean();
  const node = parse(src, options).body[nth];
  const r = handling.handle(node);
  expect(r).to.be.of.length(0, "statement handling returned non expected var info");
  return r;
}

function handleExpression(src: string) {
  handleStatement(`a = ${src}`);
  return scoping.get("a");
}

function expectVarInfoType(info: VarInfo, constructor: any, messageWhat?: string) {
  const message = messageWhat
    ? `expected ${messageWhat} to be an instance of ${constructor.prototype.name}`
    : `expected an instance of ${constructor.prototype.name}`;
  expect(info.type.itself).to.be.instanceOf(constructor, message);
}

function expectLength(array: any[], length: number, typeDesc?: string) {
  const message = `expected exactly ${length} ${typeDesc ?? `item${1 < Math.abs(length) ? "s" : ""}`}`;
  expect(array).to.be.of.length(length, message);
}

describe("(some basic stuff for other tests)", async () => {

  it("AssignmentStatement", () => {
    handleStatement("a = b");
  });

});

describe("handles basic expressions", async () => {

  it("StringLiteral", () => {
    const info = handleExpression("'hey'");
    expectVarInfoType(info, TypeString);
  });

  it("NumericLiteral", () => {
    const info = handleExpression("42");
    expectVarInfoType(info, TypeNumber);
  });

  it("BooleanLiteral", () => {
    const info = handleExpression("false");
    expectVarInfoType(info, TypeBoolean);
  });

  it("NilLiteral", () => {
    const info = handleExpression("nil");
    expectVarInfoType(info, TypeNil);
  });

});

describe("handles tables", async () => {

  it("TableConstructorExpression", () => {
    const info = handleExpression("{}");
    expectVarInfoType(info, TypeTable);

    //const asTable = info.type.as(TypeTable)!;
    // YYY: no proper way to check the content (expecting it to be empty)
  });

  it("TableConstructorExpression - TableKeyString", () => {
    const info = handleExpression("{ a=true }");
    expectVarInfoType(info, TypeTable);

    const asTable = info.type.as(TypeTable)!;
    expectVarInfoType(asTable.getField("a"), TypeBoolean, "field 'a'");
  });

  it("TableConstructorExpression - TableValue", () => {
    const info = handleExpression("{ 'hey', 42, false, {} }");
    expectVarInfoType(info, TypeTable);

    const asTable = info.type.as(TypeTable)!;
    expectVarInfoType(asTable.getIndex(1), TypeString, "index 1");
    expectVarInfoType(asTable.getIndex(2), TypeNumber, "index 2");
    expectVarInfoType(asTable.getIndex(3), TypeBoolean, "index 3");
    expectVarInfoType(asTable.getIndex(4), TypeTable, "index 4");
  });

  it("TableConstructorExpression - TableKey", () => {
    const info = handleExpression("{ ['b']='c', [true]=false, [12]=21 }");
    expectVarInfoType(info, TypeTable);

    //const asTable = info.type.as(TypeTable)!;
    // XXX/TODO: as always, indexing by a type
  });

});

describe("handles function", async () => {

  it("FunctionDeclaration - as expression", () => {
    const info = handleExpression("function() end");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    expectLength(asFunction.getParameters(), 0, "parameter");
    expectLength(asFunction.getReturns(), 0, "return");
  });

  it("FunctionDeclaration - as statement", () => {
    handleStatement("function a() end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    expectLength(asFunction.getParameters(), 0, "parameter");
    expectLength(asFunction.getReturns(), 0, "return");
  });

  it("FunctionDeclaration - parameters", () => {
    handleStatement("function a(p) end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    const parameters = asFunction.getParameters();

    expectLength(parameters, 1, "parameter");
    expect(parameters[0][0]).to.be.string("p");
    expectVarInfoType(parameters[0][1], TypeSome, "the parameter");

    expectLength(asFunction.getReturns(), 0, "return");
  });

  it("FunctionDeclaration - ReturnStatement (0)", () => {
    handleStatement("function a() return end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    const returns = asFunction.getReturns();

    expectLength(asFunction.getParameters(), 0, "parameter");

    expectLength(returns, 0, "return");
  });

  it("FunctionDeclaration - ReturnStatement (1)", () => {
    handleStatement("function a() return 12 end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    const returns = asFunction.getReturns();

    expectLength(asFunction.getParameters(), 0, "parameter");

    expectLength(returns, 1, "return");
    expectVarInfoType(returns[0], TypeNumber, "the return");
  });

  it("FunctionDeclaration - ReturnStatement (2+)", () => {
    handleStatement("function a() return 12, 'sleep' end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    const returns = asFunction.getReturns();

    expectLength(asFunction.getParameters(), 0, "parameter");

    expectLength(returns, 2, "return");
    expectVarInfoType(returns[0], TypeNumber, "first return");
    expectVarInfoType(returns[1], TypeString, "second return");
  });

  it("FunctionDeclaration - ReturnStatement (circular)", () => {
    handleStatement("function a(p) return p end");

    const info = scoping.get("a");
    expectVarInfoType(info, TypeFunction);

    const asFunction = info.type.as(TypeFunction)!;
    const parameters = asFunction.getParameters();
    const returns = asFunction.getReturns();

    expectLength(parameters, 1, "parameter");
    expect(parameters[0][0]).to.be.string("p");
    expectVarInfoType(parameters[0][1], TypeSome, "the parameter");

    expectLength(returns, 1, "return");
    expectVarInfoType(returns[0], TypeSome, "the return");
  });

  it("CallExpression", () => {
    handleExpression("a(1, 2, 3)");
  });

  it("TableCallExpression", () => {
    handleExpression("a { a=true }");
  });

  it("StringCallExpression", () => {
    handleExpression("a 'hello'");
  });

  it("CallStatement", () => {
    handleStatement("a()");
    // YYY: `CallStatement` handler simply calls to the
    // corresponding call expression handler
    // (so essentially same specs...)
  });

});
