import assert from 'assert';
import { ast } from 'pico8parse';
import { Location, Range } from './locating';
import { log } from './logging';
import { TypeSomeOp } from './operating';
import { LocateReason, Scoping } from './scoping';
import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeString, TypeTable, TypeSome } from './typing';

type FindByTType<Union, TType> = Union extends { type: TType } ? Union : never;
type Handler<T> = (scope: Scoping, node: T) => Type[]

export class Handling {

  public static handle<T extends ast.Node>(scope: Scoping, node: T): Type[] | never {
    log.info("handling node of type " + node.type);
    const h = Handling.handlers[node.type] as Handler<T> | undefined;
    assert(h, `Handling.handle: trying to handler node of type ${node.type} at ${Range.fromNode(node)}`);
    return h(scope, node);
  }

  private static readonly handlers: { [TT in ast.Node['type']]?: Handler<FindByTType<ast.Node, TT>> } = {
    // -> never
    LabelStatement: (scope, node) => [],
    BreakStatement: (scope, node) => [],
    GotoStatement: (scope, node) => [],
    ReturnStatement: (scope, node) => {
      const types = node.arguments
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      types.push(...this.handle(scope, node.arguments[node.arguments.length-1]));

      const theFunction = scope.findContext('Function').theFunction;
      theFunction.setReturns(types);

      return [];
    },
    IfStatement: (scope, node) => [],
    WhileStatement: (scope, node) => [],
    DoStatement: (scope, node) => [],
    RepeatStatement: (scope, node) => [],
    LocalStatement: (scope, node) => {
      return this.handlers['AssignmentStatement']!(scope, node as any); // XXX!
      // diff with simple AssignmentStatement is new names shadow previous
      // but as it stands, this works out alright (maybe?)
    },
    AssignmentStatement: (scope, node) => {
      const types = node.init
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      types.push(...this.handle(scope, node.init[node.init.length-1]));

      node.variables.forEach((it, k) => {
        const initType = types[k] ?? Type.noType();

        if ('Identifier' === it.type) {
          scope.set(it.name, initType);
          scope.locate(Range.fromNode(it), it.name, initType, LocateReason.Write);
        } else if ('MemberExpression' === it.type) {
          const mayTable = this.handle(scope, it.base)[0];
          scope.locate(Range.fromNode(it.identifier), it.identifier.name, initType, LocateReason.Write);

          // XXX: again, assuming '.' === it.indexer
          if (mayTable instanceof TypeTable)
            mayTable.setField(it.identifier.name, initType);
          else if (mayTable instanceof TypeSome)
            mayTable.setApplied(new TypeSomeOp.__newindex(it.identifier.name, initType));
        }
      });

      return [];
    },
    AssignmentOperatorStatement: (scope, node) => [],
    CallStatement: (scope, node) => {
      const expr = node.expression;
      const base = expr.base;
      if ('Identifier' === base.type && "___" === base.name) {
        log.info(`___ found at ${Location.fromNodeStart(base)}`);
        if ('CallExpression' === expr.type && expr.arguments.length) {
          expr.arguments.forEach(it => log.info(this.handle(scope, it)));
        } else if ('StringCallExpression' === expr.type) {
          if ('StringLiteral' === expr.argument.type) {
            if ('throw' === expr.argument.value) throw "___'throw' at " + Location.fromNodeStart(base);
            if ('exit' === expr.argument.value) process.exit(0);
            log.info('globals' === expr.argument.value
              ? scope.getGlobals()
              : 'locals' === expr.argument.value
                ? scope.getLocals()
                : expr.argument.value);
          }
        }
      }

      this.handle(scope, node.expression);

      return [];
    },
    ForNumericStatement: (scope, node) => [],
    ForGenericStatement: (scope, node) => [],

    // -> type | never
    FunctionDeclaration: (scope, node) => {
      const names: string[] = [];
      let isVararg = false;

      for (let k = 0; k < node.parameters.length; k++) {
        const it = node.parameters[k];
        if ('Identifier' === it.type)
          names.push(it.name);
        else isVararg = true;
      }

      const type = new TypeFunction(names);
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      scope.fork(startLocation);
        type.getParameters().forEach(([name, type], k) => {
          scope.set(name, type);
          scope.locate(Range.fromNode(node.parameters[k]), name, type, LocateReason.Write);
        });

        scope.pushContext(startLocation, 'Function', type);
          node.body.forEach(it => this.handle(scope, it));
        scope.popContext(endLocation, 'Function');
      scope.join(endLocation);

      return [type];
    },
    // -> type
    Identifier: (scope, node) => {
      const r = scope.get(node.name);
      scope.locate(Range.fromNode(node), node.name, r, LocateReason.Read);
      return [r];
    },
    StringLiteral: (scope, node) => [new TypeString()],
    NumericLiteral: (scope, node) => [new TypeNumber()],
    BooleanLiteral: (scope, node) => [new TypeBoolean()],
    NilLiteral: (scope, node) => [new TypeNil()],
    // -> type[]
    VarargLiteral: (scope, node) => [],
    // -> type
    TableConstructorExpression: (scope, node) => {
      const type = new TypeTable();
      let autoIndex = 0;

      node.fields.forEach((it, k) => {
        switch (it.type) {
          case 'TableKey': {
            ;
          } break;

          case 'TableKeyString': {
            type.setField(it.key.name, this.handle(scope, it.value)[0]);
          } break;

          case 'TableValue': {
            const types = this.handle(scope, it.value);
            if (node.fields.length-1 === k)
              types.forEach(niw => type.setIndex(++autoIndex, niw));
            else type.setIndex(++autoIndex, types[0]);
          } break;
        }
      });

      return [type];
    },
    // -> type
    BinaryExpression: (scope, node) => [],
    LogicalExpression: (scope, node) => [],
    UnaryExpression: (scope, node) => [],
    MemberExpression: (scope, node) => {
      const baseType = this.handle(scope, node.base)[0];

      const r = baseType instanceof TypeTable
        ? baseType.getField(node.identifier.name)
        : baseType instanceof TypeSome
          ? baseType.getApplied(new TypeSomeOp.__index(node.identifier.name))
          : Type.noType();

      scope.locate(Range.fromNode(node.identifier), node.identifier.name, r, LocateReason.Read);

      // XXX: if ('.' === node.indexer) assumed for now
      // baseType may change (right? with removing first param?)

      return [r];
    },
    IndexExpression: (scope, node) => [],
    // -> type[]
    CallExpression: (scope, node) => {
      const base = node.base;
      let baseType: Type;

      baseType = this.handle(scope, base)[0];

      const parameters = node.arguments
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      parameters.push(...this.handle(scope, node.arguments[node.arguments.length-1]));

      return baseType instanceof TypeFunction
        ? baseType.getReturns(parameters)
        : baseType instanceof TypeSome
          ? [baseType.getApplied(new TypeSomeOp.__call(parameters))] // XXX: tuple gap
          : [Type.noType()];
    },
    TableCallExpression: (scope, node) => [],
    StringCallExpression: (scope, node) => [],

    // -> never
    IfClause: (scope, node) => [],
    ElseifClause: (scope, node) => [],
    ElseClause: (scope, node) => [],
    Chunk: (scope, node) => {
      node.body.forEach(it => this.handle(scope, it));
      return [];
    },
    TableKey: (scope, node) => [],
    TableKeyString: (scope, node) => [],
    TableValue: (scope, node) => [],
    Comment: (scope, node) => [],
  };

}
