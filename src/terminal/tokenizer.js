/**
 * Split a command line into arguments.
 *
 * - Whitespace separates arguments.
 * - Double or single quotes group text (including spaces) into one argument.
 *   `""` produces an empty-string argument.
 * - Inside double quotes, `\"` and `\\` are escapes.
 * - An unterminated quote runs to the end of the line.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function tokenize(line) {
  const tokens = [];
  let current = '';
  let inToken = false; // true once the current token has started (even if empty, e.g. "")
  let quote = null; // '"' or "'" while inside quotes

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && ch === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) {
        current += line[i + 1];
        i++;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
    } else if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
    } else {
      current += ch;
      inToken = true;
    }
  }

  if (inToken) tokens.push(current);
  return tokens;
}
