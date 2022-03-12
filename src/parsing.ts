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

  return undefined;
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
  SIMPLE = 3,
  PUNCTUATOR = 5,
}

type Token = { type: Types, value: string };

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
   * 
   * <union> ::= <type> "|" <type>
   * <intersection> ::= <type> "|" <type>
   * 
   * <type> ::= <simple> | <table> | <tuple> | <function> | <thread> | <typeof> | <literal> | <union> | <intersection>
   * (* note: `a | b & c` is same as `a | (b & c)` *)
   * ```
   */
  public constructor(
    private source: string,
    private readonly state: { index: number },
  ) { }

  public lex(): Token {
    return null!;
  }

}
