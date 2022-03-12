import { Type } from './typing';

/**
 * tries to parse a type a the beginning of `source`
 * @param state if given, acts both as a starting point and to indicate where it stopped
 */
export function parseType(source: string, state?: { index: number }): Type | undefined {
  state = state ?? { index: 0 };
  const len = source.length;
  source = source.trim();
  state.index+= source.length - len;

  if ('nil' === source) return Type.Nil();
  if ('boolean' === source) return Type.Boolean();
  if ('number' === source) return Type.Number();
  if ('string' === source) return Type.String();

  return Parser.parse(source, state);
}

enum Types {
  LITERAL_NIL = 1,
  LITERAL_BOOLEAN = 2,
  LITERAL_NUMBER = 4,
  LITERAL_STRING = 8,
  LITERAL
    = LITERAL_NIL
    | LITERAL_BOOLEAN
    | LITERAL_NUMBER
    | LITERAL_STRING,
  PUNCTUATOR = 3,
  SIMPLE = 5,
  ALIAS = 7,
}

type Token = { type: Types, value: string | number | boolean | null };

class Parser {

  /**
   * ```bnf
   * <simple> ::= "nil" | "boolean" | "number" | "string" | "table" | "function" | "thread"
   * 
   * <table> ::= "{" {(<name> | "[" [<name>] ":" <simple> "]") ":" <type> ","} "}"
   * 
   * <tuple> ::= "[" {[<name> ":"] <type>} "]"
   * <params> ::= "(" {<name> ":" <type> ","} ["..." [":" <type>]] ")"
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

  protected type: Type = null!; //...
  protected token: Token = null!; //...

  public static parse(source: string, state: { index: number }) {
    return new Parser(source, state)._parse(false);
  }

  protected _parse(canUnion: boolean): Type | undefined {
    let token = this.next();
    if (!token) return undefined;
    let type: Type | undefined = undefined;

    if (Types.SIMPLE === token.type) {
      // find the right type
    }

    else if (Types.LITERAL === token.type) {
      // find the right type
    }

    else if (Types.PUNCTUATOR === token.type) {
      switch (token.value) {

        case "{": { // table
          //...
          if ("}" !== this.next()?.value) return undefined;
        } break;

        case "[": { // tuple
          //...
          if ("]" !== this.next()?.value) return undefined;
        } break;

        case "(": { // function, thread or parenthesized expression
          //...
          if (")" !== this.next()?.value) return undefined;
        } break;

        case "<": { // typeof
          //...
          if (">" !== this.next()?.value) return undefined;
        } break;

        default: return undefined;
      }
    }

    else return undefined;

    if ("&" === this.next()?.value) {
      const before = this.state.index;
      const mate = this._parse(false);
      if (!mate) { // rhs fail, bail out
        this.state.index = before;
        return type;
      }
      type = intersection(type, mate);
    }

    if (canUnion && "|" === this.next()?.value) {
      const before = this.state.index;
      const mate = this._parse(false);
      if (!mate) { // rhs fail, bail out
        this.state.index = before;
        return type;
      }
      type = union(type, mate);
    }

    return type;
  }

//#region lexer
  protected advance(by: number) {
    this.source = this.source.slice(by);
    this.state.index+= by;
  }

  protected spaces() {
    const a = this.source.match(/\S+/);
    if (a) this.advance(a.index ?? 0);
  }

  protected next(): Token | undefined {
    if (!this.source) return undefined;
    this.spaces();

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
        this.advance(match[1].length);
        return { type: Types.LITERAL_STRING, value: match[1] };
      }

      return undefined;
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

      if ("nil" === value)
        return { type: Types.LITERAL_NIL, value: null };
      if ("true" === value || "false" === value)
        return { type: Types.LITERAL_BOOLEAN, value: "t" === value[0] }

      return {
        type: -1 < ["boolean", "number", "string", "table", "function", "thread"].indexOf(value)
          ? Types.SIMPLE
          : Types.ALIAS,
        value
      };
    }

    return undefined;
  }
//#endregion

}
