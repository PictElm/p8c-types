import { ast } from 'pico8parse';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Type } from './typing';

/**
 * docstring entities:
 * - `@type name: type`
 * - `@label label`
 * - `@see label | name`
 * - `@alias some: type`
 * - something like `@thread` or `@coroutine` to type the params
 * - (at this rate, why not `@return`, `@param` and `@property`)
 */
export class Metadata {

  private source: ast.Comment = null!;

  private description?: string;
  private typeOverride?: string;

}

interface DocumentingEvents {
}

export class Documenting extends TypedEmitter<DocumentingEvents> {

  private typeAlias: Record<string, Metadata> = {};

  private entries: Array<Metadata> = null!;

}
