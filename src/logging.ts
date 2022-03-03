
export class log {

  public static level: 'info' | 'warn' | 'err' | 'none' = 'info';

  public static coucou(tag?: number) {
    log.info("coucou" + (tag ?? ""));
  }

  public static trace() {
    console.trace();
  }

  public static info(o: unknown) {
    if ('info' === this.level) {
      if (Object(o) !== o) console.log("[INFO]: " + o);
      else if (Array.isArray(o) && 1 < o.length) console.table(o);
      else console.dir(o, { depth: 42 });
    }
  }

  public static warn(o: unknown) {
    if ('info' === this.level || 'warn' === this.level)
      console.warn("[WARN]: " + o);
  }

  public static error(o: unknown) {
    if ('info' === this.level || 'warn' === this.level || 'err' === this.level)
      console.error("[ERROR]: " + o);
  }

}
