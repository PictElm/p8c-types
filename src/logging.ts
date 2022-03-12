
export class log {

  /** 'info' > 'warn' > 'err' > 'none' */
  public static level: 'info' | 'warn' | 'err' | 'none' = 'info';

  /** trace is always logged */
  public static trace() {
    console.trace();
  }

  /** event are always logged */
  public static event(o: unknown) {
    if (Object(o) !== o) console.log("[EVENT]: " + o);
    else if (Array.isArray(o) && 1 < o.length) console.table(o);
    else console.dir(o, { depth: 42 });
  }

  /** only when level is at least 'info' */
  public static info(o: unknown) {
    if ('info' === this.level) {
      if (Object(o) !== o) console.log("[INFO]: " + o);
      else if (Array.isArray(o) && 1 < o.length) console.table(o);
      else console.dir(o, { depth: 42 });
    }
  }

  /** only when level is at least 'warn' */
  public static warn(o: unknown) {
    if ('info' === this.level || 'warn' === this.level)
      console.warn("[WARN]: " + o);
  }

  /** only when level is at least 'err' */
  public static error(o: unknown) {
    if ('info' === this.level || 'warn' === this.level || 'err' === this.level)
      console.error("[ERROR]: " + o);
  }

}
