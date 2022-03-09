import assert from 'assert';
import { readFileSync } from 'fs';
import { ast } from 'pico8parse';
import { log } from './logging';

/** immutable */
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

/** immutable */
export class Location {

  public constructor(
    /** 0-base */ public readonly line: number,
    /** 0-base */ public readonly character: number,
    public readonly file?: string,
  ) { }

  /**
   * - &lt;0 when `this` before `mate`
   * - &gt;0 when `this` after `mate`
   * - =0 otherwise
   */
  public compare(mate: Location) {
    const lineDiff = this.line - mate.line;
    return lineDiff || this.character - mate.character;
  }

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

  public toString(hideUri?: boolean): string {
    return hideUri
      ? `${this.line}:${this.character}`
      : `${this.file ?? "somewhere"}:${this.line}:${this.character}`;
  }

}

/** immutable */
export class Range {

  public constructor(
    /** included */ public readonly start: Location,
    /** excluded */ public readonly end: Location
  ) { }

  public contains(location: Location) {
    return this.start.compare(location) <= 0 && 0 < this.end.compare(location);
  }

  public static emptyRange() { return new Range(null!, null!); }

  public static fromNode(node: ast.Node) {
    return new Range(Location.fromNodeStart(node), Location.fromNodeEnd(node));
  }

  public toString(separator: string = " - ", hideUri: boolean): string {
    return this.start.toString(hideUri) + separator + this.end.toString(hideUri);
  }

}
