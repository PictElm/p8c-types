import { TypedEmitter } from 'tiny-typed-emitter';
import { Range } from './locating';
import { parseType } from './parsing';
import { Type } from './typing';

class Description extends Array<string> {

  public readonly tags: Record<string, string[]> = {};

  public pushTag(tag: string, text: string) {
    const it = this.tags[tag] ?? (this.tags[tag] = []);
    it.push(text);
  }

}

export class Metadata {

  private static _lastId = 0;
  protected readonly _id = ++Metadata._lastId;

  public readonly sources: Range[] = [];

  public readonly description: Description = new Description();
  public readonly type?: Type;

  public isFollowUp(range: Range) {
    const last = this.sources[this.sources.length-1];
    return last.end.line + 1 === range.start.line;
  }

  public toString() { return `Metadata@_id${this._id}`; }

}

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
    if (!this.source) undefined;
    const r = this.source.trim();

    this.source = "";
    return r;
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
  'see': (range: Range, ref: any) => void;
  'todo': (range: Range, description?: string) => void; // YYY: may also not be applied anything

  'unknown': (range: Range, tag: string, text: string) => void;
  'documentation': (range: Range, text: string) => void;

}

export class Documenting extends TypedEmitter<DocumentingEvents> {

  private alias: Record<string, Type> = {};
  private globals: Record<string, Type> = {};

  private entries: Metadata[] = [];

  public process(range: Range, text: string) {
    const last = this.entries[this.entries.length-1];
    const following = last?.isFollowUp(range);
    const entry = following ? last : new Metadata();

    if (!following) this.entries.push(entry);
    entry.sources.push(range);

    text.split("\n").forEach(line => {
      line = line.trim();
      if (!line) return; // YYY: discard empty lines

      // find if startswith a tag
      //   if not, simple documentation, entry.pushDescription()
      // else
      //   a 'alias' or 'global' is added to corresponding record
      //     (note that it does continue entry for nay subsequent thing)
      //   other tags are either typing or documentation tag (eg todo)
      //     typing tags attempt to complete the entry's type
      //     other documentation tags are added to the entry.tags

      const match = /^\s*@(\w+)(?:\s+(.*)|$)/.exec(line);
      if (match) {
        const tagRange: Range = Range.emptyRange(); // TODO: resolve exact range for the match within text

        const [_, tag, text] = match;
        const bidoof = new Bidoof(text);

        which: switch (tag) {

          case 'alias': {
            const alias = bidoof.nextName();
            if (!alias) throw "not implemented: signal erroneous <alias>";

            if (!bidoof.nextExact('=')) throw "not implemented: signal missing <token> '='";

            const type = bidoof.nextType();
            if (!type) throw "not implemented: signal missing <type>";

            this.alias[alias] = type;
            this.emit('alias', tagRange, alias, type);
          } break;

          case 'global': {
            const name = bidoof.nextName();
            if (!name) throw "not implemented: signal erroneous <name>";

            const type = bidoof.nextExact(':') && bidoof.nextType();

            if (type) this.globals[name] = type; // XXX: _buuuut_ the description metadata is not carried!
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

            this.emit('type', tagRange, types);
          } break;

          case 'param': {
            const name = bidoof.nextName() ?? (bidoof.nextExact("...") && "...");
            if (!name) throw "not implemented: signal erroneous <name>";

            const type = bidoof.nextExact(':') && bidoof.nextType();

            this.emit('param', tagRange, name, type, bidoof.rest());
          } break;

          case 'return': {
            const type = bidoof.nextType();
            if (!type) throw "not implemented: signal erroneous <type>";

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

            this.emit('field', tagRange, base, type, bidoof.rest());
          } break;

          case 'see': {
            this.emit('see', tagRange, bidoof.rest()); // XXX: parse ref as one of: name, alias, file, url
          } break;

          case 'todo': {
            this.emit('todo', tagRange, bidoof.rest());
          } break;

          default: {
            entry.description.pushTag(tag, text);
            this.emit('unknown', tagRange, tag, text);
          }
        }
      } else {
        entry.description.push(line);
        this.emit('documentation', range, line); // YYY: addapt the range here too?
      }
    });
  }

}
