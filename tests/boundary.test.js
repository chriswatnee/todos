// Guards the architecture rule: the terminal/UI code never imports backend code.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const terminalDir = join(import.meta.dirname, '..', 'src', 'terminal');

describe('terminal/todoist boundary', () => {
  it('src/terminal/ does not import from src/todoist/', () => {
    for (const file of readdirSync(terminalDir)) {
      const source = readFileSync(join(terminalDir, file), 'utf8');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*todoist/);
      expect(source, file).not.toMatch(/import\(\s*['"][^'"]*todoist/);
    }
  });
});
