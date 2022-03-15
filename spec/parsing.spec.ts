import { expect } from 'chai';

import { readFileSync, writeFileSync } from 'fs';
import prettyCompact from 'json-stringify-pretty-compact';
import { fromJSON as fromPOJO, toJSON as toPOJO } from 'flatted';

import { parseType } from '../src/parsing';

// set to {} to update test results
let generated: Record<string, any[]> | undefined;

function expectCorrect(typeRepr: string, typeJSON: any, kind: string) {
  const type = parseType(typeRepr);
  expect(type).to.not.be.undefined;

  const pojo = plainify(type!);
  if (generated) (generated[kind] ?? (generated[kind] = [])).push(pojo);
  else expect(elaborify(pojo)).to.deep.equal(typeJSON);
}

describe("parsing", () => {
  const inputs = getInputs();
  const outputs = getOutputs();

  for (const kind in inputs)
    describe("parses " + kind, () =>
      inputs[kind].forEach((input, k) =>
        it(input, () =>
          expectCorrect(input, outputs[kind]?.[k], kind)
        )
      )
    );

  after(() => {
    if (generated) {
      const text = readFileSync(__filename).toString();
      const end = text.lastIndexOf("/*-*/");
      const begin = text.lastIndexOf("/*-*/", end-1)+5;
      writeFileSync(__filename, [
        text.slice(0, begin),
        stringify(generated),
        text.slice(end),
      ].join(""));
    }
  });
});

/** object (may circular) -> plain (json safe) */
function plainify(value: any) { return toPOJO(value); }
/** plain (json safe) -> string */
function stringify(value: any) { return prettyCompact(value); }
/** plain (json safe) -> object (may circular) */
function elaborify(value: any) { return fromPOJO(value); }

function getInputs(): Record<string, string[]> {
  return {
    "simple": [
      "nil",
      "boolean",
      "number",
      "string",
    ],
    "literal": [
      "true",
      "false",
      "42",
      "0x2A",
      "0b110",
      "0o66",
      "'yes'",
    ],
    "alias": [
      "SomeType_0"
    ],
  };
}

function getOutputs(): Record<string, any[]> {
  return Object
    .fromEntries(Object
      .entries(results())
      .map(([k, v]) =>
        [k, v.map(elaborify)]
      )
    );
}

function results() {
  return/*-*/{
  "simple": [
    [{"TypeNil": null}],
    [{"TypeBoolean": null}],
    [{"TypeNumber": null}],
    [{"TypeString": null}]
  ],
  "literal": [
    [{"TypeLiteralBoolean": true}],
    [{"TypeLiteralBoolean": false}],
    [{"TypeLiteralNumber": 42}],
    [{"TypeLiteralNumber": 2}],
    [{"TypeLiteralNumber": 6}],
    [{"TypeLiteralNumber": 54}],
    [{"TypeLiteralString": "1"}, "yes"]
  ],
  "alias": [[{"TypeAlias": "1"}, {"alias": "2"}, "SomeType_0"]]
}/*-*/;
}
