// Minimal Todoist API v1 client using fetch(). No SDK.
// Endpoints checked against https://developer.todoist.com/api/v1/ (OpenAPI spec).
//
// The token is passed in by main.js (from src/todoist/auth.js) and swapped by
// setToken(). It is never read from the build environment. Never log it.

const BASE_URL = 'https://api.todoist.com/api/v1';
const PAGE_LIMIT = 200; // API maximum for paginated task/project lists

/**
 * Task as returned by the API (only the fields this app uses).
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} content
 * @property {number} priority   1 (normal) .. 4 (urgent); p1 in the UI = 4 here
 * @property {{ date: string, string?: string, is_recurring?: boolean } | null} due
 * @property {string} project_id
 * @property {number} [child_order]
 */

/**
 * @typedef {'missing-token' | 'network' | 'auth' | 'forbidden' | 'not-found' | 'rate-limit' | 'http'} ApiErrorKind
 */

export class ApiError extends Error {
  /**
   * @param {ApiErrorKind} kind
   * @param {string} message
   * @param {{ status?: number, retryAfter?: number }} [extra]
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = extra.status;
    this.retryAfter = extra.retryAfter;
  }
}

/**
 * The signed-in user (only the fields this app uses; the API response also
 * echoes the token, which is deliberately dropped).
 * @typedef {Object} User
 * @property {string} email
 * @property {string} full_name
 */

/**
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createTodoistApi({ token = '', fetchImpl = (...a) => fetch(...a) } = {}) {
  let inboxProjectId = null;

  /**
   * @param {string} path      e.g. "/tasks"
   * @param {{ method?: string, query?: Record<string, string>, body?: any, token?: string }} [opts]
   *   opts.token overrides the current token (used to verify a new one)
   */
  async function request(path, { method = 'GET', query, body, token: tokenOverride } = {}) {
    const bearer = tokenOverride ?? token;
    if (!bearer) {
      throw new ApiError('missing-token', 'No API token configured');
    }

    const url = new URL(BASE_URL + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null) url.searchParams.set(key, value);
      }
    }

    const headers = { Authorization: `Bearer ${bearer}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network', 'Network request failed');
    }

    if (!response.ok) {
      throw await errorFromResponse(response);
    }

    // Close returns an empty body (204 or empty 200).
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /** Follow next_cursor until all pages are loaded. */
  async function getAllPages(path, query = {}) {
    const results = [];
    let cursor = null;
    do {
      const page = await request(path, { query: { ...query, limit: String(PAGE_LIMIT), cursor } });
      results.push(...page.results);
      cursor = page.next_cursor;
    } while (cursor);
    return results;
  }

  /** @returns {Promise<User>} */
  async function getUserWith(bearer) {
    const user = await request('/user', { token: bearer });
    return { email: user.email, full_name: user.full_name };
  }

  return {
    get hasToken() {
      return Boolean(token);
    },

    /** Switch accounts (or sign out with ''). Clears anything cached for the old one. */
    setToken(newToken) {
      token = newToken;
      inboxProjectId = null;
    },

    /** Check a candidate token with a read-only call, without keeping it. @returns {Promise<User>} */
    verifyToken(candidate) {
      return getUserWith(candidate);
    },

    /** The signed-in user. @returns {Promise<User>} */
    getUser() {
      return getUserWith(token);
    },

    /** Tasks due today plus overdue. @returns {Promise<Task[]>} */
    getTodayTasks() {
      return getAllPages('/tasks/filter', { query: 'today | overdue' });
    },

    /** Active tasks in the Inbox project. @returns {Promise<Task[]>} */
    async getInboxTasks() {
      if (!inboxProjectId) {
        const projects = await getAllPages('/projects');
        const inbox = projects.find((p) => p.inbox_project === true);
        if (!inbox) throw new ApiError('not-found', 'Inbox project not found');
        inboxProjectId = inbox.id;
      }
      return getAllPages('/tasks', { project_id: inboxProjectId });
    },

    /** Create a task with Quick Add natural-language parsing. @returns {Promise<Task>} */
    quickAdd(text) {
      return request('/tasks/quick', { method: 'POST', body: { text } });
    },

    /** Complete (close) a task. */
    async closeTask(id) {
      await request(`/tasks/${encodeURIComponent(id)}/close`, { method: 'POST' });
    },
  };
}

/** @param {Response} response */
async function errorFromResponse(response) {
  const status = response.status;
  let detail = '';
  let retryAfter;
  try {
    const data = await response.json();
    detail = data?.error || '';
    retryAfter = data?.error_extra?.retry_after;
  } catch {
    // Body was not JSON; fine.
  }
  const header = Number(response.headers?.get?.('Retry-After'));
  if (!retryAfter && header) retryAfter = header;

  if (status === 401) return new ApiError('auth', detail || 'Unauthorized', { status });
  if (status === 403) return new ApiError('forbidden', detail || 'Forbidden', { status });
  if (status === 404) return new ApiError('not-found', detail || 'Not found', { status });
  if (status === 429) return new ApiError('rate-limit', detail || 'Too many requests', { status, retryAfter });
  return new ApiError('http', detail || `HTTP ${status}`, { status });
}
