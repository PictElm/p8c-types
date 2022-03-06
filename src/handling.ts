import assert from 'assert';
import { ast } from 'pico8parse';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Documenting } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { TypeSomeOp } from './operating';
import { LocateReason, Scoping } from './scoping';
import { Type, TypeFunction, TypeTable, TypeSome } from './typing';

type FindByTType<Union, TType> = Union extends { type: TType } ? Union : never;
type Handler<T> = (node: T) => Type[]

interface HandlingEvents {
  'handle': (node: ast.Node) => void;
}

export class Handling extends TypedEmitter<HandlingEvents> {

  public constructor(
    private readonly scope: Scoping,
    private readonly doc: Documenting
  ) { super(); }

  public handle<T extends ast.Node>(node: T): Type[] | never {
    this.emit('handle', node);
    const h = this.handlers[node.type] as Handler<T> | undefined;
    assert(h, `Handling.handle: trying to handler node of type ${node.type} at ${Range.fromNode(node)}`);
    return h(node);
  }

  private readonly handlers: { [TT in ast.Node['type']]?: Handler<FindByTType<ast.Node, TT>> } = {
    // -> never
    LabelStatement: node => [],
    BreakStatement: node => [],
    GotoStatement: node => [],
    ReturnStatement: node => {
      const types = node.arguments
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      types.push(...this.handle(node.arguments[node.arguments.length-1]));

      const theFunction = this.scope.findContext('Function').theFunction;
      theFunction.as(TypeFunction)?.setReturns(types);

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
      const types = node.init
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      types.push(...this.handle(node.init[node.init.length-1]));

      node.variables.forEach((it, k) => {
        const initType = types[k] ?? Type.noType();

        if ('Identifier' === it.type) {
          this.scope.set(it.name, initType);
          this.scope.locate(Range.fromNode(it), it.name, initType, LocateReason.Write);
        } else if ('MemberExpression' === it.type) {
          const mayTable = this.handle(it.base)[0].itself;
          this.scope.locate(Range.fromNode(it.identifier), it.identifier.name, initType, LocateReason.Write);

          // XXX: again, assuming '.' === it.indexer
          if (mayTable instanceof TypeTable)
            mayTable.setField(it.identifier.name, initType);
          else if (mayTable instanceof TypeSome)
            mayTable.setApplied(new TypeSomeOp.__newindex(it.identifier.name, initType));
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

      const type = Type.Function(names);
      const functionType = type.as(TypeFunction)!;
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        functionType.getParameters().forEach(([name, type], k) => {
          this.scope.set(name, type);
          this.scope.locate(Range.fromNode(node.parameters[k]), name, type, LocateReason.Write);
        });

        this.scope.pushContext(startLocation, 'Function', type);
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'Function');
      this.scope.join(endLocation);

      return [type];
    },
    // -> type
    Identifier: node => {
      const r = this.scope.get(node.name);
      this.scope.locate(Range.fromNode(node), node.name, r, LocateReason.Read);
      return [r];
    },
    StringLiteral: node => [Type.String()],
    NumericLiteral: node => [Type.Number()],
    BooleanLiteral: node => [Type.Boolean()],
    NilLiteral: node => [Type.Nil()],
    // -> type[]
    VarargLiteral: node => [],
    // -> type
    TableConstructorExpression: node => {
      const type = Type.Table();
      const tableType = type.as(TypeTable)!;
      let autoIndex = 0;

      node.fields.forEach((it, k) => {
        switch (it.type) {
          case 'TableKey': {
            ;
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

      return [type];
    },
    // -> type
    BinaryExpression: node => [],
    LogicalExpression: node => [],
    UnaryExpression: node => [],
    MemberExpression: node => {
      const baseType = this.handle(node.base)[0].itself;

      const r = baseType instanceof TypeTable
        ? baseType.getField(node.identifier.name)
        : baseType instanceof TypeSome
          ? baseType.getApplied(new TypeSomeOp.__index(node.identifier.name))
          : Type.noType();

      this.scope.locate(Range.fromNode(node.identifier), node.identifier.name, r, LocateReason.Read);

      // XXX: if ('.' === node.indexer) assumed for now
      // baseType may change (right? with removing first param?)

      return [r];
    },
    IndexExpression: node => [],
    // -> type[]
    CallExpression: node => {
      const base = node.base;
      const baseType = this.handle(base)[0].itself;

      const parameters = node.arguments
        .slice(0, -1)
        .map(it => this.handle(it)[0]);
      parameters.push(...this.handle(node.arguments[node.arguments.length-1]));

      return baseType instanceof TypeFunction
        ? baseType.getReturns(parameters)
        : baseType instanceof TypeSome
          ? [baseType.getApplied(new TypeSomeOp.__call(parameters))] // XXX: tuple gap
          : [Type.noType()];
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
      log.info(node);
      return [];
    },
  };

}
