import { expect } from 'chai';

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

describe("handle", async () => {

  const base = join(__dirname, "snippets");
  const files = await readdir(base);

  files.forEach(async name => {
    const snip = await readFile(join(base, name));

    ;

    it(name, () => {
      ;

      expect("yes").to.equal("yes")
    });
  });

});
