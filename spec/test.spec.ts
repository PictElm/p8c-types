import { expect } from 'chai';

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Options, parse } from 'pico8parse';

describe("handle", async () => {

  const base = join(__dirname, "snippets");
  const files = await readdir(base);
  const options: Partial<Options> = {
    comments: true,
    locations: true,
    scope: false,
    ranges: false,
    encodingMode: 'pseudo-latin1',
  };

  function parseWrapper(code: string, into: { [line: number]: string }) {
    options.onCreateNode = node => {
      if ('Comment' === node.type && node.value.startsWith("//"))
        into[node.loc.start.line] = node.value.slice(2);
    };

    return parse(code, options);
  }

  Promise.all(
    files.map(async name => {
      const snip = await readFile(join(base, name)).toString();
      const expected = [];
      const ast = parseWrapper(snip, expected);

      it(name, () => {
        ;

        expect("yes").to.equal("yes")
      });
    })
  );

});
