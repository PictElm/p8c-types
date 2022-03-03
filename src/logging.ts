
export class log {

  public static level: 'info' | 'warn' | 'err' | 'none' = 'info';

  public static coucou(tag?: number) {
    log.info("coucou" + (tag ?? ""));
  }

  public static trace() {
    console.trace();
  }

  public static info(o: any) {
    if ('info' === this.level) (
      'string' === typeof o
        ? console.log
        : console.dir
    )(o);
  }

  public static warn(o: any) {
    if ('info' === this.level || 'warn' === this.level)
      console.warn(o);
  }

  public static error(o: any) {
    if ('info' === this.level || 'warn' === this.level || 'err' === this.level)
      console.error(o);
  }

}
