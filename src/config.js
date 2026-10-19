// App identity. The display name is defined here and only here;
// everything else (title bar, <title>, banner) reads it from this module.

export const APP_NAME = 'Todos';
export const APP_ID = 'todos';

/** Shown in the banner. Must match "version" in package.json (tests/version.test.js). */
export const APP_VERSION = '1.0.0';

/** Text shown before the input, classic adventure-game parser style: "> td today". */
export const PROMPT = '> ';
