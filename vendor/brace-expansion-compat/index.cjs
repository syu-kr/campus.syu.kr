"use strict";

const upstream = require("brace-expansion-v5");
const expand =
  typeof upstream === "function" ? upstream : upstream.expand;

if (typeof expand !== "function") {
  throw new TypeError("brace-expansion 5.0.8 expand export is unavailable");
}

module.exports = expand;
module.exports.expand = expand;
