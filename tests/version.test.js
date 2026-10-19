// The banner version (APP_VERSION) and package.json must agree.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_VERSION } from '../src/config.js';

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));

describe('app version', () => {
  it('matches package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
