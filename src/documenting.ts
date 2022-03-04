import { ast } from 'pico8parse';
import { Type } from './typing';

/**
 * docstring entities:
 * - `@type name: type`
 * - `@label label`
 * - `@see label | name`
 * - `@alias some: type`
 * - (at this rate, why not `@return`, `@param` and so on?)
 */
export class Documentation {

  private source: ast.Comment = null!;
  private initialName: string = null!;

  private definedTypes: Record<string, Type> = null!;

}

export class Documenting {

  private entries: Array<Documentation> = null!;

}
