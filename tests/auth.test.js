import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatch } from '../src/terminal/dispatch.js';
import { builtins } from '../src/terminal/builtins.js';
import { tdCommandSet, redact } from '../src/todoist/commands.js';
import { createTodoistApi } from '../src/todoist/api.js';
import { loadToken, saveToken, clearToken } from '../src/todoist/auth.js';

const GOOD = 'test-token-good';
const KEY = 'todos:todoist-token';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

/** A fake Todoist: only GOOD is a valid token. */
function fakeFetch() {
  return vi.fn(async (_url, init) => {
    if (init.headers.Authorization !== `Bearer ${GOOD}`) return jsonResponse(401, { error: 'Unauthorized' });
    return jsonResponse(200, { email: 'user@example.com', full_name: 'Test User', token: GOOD });
  });
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function makeEnv(token = '') {
  const fetchImpl = fakeFetch();
  const api = createTodoistApi({ token, fetchImpl });
  return { fetchImpl, env: { commandSet: tdCommandSet, builtins, ctx: { api, knownTasks: [] } } };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});
afterEach(() => {
  delete globalThis.localStorage;
});

describe('token storage', () => {
  it('saves, loads, and clears', () => {
    expect(loadToken()).toBe('');
    expect(saveToken('abc')).toBe(true);
    expect(loadToken()).toBe('abc');
    clearToken();
    expect(loadToken()).toBe('');
  });

  it('survives storage that throws', () => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
    expect(loadToken()).toBe('');
    expect(saveToken('abc')).toBe(false);
    expect(() => clearToken()).not.toThrow();
  });

  it('survives storage being missing', () => {
    delete globalThis.localStorage;
    expect(loadToken()).toBe('');
    expect(saveToken('abc')).toBe(false);
  });
});

describe('td auth token', () => {
  it('verifies, stores, and signs in with a valid token', async () => {
    const { env, fetchImpl } = makeEnv();
    const result = await dispatch(`td auth token "${GOOD}"`, env);
    expect(result).toEqual({
      type: 'message',
      tone: 'success',
      text: 'Signed in as user@example.com. Token saved in this browser.',
    });
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/api/v1/user');
    expect(localStorage.getItem(KEY)).toBe(GOOD);
    expect(env.ctx.api.hasToken).toBe(true);
  });

  it('rejects an invalid token and stores nothing', async () => {
    const { env } = makeEnv();
    const result = await dispatch('td auth token "fake-token-123"', env);
    expect(result).toEqual({
      type: 'message',
      tone: 'error',
      text: 'Todoist rejected that token. Check it and try again.',
    });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(env.ctx.api.hasToken).toBe(false);
  });

  it('a rejected token keeps the previous sign-in', async () => {
    const { env } = makeEnv(GOOD);
    await dispatch('td auth token wrong', env);
    expect(env.ctx.api.hasToken).toBe(true);
  });

  it('still signs in for the session when storage is unavailable', async () => {
    delete globalThis.localStorage;
    const { env } = makeEnv();
    const result = await dispatch(`td auth token ${GOOD}`, env);
    expect(result.tone).toBe('success');
    expect(result.text).toContain("wouldn't let me save");
    expect(env.ctx.api.hasToken).toBe(true);
  });

  it('without a token shows usage and calls nothing', async () => {
    const { env, fetchImpl } = makeEnv();
    const result = await dispatch('td auth token', env);
    expect(result.lines[0]).toBe('Usage: td auth token "<token>"');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('view is refused', async () => {
    const { env, fetchImpl } = makeEnv(GOOD);
    const result = await dispatch('td auth token view', env);
    expect(result.tone).toBe('error');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('td auth status / logout / login', () => {
  it('status when signed out', async () => {
    const { env } = makeEnv();
    const result = await dispatch('td auth status', env);
    expect(result.lines[0]).toBe('Not signed in.');
  });

  it('status when signed in shows the email', async () => {
    const { env } = makeEnv(GOOD);
    expect(await dispatch('td auth status', env)).toMatchObject({ text: 'Signed in as user@example.com.' });
  });

  it('status with a stored token that Todoist rejects', async () => {
    const { env } = makeEnv('revoked');
    const result = await dispatch('td auth status', env);
    expect(result.tone).toBe('error');
    expect(result.text).toContain('saved token was rejected');
  });

  it('logout removes the stored token', async () => {
    localStorage.setItem(KEY, GOOD);
    const { env } = makeEnv(GOOD);
    const result = await dispatch('td auth logout', env);
    expect(result.text).toBe('Signed out. Token removed from this browser.');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(env.ctx.api.hasToken).toBe(false);
  });

  it('login points to td auth token', async () => {
    const { env } = makeEnv();
    const result = await dispatch('td auth login', env);
    expect(result.lines[0]).toBe("Browser login isn't available yet. Use td auth token instead.");
    expect(result.lines.join('\n')).toContain('Settings > Integrations > Developer');
  });
});

describe('not signed in', () => {
  it.each(['td today', 'td inbox', 'td add "Buy milk"', 'td add ""', 'td task complete id:1', 'td auth logout'])(
    '%s says "Not signed in." without calling the API',
    async (line) => {
      const { env, fetchImpl } = makeEnv();
      const result = await dispatch(line, env);
      expect(result.type).toBe('lines');
      expect(result.lines[0]).toBe('Not signed in.');
      expect(result.lines.join('\n')).toContain('td auth token "<your token>"');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('redact', () => {
  it.each([
    ['td auth token "abc123"', 'td auth token "********"'],
    ['td auth token abc123', 'td auth token "********"'],
    ['TD Auth Token \'abc 123\'', 'td auth token "********"'],
  ])('masks %s', (line, expected) => {
    expect(redact(line)).toBe(expected);
  });

  it.each(['td auth token', 'td auth token --help', 'td auth token -h', 'td auth token view', 'td today', 'td add "x"'])(
    'leaves %s alone',
    (line) => {
      expect(redact(line)).toBe(line);
    },
  );

  it('is wired into the td command set', () => {
    expect(tdCommandSet.redact).toBe(redact);
  });
});
