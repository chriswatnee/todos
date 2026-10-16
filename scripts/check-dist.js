// Post-build safety check: fail the build if dist/ contains anything that looks
// like a Todoist token, or the old environment variable name. Tokens belong in
// each user's browser (td auth token), never in the built files.
//
// Reports the file and the kind of match only; never prints the matched text.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_NAME = 'VITE_TODOIST_TOKEN';
// Todoist API tokens are 40 hex characters. The lookarounds keep longer hex
// runs (e.g. 64-char hashes) from matching part-way.
const TOKEN_SHAPE = /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/i;

/**
 * @param {string} text
 * @returns {string[]} what was found, e.g. ["a 40-hex-character token"]
 */
export function findLeaks(text) {
  const leaks = [];
  if (text.includes(ENV_NAME)) leaks.push(`the name ${ENV_NAME}`);
  if (TOKEN_SHAPE.test(text)) leaks.push('something shaped like a Todoist token (40 hex characters)');
  return leaks;
}

/** @param {string} dir */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

function main() {
  const distDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
  let failed = false;
  for (const file of walk(distDir)) {
    for (const leak of findLeaks(readFileSync(file, 'latin1'))) {
      console.error(`check-dist: ${relative(distDir, file)} contains ${leak}.`);
      failed = true;
    }
  }
  if (failed) {
    console.error('check-dist: build rejected. Nothing token-like may ship in dist/.');
    process.exit(1);
  }
  console.log('check-dist: dist/ is clean.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
