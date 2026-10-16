import { ApiError } from './api.js';
import { notSignedIn } from './auth.js';

/** @typedef {import('../terminal/types.js').Result} Result */

/**
 * Turn an error from the Todoist API client into a friendly DOS-style message.
 * Unknown errors are re-thrown so the terminal's last-resort handler sees them.
 *
 * @param {unknown} err
 * @returns {Result}
 */
export function errorToResult(err) {
  if (!(err instanceof ApiError)) throw err;
  if (err.kind === 'missing-token') return notSignedIn();

  const text = {
    network: 'Network failure talking to Todoist. Check your connection and try again.',
    auth: 'Todoist rejected the token (401). Sign in again with td auth token, or td auth logout.',
    forbidden: 'Access denied - Todoist says you may not do that (403).',
    'not-found': `Not found - ${err.message}.`,
    'rate-limit': err.retryAfter
      ? `Too many requests. Todoist asks you to wait ${err.retryAfter} seconds.`
      : 'Too many requests. Wait a minute and try again.',
    http: `Todoist error${err.status ? ` ${err.status}` : ''}: ${err.message}`,
  }[err.kind];

  return { type: 'message', tone: 'error', text };
}
