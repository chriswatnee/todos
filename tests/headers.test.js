// Keeps public/_headers in step with the CSP in vite.config.js. The header
// policy must be the <meta> policy plus frame-ancestors, so the two never drift.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSP } from '../vite.config.js';

const headersFile = readFileSync(join(import.meta.dirname, '..', 'public', '_headers'), 'utf8');

/** @param {string} name */
function header(name) {
  const line = headersFile.split('\n').find((l) => l.trim().startsWith(`${name}:`));
  return line?.trim().slice(name.length + 1).trim();
}

describe('public/_headers', () => {
  it('applies to every path', () => {
    expect(headersFile.split('\n')).toContain('/*');
  });

  it('sends the build CSP plus frame-ancestors', () => {
    expect(header('Content-Security-Policy')).toBe(`${CSP}; frame-ancestors 'none'`);
  });

  // The token is in localStorage, so no third-party script may run on the page.
  it('allows scripts only from our own origin', () => {
    const scriptSrc = CSP.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
    expect(scriptSrc).toBe("script-src 'self'");
  });

  it('sends nosniff and the referrer policy', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
