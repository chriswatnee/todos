import { describe, it, expect } from 'vitest';
import { toListItem } from '../src/todoist/commands.js';

// Local noon on 2026-10-14, so the "today" date is unambiguous in any timezone.
const NOW = new Date(2026, 9, 14, 12, 0, 0);

function task(due, extra = {}) {
  return { id: 'abc', content: 'Water plants', priority: 1, due, ...extra };
}

describe('toListItem dates', () => {
  it('shows "today" for tasks due today', () => {
    const item = toListItem(task({ date: '2026-10-14', string: 'Oct 14' }), NOW);
    expect(item.detail).toBe('today');
    expect(item.detailWarning).toBeUndefined();
  });

  it('treats a due date with a time today as today', () => {
    const item = toListItem(task({ date: '2026-10-14T15:00:00', string: 'Oct 14 3pm' }), NOW);
    expect(item.detail).toBe('today');
  });

  it('keeps the date for overdue tasks and flags them', () => {
    const item = toListItem(task({ date: '2026-10-12', string: 'Oct 12' }), NOW);
    expect(item.detail).toBe('Oct 12');
    expect(item.detailWarning).toBe('overdue');
  });

  it('keeps the date for future tasks, without a warning', () => {
    const item = toListItem(task({ date: '2026-10-20', string: 'Oct 20' }), NOW);
    expect(item.detail).toBe('Oct 20');
    expect(item.detailWarning).toBeUndefined();
  });

  it('falls back to the raw date when there is no due string', () => {
    expect(toListItem(task({ date: '2026-10-20' }), NOW).detail).toBe('2026-10-20');
  });

  it('has no detail when there is no due date', () => {
    expect(toListItem(task(null), NOW).detail).toBeUndefined();
  });

  it('maps priority, checkbox command, and ref', () => {
    expect(toListItem(task(null, { priority: 4 }), NOW)).toMatchObject({
      mark: '!!!',
      checkCommand: 'td task complete id:abc',
      ref: 'id:abc',
    });
  });
});
