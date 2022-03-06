import { ast, Options, parse } from 'pico8parse';
import { Handling } from './handling';
import { Document } from './locating';
import { log } from './logging';
import { Scoping } from './scoping';

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

--z = function(tab) tab.num, tab.str = 0, "" return tab end
--o = z({})
`;
  Document.loadString(src);

  const super_comment = ast.comment;
  ast.comment = (value, raw, rawInterrupted) => {
    const r = super_comment(value, raw, rawInterrupted);
    log.event("new comment somewhere:");
    log.event(r);
    return r;
  };

  const parsed = parse(src, options);
  const scoping = new Scoping();

  scoping
    //.on('fork', loc => log.event(`new scope from: ${loc}`))
    //.on('join', loc => log.event(`end of scope @: ${loc}`))
    //.on('pushContext', (loc, ctx) => log.event(`new context '${ctx}': ${loc}`))
    //.on('popContext', (loc, ctx) => log.event(`end context '${ctx}': ${loc}`))
    .on('locate', (range, name, type, why) => log.event(`${range.start}: {${["?", "t", "r", "w"][why]}} ${name}: ${type}`))
    ;

  log.info(parsed);
  Handling.handle(scoping, parsed);
}

main(process.argv.slice(2));
