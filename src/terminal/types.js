// Shared JSDoc types for the terminal. Backends (e.g. src/todoist/) produce these
// plain shapes; the terminal never needs to know which backend made them.

/**
 * One row in an item list.
 * @typedef {Object} ListItem
 * @property {string} text            main text (untrusted, rendered as text only)
 * @property {string} [detail]        secondary text, e.g. a due date
 * @property {string} [detailWarning] if set, the detail is shown in the warning color,
 *   and this text (e.g. "overdue") is added for screen readers only
 * @property {string} [mark]          short marker, e.g. "!!!" for priority
 * @property {string} [checkCommand]  if set, the row gets a "[ ]" checkbox (normal mode)
 *   that types and runs this command, e.g. "td task complete id:123". The box shows
 *   "[X]" once the command returns a success message.
 * @property {string} [ref]           short reference (e.g. "id:123") shown instead of
 *                                    the checkbox in expert mode, so it can be typed
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
