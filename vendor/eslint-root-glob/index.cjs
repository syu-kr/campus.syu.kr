const fs = require("node:fs");
const path = require("node:path");
const tiny = require("tinyglobby");

// Next's getRootDirs only calls globSync(string, { onlyDirectories: true }).
// Keep that contract small: literals, one terminal *, and one literal brace list.
function globSync(pattern, options) {
  if (
    !options || options.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== "onlyDirectories")
  ) {
    throw new TypeError("Next ESLint root glob only supports { onlyDirectories: true }");
  }
  if (typeof pattern !== "string" || !pattern || pattern.length > 4096) {
    throw new TypeError("Next ESLint root glob requires a nonempty string of at most 4096 characters");
  }
  const negative = pattern.startsWith("!");
  const positive = negative ? pattern.slice(1) : pattern;
  const unsupported = () => {
    throw new TypeError("Unsupported Next ESLint rootDir glob; use a literal path, terminal *, or one literal brace list");
  };
  if (!positive || /[\0\\?\[\]()!"']/.test(positive) || positive.includes("**")) unsupported();

  let patterns = [positive];
  if (/[{}]/.test(positive)) {
    const brace = /^([^{}]*)\{([^{}]+)\}([^{}]*)$/.exec(positive);
    if (!brace) unsupported();
    const alternatives = brace[2].split(",");
    if (alternatives.length < 2 || alternatives.some((part) => !part || /[/*]/.test(part) || part.includes(".."))) unsupported();
    patterns = alternatives.map((part) => brace[1] + part + brace[3]);
  }
  for (const value of patterns) {
    if (
      value.indexOf("*") !== value.lastIndexOf("*") ||
      value.slice(0, value.replace(/\/$/, "").lastIndexOf("/") + 1).includes("*")
    ) unsupported();
  }
  // A negative-only fast-glob call has no positive roots. Next maps array entries separately.
  if (negative) return [];

  const isDirectory = (value) => {
    try {
      return fs.statSync(value).isDirectory();
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    }
  };
  const result = patterns.flatMap((value) => {
    if (!value.includes("*")) return isDirectory(value) ? [value] : [];
    // Include symlinks as entries, then stat them: fdir otherwise omits directory links.
    let readError;
    const entries = tiny.globSync(value, {
      expandDirectories: false,
      onlyFiles: false,
      onlyDirectories: false,
      followSymbolicLinks: false,
      absolute: path.isAbsolute(value),
      fs: {
        readdirSync: (...args) => {
          try {
            return fs.readdirSync(...args).map((entry) =>
              entry.isSymbolicLink() ? {
                name: entry.name,
                isFile: () => true,
                isDirectory: () => false,
                isSymbolicLink: () => false,
              } : entry,
            );
          } catch (error) {
            if (error.code !== "ENOENT" && error.code !== "ENOTDIR") readError = error;
            throw error;
          }
        },
      },
    });
    // fdir suppresses read errors by default; inaccessible roots must stop lint.
    if (readError) throw readError;
    return entries.map((entry) => entry.replace(/\/$/, "")).filter(isDirectory);
  });
  return [...new Set(result)];
}

module.exports = { globSync };
