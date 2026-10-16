import { describe, it, expect } from 'vitest';
import { findLeaks } from '../scripts/check-dist.js';

const HEX40 = '0123456789abcdef0123456789abcdef01234567';

describe('post-build leak check', () => {
  it('flags the old environment variable name', () => {
    expect(findLeaks('const t = "VITE_TODOIST_TOKEN";')).toHaveLength(1);
  });

  it('flags a 40-hex-character string, in any case', () => {
    expect(findLeaks(`Bearer ${HEX40}`)).toHaveLength(1);
    expect(findLeaks(`"${HEX40.toUpperCase()}"`)).toHaveLength(1);
  });

  it('ignores shorter and longer hex runs', () => {
    expect(findLeaks(HEX40.slice(1))).toEqual([]);
    expect(findLeaks(`${HEX40}a`)).toEqual([]);
    expect(findLeaks(`${HEX40}${HEX40}`)).toEqual([]);
  });

  it('ignores ordinary code', () => {
    expect(findLeaks('export function f(){return fetch("https://api.todoist.com/api/v1/user")}')).toEqual([]);
  });
});
