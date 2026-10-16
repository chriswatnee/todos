import { describe, it, expect, vi } from 'vitest';
import { createTodoistApi, ApiError } from '../src/todoist/api.js';

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body,
  };
}

describe('todoist api client', () => {
  it('does not call fetch without a token', async () => {
    const fetchImpl = vi.fn();
    const api = createTodoistApi({ token: '', fetchImpl });
    await expect(api.getTodayTasks()).rejects.toMatchObject({ kind: 'missing-token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('has no token unless one is passed in', () => {
    expect(createTodoistApi({ fetchImpl: vi.fn() }).hasToken).toBe(false);
  });

  it('verifyToken calls /user with the candidate token and keeps only email and name', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { email: 'a@example.com', full_name: 'A', token: 'cand' }));
    const api = createTodoistApi({ token: 'current', fetchImpl });
    expect(await api.verifyToken('cand')).toEqual({ email: 'a@example.com', full_name: 'A' });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.todoist.com/api/v1/user');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer cand');
    // Verifying doesn't switch accounts.
    await api.getUser();
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer current');
  });

  it('setToken switches the token and clears the cached inbox', async () => {
    const projects = (id) => jsonResponse(200, { results: [{ id, inbox_project: true }], next_cursor: null });
    const tasks = () => jsonResponse(200, { results: [], next_cursor: null });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(projects('inbox-a'))
      .mockResolvedValueOnce(tasks())
      .mockResolvedValueOnce(projects('inbox-b'))
      .mockResolvedValueOnce(tasks());
    const api = createTodoistApi({ token: 'a', fetchImpl });
    await api.getInboxTasks();
    api.setToken('b');
    await api.getInboxTasks();
    expect(fetchImpl.mock.calls[2][1].headers.Authorization).toBe('Bearer b');
    expect(new URL(fetchImpl.mock.calls[3][0]).searchParams.get('project_id')).toBe('inbox-b');

    api.setToken('');
    expect(api.hasToken).toBe(false);
  });

  it('follows next_cursor for today tasks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: '1' }], next_cursor: 'abc.def' }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: '2' }], next_cursor: null }));
    const api = createTodoistApi({ token: 't', fetchImpl });
    const tasks = await api.getTodayTasks();
    expect(tasks.map((t) => t.id)).toEqual(['1', '2']);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(firstUrl.pathname).toBe('/api/v1/tasks/filter');
    expect(firstUrl.searchParams.get('query')).toBe('today | overdue');
    expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.get('cursor')).toBe('abc.def');
  });

  it('finds the inbox project, then lists its tasks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ id: 'p1' }, { id: 'inbox', inbox_project: true }], next_cursor: null }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: 't1' }], next_cursor: null }));
    const api = createTodoistApi({ token: 't', fetchImpl });
    await api.getInboxTasks();
    const tasksUrl = new URL(fetchImpl.mock.calls[1][0]);
    expect(tasksUrl.pathname).toBe('/api/v1/tasks');
    expect(tasksUrl.searchParams.get('project_id')).toBe('inbox');
  });

  it('posts quick add text and closes tasks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: '5', content: 'Buy milk' }))
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    const api = createTodoistApi({ token: 't', fetchImpl });
    await api.quickAdd('Buy milk tomorrow');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.todoist.com/api/v1/tasks/quick');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ text: 'Buy milk tomorrow' });
    await api.closeTask('5');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.todoist.com/api/v1/tasks/5/close');
    expect(fetchImpl.mock.calls[1][1].method).toBe('POST');
  });

  it('maps 401, 429, and network failures to ApiError kinds', async () => {
    const make = (impl) => createTodoistApi({ token: 't', fetchImpl: impl });

    await expect(make(vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }))).getTodayTasks())
      .rejects.toMatchObject({ kind: 'auth', status: 401 });

    await expect(
      make(vi.fn().mockResolvedValue(jsonResponse(429, { error: 'Too many', error_extra: { retry_after: 30 } })))
        .getTodayTasks(),
    ).rejects.toMatchObject({ kind: 'rate-limit', retryAfter: 30 });

    const offline = make(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(offline.getTodayTasks()).rejects.toBeInstanceOf(ApiError);
    await expect(offline.getTodayTasks()).rejects.toMatchObject({ kind: 'network' });
  });
});
