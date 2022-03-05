import { Options, parse } from 'pico8parse';
import { Handling } from './handling';
import { Document } from './locating';
import { log } from './logging';
import { Scoping } from './scoping';

const options: Partial<Options> = {
  comments: false,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

function main(args: string[]) {
  log.level = 'none';

  const src = `
--z = function(p) return p end
--o = z(z) -- stack overflow error

--(function(f) f(f) end)(function(f) f(f) end) -- not explored at all?

z = function(tab) tab.num, tab.str = 0, "" return tab end
o = z({})
`;
  Document.loadString(src);

  const ast = parse(src, options);
  const scoping = new Scoping();

  scoping
    .on('fork', loc => log.event(`new scope from: ${loc}`))
    .on('join', loc => log.event(`end of scope @: ${loc}`))
    .on('pushContext', (loc, tag) => log.event(`new context '${tag}': ${loc}`))
    .on('popContext', (loc, tag) => log.event(`end context '${tag}': ${loc}`))
    .on('locate', (range, name, type) => log.event(`${range.start}: ${name}: ${type}`))
    ;

  log.info(ast);
  Handling.handle(scoping, ast);
}

main(process.argv.slice(2));
