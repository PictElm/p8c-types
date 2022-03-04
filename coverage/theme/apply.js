const fs = require('fs');
function copy(file) { fs.copyFileSync("coverage/theme/" + file, "coverage/" + file); }

copy("base.css");
copy("prettify.css");
copy("sort-arrow-sprite.png");
