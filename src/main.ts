import { Options, parse } from 'pico8parse';
import { Handling } from './handling';
import { CurrentDocument } from './locating';
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
  const src = `
z = function(tab) tab.num, tab.str = 0, "" return tab end
o = z({})
`;
  CurrentDocument.setCurrent(src);

  const ast = parse(src, options);
  const scoping = new Scoping();

  log.info(ast);
  Handling.handle(scoping, ast);
}

main(process.argv.slice(2));
