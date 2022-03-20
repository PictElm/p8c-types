import { MetaOpsType } from '../operating';
import { VarInfo } from '../scoping';
import { BaseType, Type } from './internal';

export class TypeTable extends BaseType {

  private fields: Record<string, VarInfo> = {};
  private indexers: Array<[Type, VarInfo]> = []; // YYY: indexing by VarInfo? (would carry eg. doc)

  /** set an entry of known (string) name */
  public setField(field: string, info: VarInfo) {
    this.fields[field] = info;
  }

  /** get an entry of known (string) name */
  public getField(field: string): VarInfo {
    return this.fields[field] ?? { type: Type.noType() };
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

  /** when set do not compute (there is a circular reference somewhere) */
  private loopProtection: boolean = false;
  public override toString() {
    if (this.loopProtection) return "*" + this.outself.toString(); // YYY: _id
    this.loopProtection = true;

    const r: string[] = [];

    for (const key in this.fields)
      r.push(`${key}: ${this.fields[key].type.itself}`);

    this.indexers.forEach(([indexer, info]) =>
      r.push(`[${indexer}]: ${info.type.itself}`)
    );

    this.loopProtection = false;
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

  public override resolved() {
    const info = BaseType.marking({}, this.outself);
    if (info.type) return BaseType.marked(info);

    info.type = Type.make(TypeTable);
    const tableType = info.type.as(TypeTable)!;

    for (const key in this.fields)
      tableType.setField(key, this.fields[key].type.itself.resolved());

    this.indexers.forEach(([indexer, info]) =>
      tableType.setIndexer(indexer, info.type.itself.resolved()) // YYY: indexer.resolved()?
    );

    return BaseType.mark(info, this.outself);
  }

  // XXX/TODO: table metatable (yes, that exists)
  public override metaOps: Partial<MetaOpsType> = {
    __index(self, key) {
      const asTable = self.type.as(TypeTable)!;
      if ('string' === typeof key || 'number' === typeof key)
        return asTable.getField(`${key}`);
      return asTable.getIndexer(key.type)[1];
    },
    __newindex(self, key, value) {
      const asTable = self.type.as(TypeTable)!;
      if ('string' === typeof key || 'number' === typeof key)
        asTable.setField(`${key}`, value);
      else asTable.setIndexer(key.type, value);
    },
  };

}
