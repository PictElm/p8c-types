import { ast } from 'pico8parse';

export class CurrentDocument {

  public static uri?: string;
  public static text: string;
  public static ast: ast.Chunk;
  public static range: Range;

  public static setCurrent(some: string) {
    this.uri = "[String]";
    this.text = some;
    this.ast = null!;

    const lines = some.split("\n");

    this.range = new Range(
      new Location(1, 0),
      new Location(lines.length, lines[lines.length-1].length),
    );
  }

}

export class Location {

  public constructor(
    public line: number,
    public col: number,
    public file?: string
  ) { }

  public static fromNodeStart(node: ast.Node) {
    const a = node.loc!;
    return new Location(a.start.line, a.start.column, CurrentDocument.uri);
  }

  public static fromNodeEnd(node: ast.Node) {
    const a = node.loc!;
    return new Location(a.end.line, a.end.column, CurrentDocument.uri);
  }

  public static beginning() {
    return CurrentDocument.range.start;
  }
  public static ending() {
    return CurrentDocument.range.end;
  }

  public toString(): string {
    return `${this.file ?? "somewhere"}:${this.line}:${this.col}`;
  }

}

export class Range {

  public constructor(
      public start: Location,
      public end: Location
  ) { }

  public static emptyRange() { return new Range(null!, null!); }

  public static fromNode(node: ast.Node) {
    return new Range(Location.fromNodeStart(node), Location.fromNodeEnd(node));
  }

  public toString(): string {
    return `${this.start} - ${this.end}`;
  }

}
