import { Type } from './typing';

/**
 * syntaxes: (TODO: proper grammar?)
 * - `nil`, `boolean`, `number`, `string`, `thread`, `table`, `function`
 * - `{}`, `{ key: type }`, `{ [: number]: type }`, `{ @__add: type }`
 * - `() -> []`, `(name: <name>) -> [<name>, type]`, `(...) -> [...]`
 * - `false`, `true`, `42`, `'sleep'`, `<$setmetatable>`
 */

/**
 * @param state if giver, acts both as a starting point and to indicate where it stopped
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
