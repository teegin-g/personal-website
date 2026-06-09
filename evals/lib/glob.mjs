// harness/evals/lib/glob.mjs

/**
 * Convert a restricted glob (supports ** and *) into an anchored RegExp.
 * "**" matches any characters including "/"; "*" matches within a segment.
 * A "**\/" prefix collapses to an optional run of complete leading segments,
 * preserving the segment boundary before the next literal.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++; // consume the second '*'
        if (glob[i + 1] === "/") {
          i++; // consume the trailing '/'
          out += "(?:.*/)?"; // **/ => optional whole leading segments
        } else {
          out += ".*"; // ** (not followed by /) => any characters
        }
      } else {
        out += "[^/]*"; // * => within a single segment
      }
    } else if ("\\^$+?.()|{}[]".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return new RegExp("^" + out + "$");
}
