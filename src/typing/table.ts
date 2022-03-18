import { VarInfo } from '../scoping';
import { BaseType, Resolved, Type } from './internal';

export class TypeTable extends BaseType {

  private fields: Record<string, VarInfo> = {};
  private indexers: Array<[Type, VarInfo]> = [];

  /** set an entry of known (string) name */
  public setField(field: string, info: VarInfo) {
    this.fields[field] = info;
  }

  /** get an entry of known (string) name */
  public getField(field: string): VarInfo {
    return this.fields[field] ?? Type.noType();
  }

  // XXX: not sure the setIndex/getIndex methods make sense
  // may be more appropriate for a tuple type; here would rather
  // have a setTyped/getTyped with the type being 'number' or something...

  /** set an entry of known (type) indexer */
  public setIndexer(indexer: Type, info: VarInfo) {
    this.indexers.push([indexer, info]);
  }

  /** get an entry of known (type) indexer */
  public getIndexer(indexer: Type): [Type, VarInfo] {
    return this.indexers.find(it => it[0] === indexer) // XXX/TODO!!!!: type comparison (ie. "assignable to")
      ?? [indexer, { type: Type.noType() }];
  }

  public override toString() {
    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key].type.itself}`);

    this.indexers.forEach(([indexer, info]) =>
      r.push(`[${indexer}]: ${info.type.itself}`)
    );

    return r.length ? `{ ${r.join(", ")} }` : "{}";
  }

  public override toJSON() {
    return {
      fields: Object
        .fromEntries(Object
          .entries(this.fields)
          .map(([k, v]) => [k, v.type.toJSON(k)])
        ),
      indexers: this.indexers.map(([indexer, info]) => {
        const repr = indexer.toString();
        return [repr, info.type.itself.toJSON(repr)];
      }),
    };
  }

  public override resolved(): Resolved {
    const r = Type.make(TypeTable);
    const tableType = r.as(TypeTable)!;

    for (const key in this.fields)
      tableType.setField(key, {
        type: this.fields[key].type.itself.resolved(),
        doc: this.fields[key].doc,
      });

    this.indexers.forEach(([indexer, info]) =>
      tableType.setIndexer(indexer, { // YYY: .resolved()?
        type: info.type.itself.resolved(),
        doc: info.doc,
      })
    );

    return BaseType.mark(r);
  }

}
