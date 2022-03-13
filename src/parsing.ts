import { Type, TypeAlias, TypeFunction, TypeTable, TypeThread, TypeTuple, TypeVararg } from './typing';

/**
 * tries to parse a type a the beginning of `source`
 * @param state if given, acts both as a starting point and to indicate where it stopped
 * 
 * for a parsing with error handling, use the underlying Parser.parse directly
 * @see Parser.parse
 */
export function parseType(source: string, state?: { index: number }): Type | undefined {
  try { return Parser.parseType(source, state ?? { index: 0 }); } catch (err) { }
}

enum Types {
  OTHER = 0,
  LITERAL_BOOLEAN = 2,
  LITERAL_NUMBER = 4,
  LITERAL_STRING = 8,
  LITERAL
    = LITERAL_BOOLEAN
    | LITERAL_NUMBER
    | LITERAL_STRING,
  PUNCTUATOR = 16,
  SIMPLE = 32,
  ALIAS = 48,
}

type Token = { type: Types, value: string | number | boolean };

export class Parser {

  protected token: Token = { type: Types.OTHER, value: "<dne>" };
  protected previousIndex = this.state.index;

  /**
   * ```bnf
   * <simple> ::= "nil" | "boolean" | "number" | "string" | "table" | "function" | "thread"
   * 
   * <table> ::= "{" {(<name> | "[" <name> ":" <simple> "]") ":" <type> ","} "}"
   * 
   * <tuple> ::= "[" {<type> ","} "]"
   * <params> ::= "(" {<name> ":" <type> ","} ["..." [":" <tuple>]] ")"
   * 
   * <function> ::= <params> "->" <tuple>
   * <thread> ::= <params> {"~>" <params>} "~*"
   * 
   * <typeof> ::= "<" <name> ">"
   * 
   * <literal> ::= /[0-9]+/ | "'" /.*?/ "'" | "true" | "false"
   * <alias> ::= /[A-Z_a-z]\w*?/
   * 
   * <union> ::= <type> "|" <type>
   * <intersection> ::= <type> "&" <type>
   * 
   * <type> ::= <simple> | <table> | <tuple> | <function> | <thread> | <typeof> | <alias> | <literal> | <union> | <intersection> | "(" <type> ")"
   * (* note: `a | b & c` is same as `a | (b & c)` *)
   * ```
   */
  protected constructor(
    protected source: string,
    protected readonly state: { index: number },
  ) { }

  public static SyntaxError = class extends Error { };

  public static parseType(source: string, state: { index: number }) {
    const parser = new Parser(source, state);
    parser.next();
    const r = parser.parse(true);
    parser.state.index = parser.previousIndex;
    return r;
  }

  protected parse(canUnion: boolean): Type | never {
    let type: Type | undefined = undefined;

    if (Types.SIMPLE === this.token.type) {
      switch (this.token.value) {
        case "nil":      type = Type.Nil();      break;
        case "boolean":  type = Type.Boolean();  break;
        case "number":   type = Type.Number();   break;
        case "string":   type = Type.String();   break;
        // case "table":    type = Type.Table();    break; // TODO: TypeAnyTable
        // case "function": type = Type.Function(); break; // TODO: TypeAnyFunction
        // case "thread":   type = Type.Thread();   break; // TODO: TypeAnyThread
        default: throw new Parser.SyntaxError("non exhaustive handling of simple types");
      }
    }

    else if (Types.LITERAL & this.token.type) {
      switch (this.token.type) {
        case Types.LITERAL_BOOLEAN: type = Type.LiteralBoolean(this.token.value as boolean); break;
        case Types.LITERAL_NUMBER:  type = Type.LiteralNumber(this.token.value as number); break;
        case Types.LITERAL_STRING:  type = Type.LiteralString(this.token.value as string); break;
        default: throw new Parser.SyntaxError("non exhaustive handling of literal types");
      }
    }

    else if (Types.ALIAS === this.token.type) {
      type = Type.Alias(`${this.token.value}`);
    }

    else if (Types.PUNCTUATOR === this.token.type) {
      const value = this.token.value;
      switch (value) {

        case "{": { // table
          type = Type.Table();
          const asTable = type.itself as TypeTable;

          do { // while ","

            // <name> or "["
            this.next();

            // <name> ":" <type>
            if (Types.ALIAS === this.token.type) {
              const name = this.token.value;

              this.next();
              this.expect(":");

              this.next();
              asTable.setField(`${name}`, { type: this.parse(true) });
            }

            // "[" <name> ":" <simple> "]" ":" <type>
            else if ("[" === this.token.value) {
              this.next();

              if (Types.ALIAS !== this.token.type) this.expected(["<name>"]);
              const name = this.token.value;

              // ":" <simple> ...
              this.next();
              this.expect(":");
              this.next();
              if (Types.SIMPLE !== this.token.type) this.expected(["<simple>"]);

              // ... "]" ":" <type>
              this.next();
              this.expect("]");
              this.next();
              this.expect(":");

              this.next();
              // XXX/TODO: indexing by type
              asTable.setField(`[${name ?? ""}: ${this.token.value}]`, { type: this.parse(true) });
            }

          } while ("," === this.token.value);

          this.expect("}");
        } break;

        case "[": { // tuple
          const types: Type[] = [];

          do { // while ","

            this.next();
            if ("]" !== this.token.value)
              types.push(this.parse(true));

          } while ("," === this.token.value);

          type = Type.Tuple(types);

          this.expect("]");
        } break;

        case "(": { // function, thread or parenthesized expression
          // <function> ::= <params-list> ...
          // <thread> ::= <params-list> ...
          // <parent-expr> ::= <type>
          // <params-list> ::= {<name> ":" <type> ","} ["..." [":" <type>]]

          let mayType: Type | undefined;
          let asAlias: TypeAlias | undefined;

          this.next();
          if (")" !== this.token.value && "..." !== this.token.value) {
            // <name> ":" <type> | "..." [":" <tuple>] | <type>
            mayType = this.parse(true);
            asAlias = mayType.as(TypeAlias);
          }

          const value = this.token.value;
          // ":" <type> | [":" <tuple>]
          if ((")" === value && !mayType) || "..." === value || (asAlias && ":" === this.token.value)) {
            let wasName = asAlias?.alias;
            const signatures: [names: string[], types: Type[], vararg: Type | null][] = [];

            do { // "~>"

              let names: string[] = [];
              let types: Type[] = [];
              let vararg: Type | null = !wasName && ")" !== this.token.value
                ? Type.Vararg()
                : null;

              while (")" !== this.token.value) {

                // <name> ":" <type>
                if (wasName) {
                  this.expect(":");
                  names.push(wasName);
                  this.next();
                  types.push(this.parse(true));
                }

                // "..." [":" <tuple>]
                else {
                  this.next();

                  if (":" === this.token.value) {
                    this.next();
                    const shouldTuple = this.parse(true);
                    if (!(shouldTuple.itself instanceof TypeTuple))
                      this.expected(["<tuple>"], "a " + shouldTuple.itself.constructor.name);

                    // vararg.as(TypeVararg)!.setTypes(shouldTuple); // XXX: need something like that
                  }

                  // ")"
                  break;
                }

                // "," (<name> ":" <type> | "..." [":" <tuple>])
                if ("," === this.token.value) {
                  this.next();
                  const value = this.token.value as string; // otherwise inferred as type `","`

                  wasName = Types.ALIAS === this.token.type
                    ? value
                    : "..." === value
                      ? undefined
                      : this.expected(["<name>", "..."]);
                  // <name> ":"
                  if (wasName) this.next();
                }

              } // ")" !=

              // ")" ("->" <type> | "~>" ... | "~*")
              this.expect(")");
              signatures.push([names, types, vararg]);

              // "->" <type> | "~*"
              this.next();
              if ("->" === this.token.value || "~*" === this.token.value)
                break;

              // "~>" "(" <param-list> ")"
              this.expect("~>");
              this.next();
              this.expect("(")

              // <name> ":" <type> | "..." [":" <tuple>]
              this.next();
              const value = this.token.value;

              if (")" !== value) {
                wasName = Types.ALIAS === this.token.type
                  ? value as string
                  : "..." === value
                    ? undefined
                    : this.expected(["<name>", "..."]);
                // <name> ":"
                if (wasName) this.next();
              }

            } while (true);

            // "->" <tuple>
            if ("->" === this.token.value && 1 === signatures.length) {
              this.next();
              const shouldTuple = this.parse(true);
              if (!(shouldTuple.itself instanceof TypeTuple))
                this.expected(["<tuple>"], "a " + shouldTuple.itself.constructor.name);

              type = Type.Function(signatures[0][0].map(it => it[0]));
              const asFunction = type.as(TypeFunction)!;

              // asFunction.setParameters(types); // XXX: need something like that
              // asFunction.setReturns(shouldTuple); // XXX: need something like that
            }

            // "~*"
            else if ("~*" === this.token.value) {
              type = Type.Thread();
              const asThread = type.as(TypeThread);

              for (let k = 0; k < signatures.length; k++)
                ; // asThread.pushSignature(names[k], types[k]); // XXX: need something like that
            }

            else this.expected(1 === signatures.length ? ["->", "~>", "~*"] : ["~>", "~*"]);
          }

          // <type>
          else {
            type = mayType!;
            this.expect(")");
          }
        } break;

        case "<": { // typeof
          this.next();
          if (Types.ALIAS !== this.token.type) this.expected(["<name>"]);

          type = Type.Some(`${this.token.value}`);
          this.next();

          this.expect(">");
        } break;

        default: throw new Parser.SyntaxError(`unexpected "${this.token.value}"`);
      }
    }

    else throw new Parser.SyntaxError(`unexpected "${this.token.value}"`);

    this.next();

    // "&" <type>
    if ("&" === this.token.value) {
      this.next();
      type = Type.Intersection(type, this.parse(false));

      // this.next();
    }

    // "|" <type>
    if (canUnion && "|" === this.token.value) {
      this.next();
      type = Type.Union(type, this.parse(true));
    }

    return type;
  }

//#region lexer
  protected advance(by: number) {
    this.source = this.source.slice(by);
    this.state.index+= by;
  }

  protected next() {
    this.previousIndex = this.state.index;
    this.token = this.lex();
  }

  protected expected(any: string[], got?: string): never {
    const a = 1 === any.length ? any[0] : `one of ${any.join(", ")}`;
    const b = `"${got ?? this.token.value}"`;
    throw new Parser.SyntaxError(`expected ${a}; got ${b}`);
  }

  protected expect(value: string) {
    if (value !== this.token.value) this.expected([`"${value}"`]);
  }

  protected lex(): Token {
    if (!this.source) return { type: Types.OTHER, value: "<end>" };

    // scan spaces

    const spaces = this.source.match(/^\s+/);
    if (spaces) this.advance(spaces[0].length);

    // scan punctuator

    const punctuations = [
      ["..."],
      ["->", "~>", "~*"],
      ["{", "}", "[", "]", "(", ")", "<", ">", ":", ",", "&", "|"],
    ];
    let here = this.source.slice(0, punctuations.length);

    let k = punctuations.length - here.length;
    for (; k < punctuations.length; k++) {
      if (-1 < punctuations[k].indexOf(here)) {
        this.advance(here.length);
        return { type: Types.PUNCTUATOR, value: here };
      }
      here = here.slice(0, -1);
    }

    const char = this.source[0].charCodeAt(0);

    // scan literal string

    if (39 === char) { // '\''
      const match = this.source.match(/^'((?:\\'|.)*?)'/);

      if (match) {
        this.advance(match[1].length + 2);
        return { type: Types.LITERAL_STRING, value: match[1] };
      }

      const value = this.source.slice(1);
      this.advance(this.source.length);
      return { type: Types.LITERAL_STRING, value };
    }

    // scan literal number

    if (47 < char && char < 58) { // '0'-1  '9'+1
      const base = 48 === char && { b: 2, o: 8, x: 16 }[this.source[1]] || 10;
      const raw = this.source.match(/^\d[box]?\d+/)![0];
      this.advance(raw?.length);
      return { type: Types.LITERAL_NUMBER, value: parseInt(raw, base) };
    }

    // scan simple, alias, literal nil and literal boolean)

    const match = this.source.match(/^[A-Z_a-z]\w*/);

    if (match) {
      const value = match[0];
      this.advance(value.length);

      if ("true" === value || "false" === value)
        return { type: Types.LITERAL_BOOLEAN, value: "t" === value[0] }

      return {
        type: -1 < ["nil", "boolean", "number", "string", "table", "function", "thread"].indexOf(value)
          ? Types.SIMPLE
          : Types.ALIAS,
        value
      };
    }

    return { type: Types.OTHER, value: this.source.match(/^\S+/)?.[0] ?? "something" };
  }
//#endregion

}
