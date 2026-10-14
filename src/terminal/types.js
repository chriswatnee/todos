// Shared JSDoc types for the terminal. Backends (e.g. src/todoist/) produce these
// plain shapes; the terminal never needs to know which backend made them.

/**
 * A clickable action attached to a list item. Clicking types and runs `command`.
 * @typedef {Object} ItemAction
 * @property {string} label    button text, e.g. "DONE"
 * @property {string} command  full command line, e.g. "td task complete id:123"
 */

/**
 * One row in an item list.
 * @typedef {Object} ListItem
 * @property {string} text          main text (untrusted, rendered as text only)
 * @property {string} [detail]      secondary text, e.g. a due date
 * @property {string} [mark]        short marker, e.g. "!!!" for priority
 * @property {ItemAction[]} [actions]  buttons, shown in normal mode
 * @property {string} [ref]            short reference (e.g. "id:123") shown instead of
 *                                     the buttons in expert mode, so it can be typed
 */

/**
 * What a command handler returns. Handlers return data, never HTML.
 * @typedef {(
 *   { type: 'itemList', title: string, items: ListItem[], emptyText: string } |
 *   { type: 'message', text: string, tone?: 'info' | 'success' | 'error' } |
 *   { type: 'lines', lines: string[] } |
 *   { type: 'clear' } |
 *   { type: 'setMode', expert: boolean } |
 *   { type: 'none' }
 * )} Result
 */

/**
 * A command in a command set.
 * @typedef {Object} Command
 * @property {string} name     words after the prefix, e.g. "task complete"
 * @property {string} summary  one-line description for help
 * @property {string} usage    e.g. 'td add "<text>"'
 * @property {(args: string[], ctx: any) => Result | Promise<Result>} handler
 */

/**
 * A group of commands that share a first word (e.g. "td").
 * @typedef {Object} CommandSet
 * @property {string} prefix
 * @property {Command[]} commands
 * @property {(ctx: any) => Result} help  result for `<prefix>`, `<prefix> --help`, `<prefix> help`
 */

/**
 * A button in the button bar.
 * @typedef {Object} ButtonDef
 * @property {string} label
 * @property {string} command
 * @property {boolean} [execute=true]  false = type it and leave it for the user to finish
 * @property {number} [caret]          caret position after typing (defaults to end)
 */

export {};
