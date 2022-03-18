import { VarInfo } from './scoping';
import { Type, TypeFunction, TypeLiteralNumber, TypeNumber, TypeSome, TypeTable } from './typing';

export type MetaOpsNames = { [T in keyof typeof MetaOps]: typeof MetaOps[T] };
export type MetaOpsType = typeof MetaOps;

export class MetaOpsError extends TypeError {

  public involved: VarInfo[];

  public constructor(opName: string, ...involved: VarInfo[]) {
    super(`cannot perform '${opName}' on '${involved.join("', '")}'`);
    this.involved = involved;
  }

}

/** @see http://www.lua.org/manual/5.2/manual.html#2.4 */
export namespace MetaOps {

  /**
   * ```lua
   * function add_event (op1, op2)
   *   local o1, o2 = tonumber(op1), tonumber(op2)
   *   if o1 and o2 then  -- both operands are numeric?
   *     return o1 + o2   -- '+' here is the primitive 'add'
   *   else  -- at least one of the operands is not numeric
   *     local h = getbinhandler(op1, op2, "__add")
   *     if h then
   *       -- call the handler with both operands
   *       return (h(op1, op2))
   *     else  -- no handler available: default behavior
   *       error(···)
   *     end
   *   end
   * end
   * ```
   */
  export function __add(left: VarInfo, right: VarInfo): VarInfo {
    const o1 = left.type.itself;
    const o2 = right.type.itself;

    if (o1 instanceof TypeNumber && o2 instanceof TypeNumber)
      return { type: Type.make(TypeNumber) };

    const h = o1.metaOps.__add ?? o2.metaOps.__add;
    if (h) return h(left, right);

    throw new MetaOpsError('__add', left, right);
    return { type: Type.noType() };
  }

  export function __sub(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __mul(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __div(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __mod(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __pow(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __concat(left: VarInfo, right: VarInfo): VarInfo { return null!; }

  export function __unm(self: VarInfo): VarInfo { return null!; }

  export function __len(self: VarInfo): VarInfo { return null!; }

  export function __eq(left: VarInfo, right: VarInfo): void { } // > Note that the result is always a boolean.

  export function __lt(left: VarInfo, right: VarInfo): void { } // > Note that the result is always a boolean.

  export function __le(left: VarInfo, right: VarInfo): void { } // > Note that the result is always a boolean.

  /**
   * ```lua
   * function gettable_event (table, key)
   *   local h
   *   if type(table) == "table" then
   *     local v = rawget(table, key)
   *     -- if key is present, return raw value
   *     if v ~= nil then return v end
   *     h = metatable(table).__index
   *     if h == nil then return nil end
   *   else
   *     h = metatable(table).__index
   *     if h == nil then
   *       error(···)
   *     end
   *   end
   *   if type(h) == "function" then
   *     return (h(table, key))     -- call the handler
   *   else return h[key]           -- or repeat operation on it
   *   end
   * end
   * ```
   */
  export function __index(self: VarInfo, key: string | number | VarInfo): VarInfo {
    return self.type.itself.metaOps.__index?.(self, key)
      ?? { type: Type.noType() };
  }

  export function __newindex(self: VarInfo, key: string | number | VarInfo, value: VarInfo): void {
    self.type.itself.metaOps.__newindex?.(self, key, value);
  }

  export function __call(self: VarInfo, parameters: VarInfo[]): VarInfo[] { // XXX: TypeTuple? rework TypeTuple to carry a `VarInfo`s instead of `Type`s
    return self.type.itself.metaOps.__call?.(self, parameters)
      ?? [{ type: Type.noType() }];
  }

}

export namespace MetaOps {

  export function __metatable(...args: unknown[]): VarInfo { return null!; } // TypeTable // YYY: not implemented

  export function __ipairs(...args: unknown[]): VarInfo { return null!; } // TypeFunction // YYY: not implemented

  export function __pairs(...args: unknown[]): unknown { return null!; } // TypeFunction     // YYY: not implemented

  export function __tostring(...args: unknown[]): unknown { return null!; } // TypeString    // YYY: not implemented

}

//export namespace MetaOp {
//
//  export function __cocreate(...args: unknown[]): unknown { return null!; }
//
//  export function __coresume(...args: unknown[]): unknown { return null!; }
//
//  export function __costatus(...args: unknown[]): unknown { return null!; }
//
//}
