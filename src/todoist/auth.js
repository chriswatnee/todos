// Where the user's Todoist token lives: localStorage for this site, in this
// browser only. Set by `td auth token`, removed by `td auth logout`.
// Storage can be unavailable (private mode, blocked site data), so every
// access is wrapped in try/catch. Never log the token.

import { APP_ID } from '../config.js';

/** @typedef {import('../terminal/types.js').Result} Result */

const STORAGE_KEY = `${APP_ID}:todoist-token`;

/** @returns {string} the stored token, or '' if none (or storage is unavailable) */
export function loadToken() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** @returns {boolean} whether the token was saved */
export function saveToken(token) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearToken() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored that we can reach; fine.
  }
}

export const SIGN_IN_HINT = [
  'Get your API token in Todoist: Settings > Integrations > Developer.',
  'Then type: td auth token "<your token>"',
];

/** @returns {Result} */
export function notSignedIn() {
  return { type: 'lines', tone: 'error', lines: ['Not signed in.', ...SIGN_IN_HINT] };
}
