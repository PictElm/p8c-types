import assert from 'assert';
import { ast } from 'pico8parse';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Documenting } from './documenting';
import { Location, Range } from './locating';
import { log } from './logging';
import { MetaOps } from './operating';
import { LocateReason, Scoping, VarInfo } from './scoping';
import { Type, TypeFunction, TypeTable, TypeSome, TypeString, TypeBoolean, TypeNil, TypeNumber, TypeVararg, TypeTuple } from './typing';

type FindByTType<Union, TType> = Union extends { type: TType } ? Union : never;
type Handler<T> = (node: T) => VarInfo;

interface HandlingEvents {

  'handle': (node: ast.Node) => void;

}

/**
 * main entry point (for now) for traversing the AST result of parsing
 * 
 * @emits 'handle' when a new node will be entered (regardless of wheather a handler was found)
 * 
 * @example
 * const scoping = new Scoping();
 * const documenting = new Documenting();
 * const handling = new Handling(scoping, documenting);
 * handling.handle(parse(src, options))
 */
export class Handling extends TypedEmitter<HandlingEvents> {

  public constructor(
    private readonly scope: Scoping,
    private readonly doc: Documenting
  ) { super(); }

  /**
   * handled a node according to its type
   * 
   * @throws when node is of an unknown type
   */
  public handle<T extends ast.Node>(node: T): VarInfo | never {
    assert(node, "Handling.handle: trying to handle an undefined node");
    this.emit('handle', node);
    const h = this.handlers[node.type] as Handler<T> | undefined;
    assert(h, `Handling.handle: trying to handler node of type ${node.type} at ${Range.fromNode(node)} (missing handler)`);
    return h(node);
  }

  private exprListTypes(expressions: ast.Expression[]): VarInfo[] {
    const r = expressions
      .slice(0, -1)
      .map(it => this.handle(it));

    if (expressions.length) {
      const mayTupleInfo = this.handle(expressions[expressions.length-1]);
      const mayTupleType = mayTupleInfo.type.as(TypeTuple);

      if (mayTupleType) r.push(...mayTupleType.getTypes());
      else r.push(mayTupleInfo);
    }

    return r;
  }

  // TODO: would like to make it possible to insert your own handlers,
  // this can be done using the 'handle' even for now
  // but it does not enable "preventDefault" kind of thing
  private readonly handlers: { [TT in ast.Node['type']]?: Handler<FindByTType<ast.Node, TT>> } = {
    // -> never
    LabelStatement: node => null!,
    BreakStatement: node => null!,
    GotoStatement: node => null!,
    ReturnStatement: node => {
      const infos = this.exprListTypes(node.arguments);

      const theFunction = this.scope.findContext('Function').theFunction;
      theFunction.as(TypeFunction)?.setReturns(infos.length
        ? { type: Type.make(TypeTuple, infos) }
        : infos[0]);

      return null!;
    },
    IfStatement: node => null!,
    WhileStatement: node => {
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        // NODE: same as repeat, the contition is in the same scope
        // here, its just kept outside of the context for.. reasons
        const infoCondition = this.handle(node.condition);
        this.scope.pushContext(startLocation, 'While');
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'While');
      this.scope.join(endLocation, true, false);

      return null!;
    },
    DoStatement: node => {
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        this.scope.pushContext(startLocation, 'Do');
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'Do');
      this.scope.join(endLocation, true, true);

      return null!;
    },
    RepeatStatement: node => null!,
    LocalStatement: node => {
      return this.handlers['AssignmentStatement']!(node as any); // XXX!
      // diff with simple AssignmentStatement is new names shadow previous
      // if ('Identifier' === it.type) { .. update in local scope .. }
    },
    AssignmentStatement: node => {
      const infos = this.exprListTypes(node.init);

      node.variables.forEach((it, k) => {
        const initInfo = infos[k] ?? { type: Type.noType() };
        const mayDoc = this.doc.matching(Location.fromNodeStart(it));

        if (mayDoc) initInfo.doc = mayDoc;

        if ('Identifier' === it.type) {
          // XXX: this ties back to the typed name merging strategy (or whatever - see Scoping)
          // if exists in scope,
          //    then needs to update in appropriate scope
          //    otherwise it is a global name
          this.scope.set(it.name, initInfo);
          this.scope.locate(Range.fromNode(it), it.name, initInfo, LocateReason.Write);
        } else if ('MemberExpression' === it.type) {
          const mayTableInfo = this.handle(it.base);
          this.scope.locate(Range.fromNode(it.identifier), it.identifier.name, initInfo, LocateReason.Write);

          // XXX: again, assuming '.' === it.indexer
          MetaOps.__newindex(mayTableInfo, it.identifier.name, initInfo);
        }
      });

      return null!;
    },
    AssignmentOperatorStatement: node => null!,
    CallStatement: node => {
      const expr = node.expression;
      const base = expr.base;
      /* istanbul ignore next */
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

      return null!;
    },
    ForNumericStatement: node => null!,
    ForGenericStatement: node => null!,

    // -> type | never
    FunctionDeclaration: node => {
      const parameters: TypeFunction['parameters'] = { names: [], infos: [], vararg: null };

      for (let k = 0; k < node.parameters.length; k++) {
        const it = node.parameters[k];
        if ('Identifier' === it.type) {
          parameters.names.push(it.name);
          parameters.infos.push({ type: Type.make(TypeSome, it.name) });
        } else parameters.vararg = { type: Type.make(TypeVararg) };
      }

      const info = { type: Type.make(TypeFunction, parameters) };
      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        // TODO: function type might benefit from having ref to its
        // inner scope (especially if trying typing some side-effects of calls)
        parameters.names.forEach((name, k) => {
          const info = parameters.infos[k];
          this.scope.set(name, info);
          this.scope.locate(Range.fromNode(node.parameters[k]), name, info, LocateReason.Write);
        });

        this.scope.pushContext(startLocation, 'Function', info.type);
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'Function');
      this.scope.join(endLocation, false);

      const it = node.identifier;
      if (it) {
        if ('Identifier' === it.type) {
          this.scope.set(it.name, info); // XXX: locality gap
          this.scope.locate(Range.fromNode(it), it.name, info, LocateReason.Write);
        } else { // MemberExpression
          const mayTableInfo = this.handle(it.base);
          this.scope.locate(Range.fromNode(it.identifier), it.identifier.name, info, LocateReason.Write);

          // XXX: more of the '.' === it.indexer
          MetaOps.__newindex(mayTableInfo, it.identifier.name, info);
        }
      }

      return it ? null! : info;
    },
    // -> type
    Identifier: node => {
      const info = this.scope.get(node.name);
      this.scope.locate(Range.fromNode(node), node.name, info, LocateReason.Read);
      return info;
    },
    StringLiteral: node => ({ type: Type.make(TypeString) }),
    NumericLiteral: node => ({ type: Type.make(TypeNumber) }),
    BooleanLiteral: node => ({ type: Type.make(TypeBoolean) }),
    NilLiteral: node => ({ type: Type.make(TypeNil) }),
    // -> type[]
    VarargLiteral: node => ({ type: Type.make(TypeVararg) }), // TODO: get context, use context (, update context?)
    // -> type
    TableConstructorExpression: node => {
      const info = { type: Type.make(TypeTable) };
      const tableType = info.type.as(TypeTable)!;
      let autoIndex = 0;

      node.fields.forEach((it, k) => {
        switch (it.type) {
          case 'TableKey': {
            // NOTE: need to change where says xyzType and its the `itself`
            const keyType = this.handle(it.key).type;
            const valueInfo = this.handle(it.value);
            tableType.setIndexer(keyType, valueInfo);
            // TODO: what about multiple entries with the same keyType?!
          } break;

          case 'TableKeyString': {
            tableType.setField(it.key.name, this.handle(it.value));
          } break;

          case 'TableValue': {
            // TODO: should deal with table-as-list better
            // (+ this does not differentiate between equivalent number and string keys)
            tableType.setField(""+ ++autoIndex, this.handle(it.value));
            // also need to handle last TableValue entry ^^
          } break;
        }
      });

      return info;
    },
    // -> type
    BinaryExpression: node => null!,
    LogicalExpression: node => null!,
    UnaryExpression: node => null!,
    MemberExpression: node => {
      const baseInfo = this.handle(node.base);

      const r = MetaOps.__index(baseInfo, node.identifier.name);

      this.scope.locate(Range.fromNode(node.identifier), node.identifier.name, r, LocateReason.Read);

      // XXX: if ('.' === node.indexer) assumed for now
      // baseType may change (right? with removing first param?)

      return r;
    },
    IndexExpression: node => null!,
    // -> type[]
    CallExpression: node => {
      const base = node.base;
      const baseInfo = this.handle(base);

      const parameters = this.exprListTypes(node.arguments);

      return MetaOps.__call(baseInfo, parameters);
    },
    TableCallExpression: node => null!,
    StringCallExpression: node => null!,

    // -> never
    IfClause: node => null!,
    ElseifClause: node => null!,
    ElseClause: node => null!,
    Chunk: node => {
      node.comments?.forEach(it => this.handle(it));

      const startLocation = Location.fromNodeStart(node);
      const endLocation = Location.fromNodeEnd(node);

      this.scope.fork(startLocation);
        this.scope.pushContext(startLocation, 'Do');
          node.body.forEach(it => this.handle(it));
        this.scope.popContext(endLocation, 'Do');
      this.scope.join(endLocation, false);

      return null!;
    },
    TableKey: node => null!,
    TableKeyString: node => null!,
    TableValue: node => null!,
    Comment: node => {
      if (node.value.startsWith("-")) // doc comments starts with a -
        this.doc.process(Range.fromNode(node), node.value.slice(1));
      return null!;
    },
  };

}
