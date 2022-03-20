import { Options, parse } from 'pico8parse';
import { Documenting } from './documenting';
import { Handling } from './handling';
import { Document, Range } from './locating';
import { log } from './logging';
import { Parser } from './parsing';
import { LocateReason, Scoping, VarInfo } from './scoping';

const options: Partial<Options> = {
  comments: true,
  locations: true,
  scope: false,
  ranges: false,
  encodingMode: 'pseudo-latin1',
};

let scopeIndentation = 0;
function indentation() {
  return "\t".repeat(scopeIndentation);
}

function main(args: string[]) {
  // log.level = 'none';

  const src = `function a(t) return t.y() end b = a{y=function()return 10 end}`; `
--- @alias Color = 0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15

--- @global print: (o: <o>, x: number|nil, y,: number|nil col: Color|nil) Prints a string of characters to the screen.
--- @see https://pico-8.fandom.com/wiki/Print

--- creates a new potato
--- @param color: Color
function Potato(self, color)
  --- @todo set metatable (and much more)
  self.__proto = Potato -- we can't do that yet, check back later

  self.some = "thing"
  self.color = color

  return self
end

--- this is a potato
p = Potato({}, 2) -- does not have the right type (simply "{}"...)

-- this explodes with "TypeSome.revert: not acting as anything"
--p = Potato()
`; `
function class(classname)
  return function(proto)

    proto.__classname = classname

    local function ctor(...)
      --- @todo set metatable (and much more)
      local it = { __proto=proto, __ctor=ctor }
      return proto.__init(it, ...)
    end

    return ctor

  end
end

--- @alias Color = 0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15

--- @global print: (o: <o>, x: number|nil, y,: number|nil col: Color|nil) Prints a string of characters to the screen.
--- @see https://pico-8.fandom.com/wiki/Print

--- creates a new potato
--- @param color: Color
Potato = class 'Potato' {

  --- @param color: Color
  __init=function(self, color)
    self.some = "thing"
    self.color = color
    return self
  end,

}

--- this is a potato
p = Potato(2)
`; `
x, y, z = 0
a = 0
while z do
  a = ""
  b = true
end
b = a, b
`;
  Document.loadString(src);

  const scoping = new Scoping();
  const documenting = new Documenting();
  const handling = new Handling(scoping, documenting);

  scoping
    //.on('fork', loc => log.event(`${"\t".repeat(scopeIndentation++)}{ new scope from: ${loc}`))
    //.on('join', loc => log.event(`${"\t".repeat(--scopeIndentation)}} end of a scope: ${loc}`))
    //.on('pushContext', (loc, ctx) => log.event(`new context '${ctx}': ${loc}`))
    //.on('popContext', (loc, ctx) => log.event(`end context '${ctx}': ${loc}`))
    .on('locate', onLocate)
    ;

  documenting
    //.on('type', (range, type) => log.event(`${range.start}: @type ${1 === type.length ? type[0] : `[${type.map(it => it.itself).join(", ")}]`}`))
    //.on('alias', (range, alias, type) => log.event(`${range.start}: @alias ${alias} = ${type.itself}`))
    //.on('documentation', (range, text) => log.event(`${range.start}: arbitrary documentation "${text}"`))
    ;

  handling
    //.on('handle', node => log.info("handling node of type " + node.type))
    ;

  handling.handle(parse(src, options));
}

main(process.argv.slice(2));

function onLocate(range: Range, name: string, info: VarInfo, why: LocateReason) {
  log.event([
    `${range.start}: {${LocateReason[why]}}`,
    `\t${name}: ${info.type.itself}`,
    `\t> ${info.doc?.description
        .toString()
        .replace("\r", "")
        .split(`\n${indentation()}`)
        .join(`\n${indentation()}\t> `)
      ?? "* nothing *"
    }`,
  ].join(`\n${indentation()}`));

  if (LocateReason.Write === why) log.info(info);
}
