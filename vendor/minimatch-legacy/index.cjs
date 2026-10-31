"use strict";

const upstream = require("minimatch-v11");
// Preserve callable and statically discoverable named exports for CJS and ESM consumers.
module.exports = upstream.minimatch;
module.exports.minimatch = upstream.minimatch;
module.exports.Minimatch = upstream.Minimatch;
module.exports.GLOBSTAR = upstream.GLOBSTAR;
module.exports.sep = upstream.sep;
module.exports.filter = upstream.filter;
module.exports.defaults = upstream.defaults;
module.exports.braceExpand = upstream.braceExpand;
module.exports.makeRe = upstream.makeRe;
module.exports.match = upstream.match;
module.exports.escape = upstream.escape;
module.exports.unescape = upstream.unescape;
