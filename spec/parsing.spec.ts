import { expect } from 'chai';

import { readFileSync, writeFileSync } from 'fs';
import prettyCompact from 'json-stringify-pretty-compact';
import { fromJSON as fromPOJO, toJSON as toPOJO } from 'flatted';

import { parseType } from '../src/parsing';

// set to {} to update test results
let generated: Record<string, any[]> | undefined;

function expectCorrect(typeRepr: string, typeJSON: any, kind: string) {
  const state = { index: 0 };
  const type = parseType(typeRepr, state);
  const rest = typeRepr.slice(state.index);

  (rest.endsWith("FAILS")
    ? expect(type).to
    : expect(type).to.not
  ).be.undefined;

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
    "misc": [
      "(:                             -- unexpected token -- FAILS",
      "(a                             -- expected token (in `default`) -- FAILS",
      "$                              -- expected token (in `else`) -- FAILS",
    ],
    "simples": [
      "nil",
      "boolean",
      "number",
      "string",
    ],
    "literals": [
      "true",
      "false",
      "42",
      "-1",
      "0",
      "+1",
      "0x",
      "0xy",
      "0x2A",
      "0b110",
      "0o66",
      "'yes'",
      "'unfinished",
    ],
    "alias": [
      "SomeType_0",
      "sometype_1",
    ],
    "typeof": [
      "<bla>",
      "<*-*>                          -- FAILS",
    ],
    "tables": [
      "{}",
      "{ a: number, b: string }",
      "{ c: { z: {} } }",
    ],
    "functions": [
      "() -> []",
      "(p: number) -> [string, boolean]",
      "(q: string | nil, p: number) -> [string]",
      "(p: string) -> [number | nil]",
      "() -> Potato                   -- expected <tuple> -- FAILS", // YYY
      "(...) -> [a, b, c]",
      "(a: number, ...) -> [string, string | nil, string]",
      "(a: number, *-*) -> []         -- FAILS",
      "(...: [a, b, c]) -> [boolean]",
      "(o: <o>) -> [{ it: <o> }]",
    ],
    "threads": [
      "() ~*",
      "() ~~~~                        -- FAILS",
      "(a: number) ~> () ~~~          -- FAILS",
      "(a: number) ~*",
      "(a: boolean) ~> (b: number) ~> (c: string) ~*",
      "(a: number) ~> (b: Potato      -- FAILS",
      "(a: number) ~> (...: [Potatoes]) ~*",
    ],
    "unions and intersections": [
      "a | b & c",
      "(a | b) & c",
      "a & (b | c)",
      "a & b | c",
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
  "misc": [[], [], []],
  "simples": [
    [{"TypeNil": null}],
    [{"TypeBoolean": null}],
    [{"TypeNumber": null}],
    [{"TypeString": null}]
  ],
  "literals": [
    [{"TypeLiteralBoolean": true}],
    [{"TypeLiteralBoolean": false}],
    [{"TypeLiteralNumber": 42}],
    [{"TypeLiteralNumber": 1}],
    [{"TypeLiteralNumber": 0}],
    [{"TypeLiteralNumber": -1}],
    [{"TypeLiteralNumber": 0}],
    [{"TypeLiteralNumber": 0}],
    [{"TypeLiteralNumber": 2}],
    [{"TypeLiteralNumber": 1}],
    [{"TypeLiteralNumber": 6}],
    [{"TypeLiteralString": "1"}, "yes"],
    [{"TypeLiteralString": "1"}, "unfinished"]
  ],
  "alias": [
    [{"TypeAlias": "1"}, {"alias": "2"}, "SomeType_0"],
    [{"TypeAlias": "1"}, {"alias": "2"}, "sometype_1"]
  ],
  "typeof": [[{"TypeSome": "1"}, {"from": "2", "done": null}, "bla"], []],
  "tables": [
    [{"TypeTable": "1"}, {"fields": "2", "indexers": "3"}, {}, []],
    [
      {"TypeTable": "1"},
      {"fields": "2", "indexers": "3"},
      {"a": "4", "b": "5"},
      [],
      {"TypeNumber": null},
      {"TypeString": null}
    ],
    [
      {"TypeTable": "1"},
      {"fields": "2", "indexers": "3"},
      {"c": "4"},
      [],
      {"TypeTable": "5"},
      {"fields": "6", "indexers": "7"},
      {"z": "8"},
      [],
      {"TypeTable": "9"},
      {"fields": "10", "indexers": "11"},
      {},
      []
    ]
  ],
  "functions": [
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      [],
      [],
      []
    ],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6", "7"],
      ["8"],
      ["9"],
      {"TypeString": null},
      {"TypeBoolean": null},
      "p",
      {"TypeNumber": null}
    ],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6"],
      ["7", "8"],
      ["9", "10"],
      {"TypeString": null},
      "q",
      "p",
      {"TypeUnion": "11"},
      {"TypeNumber": null},
      {"left": "12", "right": "13"},
      {"TypeString": null},
      {"TypeNil": null}
    ],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6"],
      ["7"],
      ["8"],
      {"TypeUnion": "9"},
      "p",
      {"TypeString": null},
      {"left": "10", "right": "11"},
      {"TypeNumber": null},
      {"TypeNil": null}
    ],
    [],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6", "7", "8"],
      [],
      [],
      {"TypeAlias": "9"},
      {"TypeAlias": "10"},
      {"TypeAlias": "11"},
      {"alias": "12"},
      {"alias": "13"},
      {"alias": "14"},
      "a",
      "b",
      "c"
    ],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6", "7", "8"],
      ["9"],
      ["10"],
      {"TypeString": null},
      {"TypeUnion": "11"},
      {"TypeString": null},
      "a",
      {"TypeNumber": null},
      {"left": "12", "right": "13"},
      {"TypeString": null},
      {"TypeNil": null}
    ],
    [],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6"],
      [],
      [],
      {"TypeBoolean": null}
    ],
    [
      {"TypeFunction": "1"},
      {"parameters": "2", "returns": "3"},
      {"names": "4", "types": "5"},
      ["6"],
      ["7"],
      ["8"],
      {"TypeTable": "9"},
      "o",
      {"TypeSome": "10"},
      {"fields": "11", "indexers": "12"},
      {"from": "7", "done": null},
      {"it": "13"},
      [],
      {"TypeSome": "14"},
      {"from": "7", "done": null}
    ]
  ],
  "threads": [
    [
      {"TypeThread": "1"},
      {"signatures": "2"},
      ["3"],
      {"parameters": "4"},
      {"names": "5", "types": "6"},
      [],
      []
    ],
    [],
    [],
    [
      {"TypeThread": "1"},
      {"signatures": "2"},
      ["3"],
      {"parameters": "4"},
      {"names": "5", "types": "6"},
      ["7"],
      ["8"],
      "a",
      {"TypeNumber": null}
    ],
    [
      {"TypeThread": "1"},
      {"signatures": "2"},
      ["3", "4", "5"],
      {"parameters": "6"},
      {"parameters": "7"},
      {"parameters": "8"},
      {"names": "9", "types": "10"},
      {"names": "11", "types": "12"},
      {"names": "13", "types": "14"},
      ["15"],
      ["16"],
      ["17"],
      ["18"],
      ["19"],
      ["20"],
      "c",
      {"TypeString": null},
      "a",
      {"TypeBoolean": null},
      "b",
      {"TypeNumber": null}
    ],
    [],
    [
      {"TypeThread": "1"},
      {"signatures": "2"},
      ["3", "4"],
      {"parameters": "5"},
      {"parameters": "6"},
      {"names": "7", "types": "8"},
      {"names": "9", "types": "10"},
      [],
      [],
      ["11"],
      ["12"],
      "a",
      {"TypeNumber": null}
    ]
  ],
  "unions and intersections": [
    [
      {"TypeUnion": "1"},
      {"left": "2", "right": "3"},
      {"TypeAlias": "4"},
      {"TypeIntersection": "5"},
      {"alias": "6"},
      {"left": "7", "right": "8"},
      "a",
      {"TypeAlias": "9"},
      {"TypeAlias": "10"},
      {"alias": "11"},
      {"alias": "12"},
      "b",
      "c"
    ],
    [
      {"TypeIntersection": "1"},
      {"left": "2", "right": "3"},
      {"TypeUnion": "4"},
      {"TypeAlias": "5"},
      {"left": "6", "right": "7"},
      {"alias": "8"},
      {"TypeAlias": "9"},
      {"TypeAlias": "10"},
      "c",
      {"alias": "11"},
      {"alias": "12"},
      "a",
      "b"
    ],
    [
      {"TypeIntersection": "1"},
      {"left": "2", "right": "3"},
      {"TypeAlias": "4"},
      {"TypeUnion": "5"},
      {"alias": "6"},
      {"left": "7", "right": "8"},
      "a",
      {"TypeAlias": "9"},
      {"TypeAlias": "10"},
      {"alias": "11"},
      {"alias": "12"},
      "b",
      "c"
    ],
    [
      {"TypeUnion": "1"},
      {"left": "2", "right": "3"},
      {"TypeIntersection": "4"},
      {"TypeAlias": "5"},
      {"left": "6", "right": "7"},
      {"alias": "8"},
      {"TypeAlias": "9"},
      {"TypeAlias": "10"},
      "c",
      {"alias": "11"},
      {"alias": "12"},
      "a",
      "b"
    ]
  ]
}/*-*/;
}
