import { TypedEmitter } from 'tiny-typed-emitter';
import { Location, Range } from './locating';
import { parseType } from './parsing';
import { LocateReason, VarInfo } from './scoping';
import { Type, TypeAlias, TypeFunction, TypeSome, TypeTable } from './typing';

class Description {

  private readonly tags: Record<string, string[]> = {};
  private readonly text: Array<string> = [];

  /**
   * push a tag (eg. `@example` or `@deprecated`)
   * 
   * recognized tags should not be pushed here, but fully handled elswhere
   */
  public pushTag(tag: string, text: string) {
    const it = this.tags[tag] ?? (this.tags[tag] = []);
    it.push(text);
  }

  /**
   * push arbitrary text
   */
  public pushText(text: string) {
    this.text.push(text);
  }

  /**
   * @todo TODO: properly formated (use markdown whenever)
   */
  public toString() {
    return [
      ...this.text,
      ...Object
        .keys(this.tags)
        .sort()
        .map(tag => `@${tag} - ${this.tags[tag].join("\n"+" ".repeat(tag.length+4))}`)
    ].join("\n");
  }

}

/**
 * metadata for a variable, consists of
 *  - an optional, user-provided type
 *  - a description (arbitrary doc string and unknown tags)
 * 
 * @see Description
 */
export class Metadata {

  private static _lastId = 0;
  protected readonly _id = ++Metadata._lastId;

  public readonly sources: Range[] = [];

  /** keeps empty lines (as empty strings) */
  public readonly description: Description = new Description();
  /** because a `@type` tag can specify multiple types */
  public readonly types: (Type | undefined)[] = [];

  public get type(): Type | undefined {
    return 1 === this.types.length
      ? this.types[0]
      : undefined;
  }

  public isFollowUp(range: Range) {
    const last = this.sources[this.sources.length-1];
    return last.end.line + 1 === range.start.line;
  }

  /* istanbul ignore next */
  public toString() { return `Metadata@_id${this._id}`; }

}

/**
 * used to ease parsing syntaxes `"@" <tag> <...>`
 */
class Bidoof {

  public constructor(private source: string) { }

  public nextExact(token: string): true | undefined {
    const index = this.source.indexOf(token);
    if (index < 0) return undefined;

    this.source = this.source.trimStart().slice(token.length);
    return true;
  }

  public nextName(): string | undefined {
    const match = /^\s*([A-Za-z_]\w+)/.exec(this.source);
    if (!match) return undefined;

    this.source = this.source.slice(match[0].length);
    return match[1];
  }

  public nextType(): Type | undefined {
    const state = { index: 0 };
    const r = parseType(this.source, state);

    this.source = this.source.slice(state.index);
    return r;
  }

  public rest(): string | undefined {
    if (!this.source) return undefined;
    const r = this.source.trim();
    this.source = "";

    return r || undefined;
  }

}

interface DocumentingEvents {

  // not applied to anything (holds true from definition to end)
  'alias': (range: Range, alias: string, type: Type) => void;
  'global': (range: Range, name: string, type?: Type, description?: string) => void;

  // applied to object (on next line or same line)
  'type': (range: Range, types: Type[]) => void;
  'param': (range: Range, name: string | null, type?: Type, description?: string) => void;
  'return': (range: Range, type: Type, description?: string) => void;
  'field': (range: Range, name: string | Type, type?: Type, description?: string) => void;
  'see': (range: Range, ref?: string) => void;
  'todo': (range: Range, description?: string) => void;

  'unknown': (range: Range, tag: string, text: string) => void;
  'documentation': (range: Range, text: string) => void;

  'locate': (range: Range, name: string, variable: VarInfo, reason: LocateReason) => void; // YYY: not quite a variable, but an alias..

}

/**
 * gather variable metadata (eg. typing, documentation, ...) from doc comments (3 leading `-`)
 * 
 * @emits &lt;tag&gt; when a tag is encountered
 * @emits 'unknown' when an unknown tag is encountered
 * @emits 'docmentation' for arbitrary doc string
 */
export class Documenting extends TypedEmitter<DocumentingEvents> {

  public readonly alias: Record<string, TypeAlias | undefined> = {}; // TODO: alias types registry
  public readonly globals: Record<string, VarInfo | undefined> = {};

  private entries: Metadata[] = [];

  /**
   * find matching documentation for a location
   * 
   * looks for documentation on the line above and the same line
   * 
   * ```lua
   * --- this will match for `a`
   * a = something()
   * 
   * b = something() --- this will for `b`
   * 
   * c = something()
   * --- this will not for `c`
   * ```
   */
  public matching(location: Location): Metadata | undefined {
    return this
      .entries
      .find(it => it
        .sources
        .find(ti =>
          ti.start.line === location.line - 1 // line above
          || ti.start.line === location.line // same line
        )
      );
  }

  /**
   * process a doc comment
   * 
   * only 1 tag is expected by line of text
   * 
   * @param range the range of the ast.Comment node
   * @param text the comment's `.value` (trailing `-`s stripped)
   * 
   * @todo TODO: handle parsing failures gracefully
   */
  public process(range: Range, text: string) {
    const last = this.entries[this.entries.length-1];
    const following = last?.isFollowUp(range);
    const entry = following ? last : new Metadata();

    if (!following) this.entries.push(entry);
    entry.sources.push(range);

    let buildingFunction: {
        parameters: TypeFunction['parameters'],
        returns: VarInfo[], //TypeFunction['returns'],
      } | undefined;
    let buildingTable: {
        fields: TypeTable['fields'],
        indexers: TypeTable['indexers'],
      } | undefined;

    // YYY: types spanning multiple lines..?
    text.split("\n").forEach((line, k) => {
      // find if startswith a tag
      //   if not, simple documentation, entry.pushDescription()
      // else
      //   a 'alias' or 'global' is added to corresponding record
      //     (note that it does continue entry for nay subsequent thing)
      //   other tags are either typing or documentation tag (eg todo)
      //     typing tags attempt to complete the entry's type
      //     other documentation tags are added to the entry.tags

      const match = /^(\s*)@(\w+)(\s*)(.*?)\s*$/.exec(line);
      if (match) {
        const [_, before, tag, between, text] = match;

        const startLocation = new Location(
          range.start.line + k,
          !k ? range.start.character + before.length : before.length
        );
        const endLocation = new Location(
          startLocation.line,
          startLocation.character + tag.length + between?.length ?? 0 + text?.length ?? 0,
        );
        const tagRange = new Range(
          startLocation,
          endLocation,
        );

        const bidoof = new Bidoof(text);

        which: switch (tag) {

          case 'alias': {
            const alias = bidoof.nextName();
            if (!alias) throw "not implemented: signal erroneous <alias>";

            if (!bidoof.nextExact('=')) throw "not implemented: signal missing <token> '='";

            const type = bidoof.nextType();
            if (!type) throw "not implemented: signal missing <type>";

            this.alias[alias] = Type.make(TypeAlias, alias, entry, type);
            this.emit('alias', tagRange, alias, type);
          } break;

          case 'global': {
            const name = bidoof.nextName();
            if (!name) throw "not implemented: signal erroneous <name>";

            const type = bidoof.nextExact(':') && bidoof.nextType();

            if (type) this.globals[name] = { type, doc: entry };
            this.emit('global', tagRange, name, type, bidoof.rest());
          } break;

          case 'type': {
            const first = bidoof.nextType();
            if (!first) throw "not implemented: signal missing <type>";

            const types = [first];
            while (bidoof.nextExact(',')) {
              const next = bidoof.nextType();
              if (!next) throw "not implemented: signal missing <type>";

              types.push(next);
            }

            entry.types.push(...types);
            this.emit('type', tagRange, types);
          } break;

          case 'param': {
            const name = bidoof.nextName() ?? (bidoof.nextExact("...") && "...");
            if (!name) throw "not implemented: signal erroneous <name>";

            const type = bidoof.nextExact(':') && bidoof.nextType();

            let p = (buildingFunction
              ?? (buildingFunction = {
                  parameters: { names: [], infos: [], vararg: null },
                  returns: [],
                })
              ).parameters;
            p.names.push(name);
            p.infos.push({
              type: type ?? Type.make(TypeSome, null!, name),
              doc: entry, // bidoof.rest()
            });
            this.emit('param', tagRange, name, type, bidoof.rest());
          } break;

          case 'return': {
            const type = bidoof.nextType();
            if (!type) throw "not implemented: signal erroneous <type>";

            let r = (buildingFunction
              ?? (buildingFunction = {
                  parameters: { names: [], infos: [], vararg: null },
                  returns: [],
                })
              ).returns;
            r.push({
              type: type,
              doc: entry, // bidoof.rest()
            });
            this.emit('return', tagRange, type, bidoof.rest());
          } break;

          case 'field': {
            const name = bidoof.nextName();
            const indexer = name ? undefined : bidoof.nextExact('[') && bidoof.nextType();
            const base = name ?? indexer;
            if (!base) throw "not implemented: signal erroneous <name>";
            if (!name) {
              if (!bidoof.nextExact(']')) throw "not implemented: signal missing <token> ']'";
              //if (!isIndexerType(indexer)) throw // or do it earier knowing that we only accept "boolean", "number", "string", "table", "function" [, "thread"?] exactly
            }

            const type = bidoof.nextExact(':') && bidoof.nextType();

            const info = {
              type: type ?? Type.noType(),
              doc: entry, // bidoof.rest()
            };
            let t = buildingTable
              ?? (buildingTable = {
                  fields: {},
                  indexers: [],
                });
            if (indexer) t.indexers.push([indexer, info]);
            else t.fields[name!] = info
            this.emit('field', tagRange, base, type, bidoof.rest());
          } break;

          case 'see':
          case 'todo': {
            const text = bidoof.rest();
            entry.description.pushTag(tag, text ?? "");
            this.emit(tag, tagRange, text);
          } break;

          default: {
            entry.description.pushTag(tag, text);
            this.emit('unknown', tagRange, tag, text);
          }
        }
      } else {
        line = line.trim();
        entry.description.pushText(line);
        this.emit('documentation', range, line); // addapt the range here too?
      }
    });

    if (!entry.type) {
      if (buildingFunction) {
        const type = Type.make(TypeFunction, buildingFunction.parameters);
        type.setReturns(buildingFunction.returns);
        entry.types.push(type);
      }

      if (buildingTable) {
        const type = Type.make(TypeTable);
        Object
          .entries(buildingTable.fields)
          .forEach(([field, info]) =>
            type.setField(field, info)
          );
        buildingTable.indexers
          .forEach(([indexer, info]) =>
            type.setIndexer(indexer, info)
          );
        entry.types.push(type);
      }
    }
  }

}
