import { Options, parse } from 'pico8parse';
import { Documenting } from './documenting';
import { Handling } from './handling';
import { Document, Range } from './locating';
import { log } from './logging';
import { Parser } from './parsing';
import { LocateReason, Scoping, VarInfo } from './scoping';

const options: Partial<Options> = {
  comments: true,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

let scopeIndentation = 0;
function indentation() {
  return "\t".repeat(scopeIndentation);
}

function main(args: string[]) {
  try {
    const stt = { index: 0 };
    const str = "(p: <p>) -> [<p>] some kind of cool type";
    const res = Parser.parseType(str, stt); //parseType(str, stt);
    log.event(res && JSON.parse(JSON.stringify(res)));
    log.event(str.slice(stt.index));
  } catch (err) {
    if (err instanceof Parser.SyntaxError)
      log.event(err.message);
    else throw err;
  }
  return;
  // log.level = 'none';

  const src = `
x, y, z = 0
a = 0
while z do
  a = ""
  b = true
end
b = a, b
`;
  Document.loadString(src);

  const scoping = new Scoping();
  const documenting = new Documenting();
  const handling = new Handling(scoping, documenting);

  scoping
    .on('fork', loc => log.event(`${"\t".repeat(scopeIndentation++)}{ new scope from: ${loc}`))
    .on('join', loc => log.event(`${"\t".repeat(--scopeIndentation)}} end of a scope: ${loc}`))
    //.on('pushContext', (loc, ctx) => log.event(`new context '${ctx}': ${loc}`))
    //.on('popContext', (loc, ctx) => log.event(`end context '${ctx}': ${loc}`))
    .on('locate', onLocate)
    ;

  documenting
    //.on('type', (range, type) => log.event(`${range.start}: @type ${1 === type.length ? type[0] : `[${type.map(it => it.itself).join(", ")}]`}`))
    //.on('alias', (range, alias, type) => log.event(`${range.start}: @alias ${alias} = ${type.itself}`))
    //.on('documentation', (range, text) => log.event(`${range.start}: arbitrary documentation "${text}"`))
    ;

  handling
    //.on('handle', node => log.info("handling node of type " + node.type))
    ;

  handling.handle(parse(src, options));
}

main(process.argv.slice(2));

function onLocate(range: Range, name: string, info: VarInfo, why: LocateReason) {
  log.event([
    `${range.start}: {${LocateReason[why]}}`,
    `\t${name}: ${info.type.itself}`,
    `\t> ${info.doc?.description
        .toString()
        .replace("\r", "")
        .split(`\n${indentation()}`)
        .join(`\n${indentation()}\t> `)
      ?? "* nothing *"
    }`,
  ].join(`\n${indentation()}`));
}
