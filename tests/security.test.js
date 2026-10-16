// Guards the hosting rule: the app never reads a token from the build
// environment. Vite only inlines env values the source references, so if
// nothing in src/ touches import.meta.env, no token can end up in dist/.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = join(import.meta.dirname, '..', 'src');

describe('no build-time token', () => {
  it('src/ never reads import.meta.env or the old token variable', () => {
    const files = readdirSync(srcDir, { recursive: true }).filter((f) => String(f).endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(srcDir, String(file)), 'utf8');
      expect(source, String(file)).not.toContain('import.meta.env');
      expect(source, String(file)).not.toContain('VITE_TODOIST_TOKEN');
    }
  });
});
