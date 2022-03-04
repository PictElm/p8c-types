import { Type, TypeString } from './typing';

/**
 * syntaxes: (TODO: proper grammar?)
 * - `nil`, `boolean`, `number`, `string`, `thread`, `table`, `function`
 * - `{}`, `{ key: type }`, `{ [: number]: type }`, `{ @__add: type }`
 * - `() -> []`, `(name: <name>) -> [<name>, type]`, `(...) -> [...]`
 * - `false`, `true`, `42`, `'sleep'`, `<$setmetatable>`
 */
export function parseType(source: string): Type {
  if ('string' === source) return new TypeString();
  return null!;
}
