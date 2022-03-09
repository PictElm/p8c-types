import assert from 'assert';
import { ast } from 'pico8parse';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Documenting } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { TypeSomeOp } from './operating';
import { LocateReason, Scoping, VarInfo } from './scoping';
import { Type, TypeFunction, TypeTable, TypeSome } from './typing';

type FindByTType<Union, TType> = Union extends { type: TType } ? Union : never;
type Handler<T> = (node: T) => VarInfo[]

interface HandlingEvents {
  'handle': (node: ast.Node) => void;
}

export class Handling extends TypedEmitter<HandlingEvents> {

  public constructor(
    private readonly scope: Scoping,
    private readonly doc: Documenting
  ) { super(); }

  public handle<T extends ast.Node>(node: T): VarInfo[] | never {
    assert(node, "Handling.handle: trying to handle an undefined node");
    this.emit('handle', node);
    const h = this.handlers[node.type] as Handler<T> | undefined;
    assert(h, `Handling.handle: trying to handler node of type ${node.type} at ${Range.fromNode(node)} (missing handler)`);
    return h(node);
  }

  private readonly handlers: { [TT in ast.Node['type']]?: Handler<FindByTType<ast.Node, TT>> } = {
    // -> never
    LabelStatement: node => [],
    BreakStatement: node => [],
    GotoStatement: node => [],
    ReturnStatement: node => {
      const infos = node.arguments
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      infos.push(...this.handle(node.arguments[node.arguments.length-1]));

      const theFunction = this.scope.findContext('Function').theFunction;
      theFunction.as(TypeFunction)?.setReturns(infos);

      return [];
    },
    IfStatement: node => [],
    WhileStatement: node => [],
    DoStatement: node => [],
    RepeatStatement: node => [],
    LocalStatement: node => {
      return this.handlers['AssignmentStatement']!(node as any); // XXX!
      // diff with simple AssignmentStatement is new names shadow previous
      // but as it stands, this works out alright (maybe?)
    },
    AssignmentStatement: node => {
      const infos = node.init
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      infos.push(...this.handle(node.init[node.init.length-1]));

      node.variables.forEach((it, k) => {
        const initInfo = infos[k] ?? { type: Type.noType() };
        const mayDoc = this.doc.matching(Location.fromNodeStart(it));

        if (mayDoc) initInfo.doc = mayDoc;

        if ('Identifier' === it.type) {
          this.scope.set(it.name, initInfo);
          this.scope.locate(Range.fromNode(it), it.name, initInfo, LocateReason.Write);
        } else if ('MemberExpression' === it.type) {
          const mayTable = this.handle(it.base)[0].type.itself;
          this.scope.locate(Range.fromNode(it.identifier), it.identifier.name, initInfo, LocateReason.Write);

          // XXX: again, assuming '.' === it.indexer
          if (mayTable instanceof TypeTable)
            mayTable.setField(it.identifier.name, initInfo);
          else if (mayTable instanceof TypeSome)
            mayTable.setApplied(new TypeSomeOp.__newindex(it.identifier.name, initInfo));
        }
      });

      return [];
    },
    AssignmentOperatorStatement: node => [],
    CallStatement: node => {
      const expr = node.expression;
      const base = expr.base;
      if ('Identifier' === base.type && "___" === base.name) {
        log.info(`___ found at ${Location.fromNodeStart(base)}`);
        if ('CallExpression' === expr.type && expr.arguments.length) {
          expr.arguments.forEach(it => log.info(this.handle(it)));
        } else if ('StringCallExpression' === expr.type) {
          if ('StringLiteral' === expr.argument.type) {
            if ('throw' === expr.argument.value) throw "___'throw' at " + Location.fromNodeStart(base);
            if ('exit' === expr.argument.value) process.exit(0);
            log.info('globals' === expr.argument.value
              ? this.scope.getGlobals()
              : 'locals' === expr.argument.value
                ? this.scope.getLocals()
                : expr.argument.value);
          }
        }
      }

      this.handle(node.expression);

      return [];
    },
    ForNumericStatement: node => [],
    ForGenericStatement: node => [],

    // -> type | never
    FunctionDeclaration: node => {
      const names: string[] = [];
      let isVararg = false;

      for (let k = 0; k < node.parameters.length; k++) {
        const it = node.parameters[k];
        if ('Identifier' === it.type)
          names.push(it.name);
        else isVararg = true;
      }

      const info = { type: Type.Function(names) };
      const functionType = info.type.as(TypeFunction)!;
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        functionType.getParameters().forEach(([name, type], k) => {
          this.scope.set(name, type);
          this.scope.locate(Range.fromNode(node.parameters[k]), name, type, LocateReason.Write);
        });

        this.scope.pushContext(startLocation, 'Function', info.type);
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'Function');
      this.scope.join(endLocation);

      const it = node.identifier;
      if (it) {
        if ('Identifier' === it.type) {
          this.scope.set("xyz", info);
          this.scope.locate(Range.fromNode(it), it.name, info, LocateReason.Write);
        } else { // MemberExpression
          const mayTable = this.handle(it.base)[0].type.itself;
          this.scope.locate(Range.fromNode(it.identifier), it.identifier.name, info, LocateReason.Write);

          // XXX: more of the '.' === it.indexer
          if (mayTable instanceof TypeTable)
            mayTable.setField(it.identifier.name, info);
          else if (mayTable instanceof TypeSome)
            mayTable.setApplied(new TypeSomeOp.__newindex(it.identifier.name, info));
        }
      }

      return [info];
    },
    // -> type
    Identifier: node => {
      const info = this.scope.get(node.name);
      this.scope.locate(Range.fromNode(node), node.name, info, LocateReason.Read);
      return [info];
    },
    StringLiteral: node => [{ type: Type.String() }],
    NumericLiteral: node => [{ type: Type.Number() }],
    BooleanLiteral: node => [{ type: Type.Boolean() }],
    NilLiteral: node => [{ type: Type.Nil() }],
    // -> type[]
    VarargLiteral: node => [],
    // -> type
    TableConstructorExpression: node => {
      const info = { type: Type.Table() };
      const tableType = info.type.as(TypeTable)!;
      let autoIndex = 0;

      node.fields.forEach((it, k) => {
        switch (it.type) {
          case 'TableKey': {
            // NOTE: need to change where says xyzType and its the `itself`
            const keyType = this.handle(it.key)[0].type.itself;
            const valueType = this.handle(it.value)[0].type.itself;
          } break;

          case 'TableKeyString': {
            tableType.setField(it.key.name, this.handle(it.value)[0]);
          } break;

          case 'TableValue': {
            const types = this.handle(it.value);
            if (node.fields.length-1 === k)
              types.forEach(niw => tableType.setIndex(++autoIndex, niw));
            else tableType.setIndex(++autoIndex, types[0]);
          } break;
        }
      });

      return [info];
    },
    // -> type
    BinaryExpression: node => [],
    LogicalExpression: node => [],
    UnaryExpression: node => [],
    MemberExpression: node => {
      const baseType = this.handle(node.base)[0].type.itself;

      const r = baseType instanceof TypeTable
        ? baseType.getField(node.identifier.name)
        : baseType instanceof TypeSome
          ? baseType.getApplied(new TypeSomeOp.__index(node.identifier.name))
          : { type: Type.noType() };

      this.scope.locate(Range.fromNode(node.identifier), node.identifier.name, r, LocateReason.Read);

      // XXX: if ('.' === node.indexer) assumed for now
      // baseType may change (right? with removing first param?)

      return [r];
    },
    IndexExpression: node => [],
    // -> type[]
    CallExpression: node => {
      const base = node.base;
      const baseType = this.handle(base)[0].type.itself;

      const parameters = node.arguments
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      if (node.arguments.length)
        parameters.push(...this.handle(node.arguments[node.arguments.length-1]));

      return baseType instanceof TypeFunction
        ? baseType.getReturns(parameters)
        : baseType instanceof TypeSome
          ? [baseType.getApplied(new TypeSomeOp.__call(parameters))] // XXX: tuple gap
          : [{ type: Type.noType() }];
    },
    TableCallExpression: node => [],
    StringCallExpression: node => [],

    // -> never
    IfClause: node => [],
    ElseifClause: node => [],
    ElseClause: node => [],
    Chunk: node => {
      node.comments?.forEach(it => this.handle(it));
      node.body.forEach(it => this.handle(it));
      return [];
    },
    TableKey: node => [],
    TableKeyString: node => [],
    TableValue: node => [],
    Comment: node => {
      if (node.value.startsWith("-")) // YYY: doc comments strarts with a -
        this.doc.process(Range.fromNode(node), node.value.slice(1));
      return [];
    },
  };

}
