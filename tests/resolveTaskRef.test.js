import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../src/terminal/dispatch.js';
import { builtins } from '../src/terminal/builtins.js';
import { tdCommandSet, resolveTaskRef } from '../src/todoist/commands.js';
import { ApiError } from '../src/todoist/api.js';

const TASKS = [
  { id: 'a1', content: 'Buy milk', priority: 1, due: null },
  { id: 'b2', content: 'Buy milk for Grandma', priority: 1, due: null },
  { id: 'c3', content: 'Call the dentist', priority: 1, due: null },
  { id: 'd4', content: 'Pay rent', priority: 1, due: null },
  { id: 'e5', content: 'pay RENT', priority: 1, due: null },
];

function mockApi() {
  return {
    getTodayTasks: vi.fn().mockResolvedValue([]),
    getInboxTasks: vi.fn().mockResolvedValue([]),
    closeTask: vi.fn().mockResolvedValue(undefined),
  };
}

function run(line, ctx) {
  return dispatch(line, { commandSet: tdCommandSet, builtins, ctx });
}

describe('resolveTaskRef', () => {
  it('resolves id: refs directly, without fetching', async () => {
    const ctx = { api: mockApi(), knownTasks: [] };
    expect(await resolveTaskRef('id:xyz', ctx)).toEqual({ id: 'xyz', label: 'id:xyz' });
    expect(ctx.api.getTodayTasks).not.toHaveBeenCalled();
  });

  it('uses the known task name as the label for id: refs', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    expect(await resolveTaskRef('id:c3', ctx)).toEqual({ id: 'c3', label: 'Call the dentist' });
  });

  it('matches a unique name case-insensitively', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    expect(await resolveTaskRef('CALL THE DENTIST', ctx)).toEqual({ id: 'c3', label: 'Call the dentist' });
  });

  it('prefers an exact match over substring matches', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    // "buy milk" is a substring of two tasks, but an exact match of one.
    expect(await resolveTaskRef('buy milk', ctx)).toEqual({ id: 'a1', label: 'Buy milk' });
  });

  it('falls back to a unique substring match', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    expect(await resolveTaskRef('dentist', ctx)).toEqual({ id: 'c3', label: 'Call the dentist' });
  });

  it('refuses ambiguous names and lists the id: refs', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    const { error } = await resolveTaskRef('pay rent', ctx);
    expect(error.type).toBe('lines');
    expect(error.lines.join('\n')).toContain('id:d4');
    expect(error.lines.join('\n')).toContain('id:e5');
  });

  it('reports when nothing matches', async () => {
    const ctx = { api: mockApi(), knownTasks: TASKS };
    const { error } = await resolveTaskRef('walk the dog', ctx);
    expect(error).toMatchObject({ type: 'message', tone: 'error' });
  });

  it('fetches today + inbox when no tasks are known, de-duplicating', async () => {
    const api = mockApi();
    api.getTodayTasks.mockResolvedValue([TASKS[2]]);
    api.getInboxTasks.mockResolvedValue([TASKS[2], TASKS[3]]);
    const ctx = { api, knownTasks: [] };
    expect(await resolveTaskRef('rent', ctx)).toEqual({ id: 'd4', label: 'Pay rent' });
    expect(ctx.knownTasks).toHaveLength(2);
  });
});

describe('td task complete', () => {
  it('closes the task found by name and forgets it', async () => {
    const ctx = { api: mockApi(), knownTasks: [...TASKS] };
    const result = await run('td task complete "call the dentist"', ctx);
    expect(ctx.api.closeTask).toHaveBeenCalledWith('c3');
    expect(result).toEqual({
      type: 'message',
      tone: 'success',
      text: 'Completed: Call the dentist',
      checkedKey: 'c3',
    });
    expect(ctx.knownTasks.find((t) => t.id === 'c3')).toBeUndefined();
  });

  it('accepts an unquoted multi-word name', async () => {
    const ctx = { api: mockApi(), knownTasks: [...TASKS] };
    await run('td task complete call the dentist', ctx);
    expect(ctx.api.closeTask).toHaveBeenCalledWith('c3');
  });

  it('closes by id', async () => {
    const ctx = { api: mockApi(), knownTasks: [] };
    await run('td task complete id:123', ctx);
    expect(ctx.api.closeTask).toHaveBeenCalledWith('123');
  });

  it('never closes anything when the name is ambiguous', async () => {
    const ctx = { api: mockApi(), knownTasks: [...TASKS] };
    const result = await run('td task complete "pay rent"', ctx);
    expect(result.type).toBe('lines');
    expect(ctx.api.closeTask).not.toHaveBeenCalled();
  });

  it('turns API errors into friendly messages', async () => {
    const api = mockApi();
    api.closeTask.mockRejectedValue(new ApiError('auth', 'Unauthorized', { status: 401 }));
    const result = await run('td task complete id:123', { api, knownTasks: [] });
    expect(result).toMatchObject({ type: 'message', tone: 'error' });
    expect(result.text).toContain('401');
  });
});
