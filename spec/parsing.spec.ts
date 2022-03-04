import { expect, use } from 'chai';
import chaiExclude from 'chai-exclude';
use(chaiExclude);

import { parseType } from '../src/parsing';
import { TypeString } from '../src/typing';


describe("parse", () => {

  const expectCommon = (o: unknown) => ({ to: expect(o).excluding('_id').deep });

  it("exists", () => expect(parseType).to.not.be.undefined);

  it("succeed", () => expectCommon(parseType("string")).to.equal(new TypeString()));

});
