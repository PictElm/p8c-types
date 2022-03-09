import { Options, parse } from 'pico8parse';
import { Documenting } from './documenting';
import { Handling } from './handling';
import { Document, Range } from './locating';
import { log } from './logging';
import { LocateReason, Scoping, VarInfo } from './scoping';

const options: Partial<Options> = {
  comments: true,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

function main(args: string[]) {
  // log.level = 'none';

  const src = `
--- @remark some
--- @remark more
--- this is a string
--- and here is its description
--- (a third line)
string = "hello world"

a = {} --- tablabla

a.test = string
`;
  Document.loadString(src);

  const scoping = new Scoping();
  const documenting = new Documenting();
  const handling = new Handling(scoping, documenting);

  scoping
    //.on('fork', loc => log.event(`new scope from: ${loc}`))
    //.on('join', loc => log.event(`end of scope @: ${loc}`))
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
        .split("\n")
        .join("\n\t> ")
      ?? "* nothing *"
    }`,
  ].join("\n"));
}
