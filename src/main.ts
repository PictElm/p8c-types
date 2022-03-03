import { readFileSync } from 'fs';
import { ast, parse } from 'pico8parse';
import { Handling } from './handling';
import { CurrentDocument } from './locating';
import { log } from './logging';
import { Scoping } from './scoping';

const options = {
  comments: false,
  locations: true,
  scope: false,
  ranges: false,
};

function main(args: string[]) {
  const src = //readFileSync("../sample.lua");
`
z = function(tab) tab.a = 0 return tab end
o = z({})

-- z = function(tab) return tab.blabla.ok end
-- o, q = z({ blabla={ok=false}, coucou=42 })
`;
  CurrentDocument.setCurrent(src);

  const ast = parse(src, options);
  const scoping = new Scoping();

  log.info(ast);
  Handling.handle(scoping, ast);
}

main(process.argv.slice(2));
