import { Options, parse } from 'pico8parse';
import { Documenting } from './documenting';
import { Handling } from './handling';
import { Document } from './locating';
import { log } from './logging';
import { LocateReason, Scoping } from './scoping';

const options: Partial<Options> = {
  comments: true,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

function main(args: string[]) {
  log.level = 'none';

  const src = `
z = function(p) return p end
o = z(z)
o = z(o)
o = o(z)
o = o(o)

--- @alias Some = string
--[[-
	just some string
]]
someString = "hello world"

--- more
--- test

z = function(tab) tab.num, tab.str = 0, "" return tab end
o = z({})
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
    .on('locate', (range, name, type, why) => log.event(`${range.start}: {${LocateReason[why]}} ${name}: ${type.itself}`))
    ;

  documenting
    .on('type', (range, type) => log.event(`${range.start}: @type ${1 === type.length ? type[0] : `[${type.map(it => it.itself).join(", ")}]`}`))
    .on('alias', (range, alias, type) => log.event(`${range.start}: @alias ${alias} = ${type.itself}`))
    .on('documentation', (range, text) => log.event(`${range.start}: arbitrary documentation "${text}"`))
    ;

  handling
    .on('handle', node => log.info("handling node of type " + node.type))
    ;

  handling.handle(parse(src, options));
}

main(process.argv.slice(2));
