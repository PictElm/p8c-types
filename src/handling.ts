import { ast } from 'pico8parse';
import { Location, Range } from './locating';
import { log } from './logging';
import { Scoping } from './scoping';
import { Type, TypeBoolean, TypeFunction, TypeNil, TypeNumber, TypeString, TypeTable, TypeUnknown } from './typing';

type FindByTType<Union, TType> = Union extends { type: TType } ? Union : never;
type Handler<T> = (scope: Scoping, node: T) => Type[]

export class Handling {

  public static handle<T extends ast.Node>(scope: Scoping, node: T): Type[] | never {
    log.info("handling node of type " + node.type);
    const a = Handling.handlers[node.type] as Handler<T> | undefined;
    if (a) return a(scope, node);
    throw new TypeError(`Trying to handler node of type ${node.type} at ${Range.fromNode(node)}`);
  }

  private static handlers: { [TT in ast.Node['type']]?: Handler<FindByTType<ast.Node, TT>> } = {
    // -> never
    LabelStatement: (scope, node) => [],
    BreakStatement: (scope, node) => [],
    GotoStatement: (scope, node) => [],
    ReturnStatement: (scope, node) => {
      const types = node.arguments
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      types.push(...this.handle(scope, node.arguments[node.arguments.length-1]));

      const theFunction = scope.findContext('function') as { type: TypeFunction };
      theFunction.type.setReturns(types);

      return [];
    },
    IfStatement: (scope, node) => [],
    WhileStatement: (scope, node) => [],
    DoStatement: (scope, node) => [],
    RepeatStatement: (scope, node) => [],
    LocalStatement: (scope, node) => [],
    AssignmentStatement: (scope, node) => {
      const types = node.init
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      types.push(...this.handle(scope, node.init[node.init.length-1]));

      node.variables.forEach((it, k) => {
        if ('Identifier' === it.type)
          scope.set(it.name, types[k] ?? new TypeNil());
        else if ('MemberExpression' === it.type) {
          const mayTable = this.handle(scope, it.base)[0];
          log.info(mayTable);
          // XXX: again, assuming '.' === it.indexer
          if (mayTable instanceof TypeTable)
            mayTable.setField(it.identifier.name, types[k]);
          else if (mayTable instanceof TypeUnknown)
            log.warn("not implemented (missing TypeUnknownOperation)"); // TODO: operation for setField (and maybe more...)
        }
      });

      return [];
    },
    AssignmentOperatorStatement: (scope, node) => [],
    CallStatement: (scope, node) => [],
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

      scope.fork(Location.fromNodeStart(node));
        type.getParameters().forEach(([name, type]) => scope.set(name, type));

        scope.pushContext('function', { type });
          node.body.forEach(it => this.handle(scope, it));
        scope.popContext('function');
      scope.join(Location.fromNodeEnd(node));

      return [type];
    },
    // -> type
    Identifier: (scope, node) => [scope.get(node.name)],
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

      // XXX: if ('.' === node.indexer) assumed for now
      // baseType may change (right? with removing first param?)

      return [baseType instanceof TypeTable
        ? baseType.getField(node.identifier.name)
        : baseType instanceof TypeUnknown
          ? baseType.applied({ field: node.identifier.name })
          : new TypeNil()];
    },
    IndexExpression: (scope, node) => [],
    // -> type[]
    CallExpression: (scope, node) => {
      const base = node.base;
      let baseType: Type;

      if ('Identifier' === base.type)
        baseType = scope.get(base.name);
      else throw "not implemented";

      const parameters = node.arguments
        .slice(0, -1)
        .map(it => this.handle(scope, it)[0]);
      parameters.push(...this.handle(scope, node.arguments[node.arguments.length-1]));

      return baseType instanceof TypeFunction
        ? baseType.getReturns(parameters)
        : [new TypeNil()];
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
