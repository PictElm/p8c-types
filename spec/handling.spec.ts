import { expect } from 'chai';

import { Options, parse } from 'pico8parse';
import { Scoping, VarInfo } from '../src/scoping';
import { Documenting } from '../src/documenting';
import { Handling } from '../src/handling';
import { Document } from '../src/locating';
import { TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeSome, TypeString, TypeTable, TypeTuple, TypeVararg } from '../src/typing';
import { log } from '../src/logging';

describe("handling", () => {

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

  function handleChunk(src: string) {
    Document.loadString(src, Math.random().toString());
    setupClean();
    const nothing = handling.handle(parse(src, options));
    expect(nothing).to.be.null;
  }

  function handleStatements(src: string) {
    Document.loadString(src, Math.random().toString());
    setupClean();
    const nodes = parse(src, options).body;
    nodes.forEach(node => {
      const nothing = handling.handle(node);
      expect(nothing).to.be.null;
    });
  }

  function handleExpression(src: string) {
    handleStatements(`a = ${src}`);
    return scoping.get("a");
  }

  function expectVarInfoType(info: VarInfo, constructor: any, messageWhat?: string) {
    const message = messageWhat
      ? `expected ${messageWhat} to be an instance of ${constructor.name}`
      : `expected an instance of ${constructor.name}`;
    expect(info.type.itself).to.be.instanceOf(constructor, message);
  }

  function expectLength(array: any[], length: number, typeDesc?: string) {
    const message = `expected exactly ${length} ${typeDesc ?? `item${1 < Math.abs(length) ? "s" : ""}`}`;
    expect(array).to.be.of.length(length, message);
  }

  describe("handle assignments", async () => {

    it("AssignmentStatement", () => {
      handleStatements("a = b");
    });

    it("AssignmentStatement - (1, 1)", () => {
      handleStatements("a = 1");
      expectVarInfoType(scoping.get("a"), TypeNumber, "variable");
    });

    it("AssignmentStatement - (1, 2)", () => {
      handleStatements("a = 2, 1");
      expectVarInfoType(scoping.get("a"), TypeNumber, "variable");
    });

    it("AssignmentStatement - (2, 2)", () => {
      handleStatements("a, b = 2");
      expectVarInfoType(scoping.get("a"), TypeNumber, "first variable");
      expectVarInfoType(scoping.get("b"), TypeNil, "second variable");
    });

    it("AssignmentStatement - (2, 1)", () => {
      handleStatements("a, b = 2, 1");
      expectVarInfoType(scoping.get("a"), TypeNumber, "first variable");
      expectVarInfoType(scoping.get("b"), TypeNumber, "second variable");
    });

    it("LocalStatement - (0)", () => {
      handleStatements("local a");
      expectVarInfoType(scoping.get("a"), TypeNil, "variable");
    });

    it("LocalStatement - (1)", () => {
      handleStatements("local a = 4");
      expectVarInfoType(scoping.get("a"), TypeNumber, "variable");
    });

    it("LocalStatement - (2)", () => {
      handleStatements("local a = 5, 6");
      expectVarInfoType(scoping.get("a"), TypeNumber, "variable");
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

  describe("handles function", async () => {

    it("FunctionDeclaration - as expression", () => {
      const info = handleExpression("function() end");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expect(parameters.vararg).to.be.null;

      const infos = asFunction.getReturns();
      expectVarInfoType(infos, TypeTuple, "return");
      expectLength(infos.type.as(TypeTuple)!.getInfos(), 0, "return");
    });

    it("FunctionDeclaration - as statement", () => {
      handleStatements("function a() end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expect(parameters.vararg).to.be.null;

      const infos = asFunction.getReturns();
      expectVarInfoType(infos, TypeTuple, "return");
      expectLength(infos.type.as(TypeTuple)!.getInfos(), 0, "return");
    });

    it("FunctionDeclaration - parameters", () => {
      handleStatements("function a(p) end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();

      expectLength(parameters.names, 1, "parameter name");
      expectLength(parameters.infos, 1, "parameter info");
      expect(parameters.vararg).to.be.null;

      expect(parameters.names[0]).to.be.string("p");
      expectVarInfoType(parameters.infos[0], TypeSome, "the parameter p");

      const infos = asFunction.getReturns();
      expectVarInfoType(infos, TypeTuple, "return");
      expectLength(infos.type.as(TypeTuple)!.getInfos(), 0, "return");
    });

    it("FunctionDeclaration - vararg", () => {
      handleStatements("function a(...) end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expectVarInfoType(parameters.vararg!, TypeVararg, "vararg");

      const infos = asFunction.getReturns();
      expectVarInfoType(infos, TypeTuple, "return");
      expectLength(infos.type.as(TypeTuple)!.getInfos(), 0, "return");
    });

    it("FunctionDeclaration - ReturnStatement (0)", () => {
      handleStatements("function a() return end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();
      const returns = asFunction.getReturns();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expect(parameters.vararg).to.be.null;

      expectVarInfoType(returns, TypeTuple, "return");
      expectLength(returns.type.as(TypeTuple)!.getInfos(), 0, "return");
    });

    it("FunctionDeclaration - ReturnStatement (1)", () => {
      handleStatements("function a() return 12 end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();
      const returns = asFunction.getReturns();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expect(parameters.vararg).to.be.null;

      expectVarInfoType(returns, TypeNumber, "the return");
    });

    it("FunctionDeclaration - ReturnStatement (2+)", () => {
      handleStatements("function a() return 12, 'sleep' end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();
      const returns = asFunction.getReturns();

      expectLength(parameters.names, 0, "parameter name");
      expectLength(parameters.infos, 0, "parameter info");
      expect(parameters.vararg).to.be.null;

      expectVarInfoType(returns, TypeTuple, "return");
      const infos = returns.type.as(TypeTuple)!.getInfos();
      expectLength(infos, 2, "return");
      expectVarInfoType(infos[0], TypeNumber, "first return");
      expectVarInfoType(infos[1], TypeString, "second return");
    });

    it("FunctionDeclaration - ReturnStatement (circular)", () => {
      handleStatements("function a(p) return p end");

      const info = scoping.get("a");
      expectVarInfoType(info, TypeFunction);

      const asFunction = info.type.as(TypeFunction)!;
      const parameters = asFunction.getParameters();
      const returns = asFunction.getReturns();

      expectLength(parameters.names, 1, "parameter name");
      expectLength(parameters.infos, 1, "parameter info");
      expect(parameters.vararg).to.be.null;

      expect(parameters.names[0]).to.be.string("p");
      expectVarInfoType(parameters.infos[0], TypeSome, "the parameter");

      expectVarInfoType(returns, TypeSome, "return");
      expect(returns).to.be.equal(parameters.infos[0]);
    });

    it("CallExpression", () => {
      handleExpression("a(1, 2, 3)");
    });

    it("TableCallExpression", () => {
      //handleExpression("a { a=true }"); // not implemented yet
    });

    it("StringCallExpression", () => {
      //handleExpression("a 'hello'"); // not implemented yet
    });

    it("CallStatement", () => {
      handleStatements("a()");
      // YYY: `CallStatement` handler simply calls to the
      // corresponding call expression handler
      // (so essentially same specs...)
    });

    it("CallExpression - result (1 of 1)", () => {
      handleStatements("function b() return 42 end a = b()");
      const info = scoping.get("a");

      expectVarInfoType(info, TypeNumber, "call result");
    });

    it("CallExpression - result (1 of 2)", () => {
      handleStatements("function b() return 'a', 42 end a = b()");
      const info = scoping.get("a");

      expectVarInfoType(info, TypeString, "call first result");
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

      // XXX/TODO: all of that is very temporary! (need to distinguish number from string keys)
      const asTable = info.type.as(TypeTable)!;
      expectVarInfoType(asTable.getField((1).toString()), TypeString, "index 1");
      expectVarInfoType(asTable.getField((2).toString()), TypeNumber, "index 2");
      expectVarInfoType(asTable.getField((3).toString()), TypeBoolean, "index 3");
      expectVarInfoType(asTable.getField((4).toString()), TypeTable, "index 4");
    });

    it("TableConstructorExpression - TableKey", () => {
      const info = handleExpression("{ ['b']='c', [true]=false, [12]=21 }");
      expectVarInfoType(info, TypeTable);

      //const asTable = info.type.as(TypeTable)!;
      // XXX/TODO: as always, indexing by a type
    });

    it("MemberExpression", () => {
      handleStatements("a = { b=0 } c = a.b");
      const info = scoping.get("a");

      const asTable = info.type.as(TypeTable)!;
      expectVarInfoType(info, TypeTable);
      expectVarInfoType(asTable.getField("b"), TypeNumber, "field 'b'");

      expectVarInfoType(scoping.get("c"), TypeNumber, "member expression");
    });

    it("MemberExpression - AssignmentStatement", () => {
      handleStatements("a = {} a.b = 0");
      const info = scoping.get("a");

      const asTable = info.type.as(TypeTable)!;
      expectVarInfoType(info, TypeTable);
      expectVarInfoType(asTable.getField("b"), TypeNumber, "field 'b'");
    });

    it("MemberExpression - FunctionDeclaration", () => {
      handleStatements("a = {} function a.b() end");
      const info = scoping.get("a");

      const asTable = info.type.as(TypeTable)!;
      expectVarInfoType(info, TypeTable);
      expectVarInfoType(asTable.getField("b"), TypeFunction, "field 'b'");
    });

  });

  describe("handles other", () => {

    it("Chunk - empty", () => {
      handleChunk("");
    });

    it("Chunk - comments", () => {
      handleChunk("-- nothing");
    });

    it("DoStatement", () => {
      handleChunk("do end");
    });

    it("WhileStatement", () => {
      handleChunk("while a do end");
    });

  });

});
