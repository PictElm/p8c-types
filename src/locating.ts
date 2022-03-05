import assert from 'assert';
import { readFileSync } from 'fs';
import { ast } from 'pico8parse';
import { log } from './logging';

export class Document {

  public readonly range: Range;

  private constructor(
    public readonly uri: string,
    public readonly text: string,
  ) {
    assert(!Document._cached[uri], `Document.constructor: some "${uri}" were already loaded earlier`);
    log.info(`loaded document: ${uri} (${text.length} bytes)`);
    Document._cached[uri] = this;

    this.range = new Range(
      new Location(0, 0),
      new Location(text.split("\n").length, 0),
    );
  }

  private static _cached: Record<string, Document> = {};

  private static _current: Document;
  public static get current(): Document { return Document._current; }

  public static loadString(someString: string, someName?: string) {
    Document._current = new Document(someName ?? "[String]", someString);
  }
  public static loadFile(uri: string) {
    Document._current = new Document(uri, readFileSync(uri).toString());
  }

}

export class Location {

  public constructor(
    /** 0-base */ public line: number,
    /** 0-base */ public character: number,
    public file?: string,
  ) { }

  public static fromNodeStart(node: ast.Node) {
    const a = node.loc;
    assert(a, "Location.fromNodeStart: node has not loc field");
    return new Location(a.start.line, a.start.column, Document.current.uri);
  }

  public static fromNodeEnd(node: ast.Node) {
    const a = node.loc;
    assert(a, "Location.fromNodeEnd: node has not loc field");
    return new Location(a.end.line, a.end.column, Document.current.uri);
  }

  public static beginning() {
    return Document.current.range.start;
  }
  public static ending() {
    return Document.current.range.end;
  }

  public toString(): string {
    return `${this.file ?? "somewhere"}:${this.line}:${this.character}`;
  }

}

export class Range {

  public constructor(
    /** included */ public start: Location,
    /** excluded */ public end: Location
  ) { }

  public static emptyRange() { return new Range(null!, null!); }

  public static fromNode(node: ast.Node) {
    return new Range(Location.fromNodeStart(node), Location.fromNodeEnd(node));
  }

  public toString(): string {
    return `${this.start} - ${this.end}`;
  }

}
