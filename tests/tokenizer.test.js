import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/terminal/tokenizer.js';

describe('tokenize', () => {
  it('splits simple words', () => {
    expect(tokenize('td today')).toEqual(['td', 'today']);
  });

  it('returns no tokens for empty or blank input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   \t ')).toEqual([]);
  });

  it('ignores leading, trailing, and repeated whitespace', () => {
    expect(tokenize('   td    task   complete  ')).toEqual(['td', 'task', 'complete']);
  });

  it('keeps double-quoted text with spaces as one token', () => {
    expect(tokenize('td add "Buy milk tomorrow p1 #Shopping"')).toEqual([
      'td',
      'add',
      'Buy milk tomorrow p1 #Shopping',
    ]);
  });

  it('supports single quotes', () => {
    expect(tokenize("td add 'Call mom'")).toEqual(['td', 'add', 'Call mom']);
  });

  it('keeps the other quote type inside quotes', () => {
    expect(tokenize(`td add "Read 'Dune'"`)).toEqual(['td', 'add', "Read 'Dune'"]);
  });

  it('produces an empty token for ""', () => {
    expect(tokenize('td add ""')).toEqual(['td', 'add', '']);
  });

  it('joins quoted and unquoted parts that touch', () => {
    expect(tokenize('id:"12 34"')).toEqual(['id:12 34']);
  });

  it('handles escaped double quotes inside double quotes', () => {
    expect(tokenize('td add "Say \\"hi\\""')).toEqual(['td', 'add', 'Say "hi"']);
  });

  it('runs an unterminated quote to the end of the line', () => {
    expect(tokenize('td add "Buy milk')).toEqual(['td', 'add', 'Buy milk']);
  });
});
