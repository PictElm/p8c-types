import { ast } from "pico8parse";
import { Type } from "./typing";

export class Documentation {

  private source: ast.Comment = null!;
  private initialName: string = null!;

  private definedTypes: Record<string, Type> = null!;

}

export class Documenting {

  private entries: Array<Documentation> = null!;

}
