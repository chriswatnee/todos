// Button bar for the Todoist backend. Each button sends a command string to the
// terminal, exactly as if the user had typed it.

/** @type {import('../terminal/types.js').ButtonDef[]} */
export const tdButtons = [
  { label: 'TODAY', command: 'td today' },
  { label: 'INBOX', command: 'td inbox' },
  // Types `td add ""`, leaves the caret between the quotes, and waits for the user.
  { label: 'ADD', command: 'td add ""', execute: false, caret: 'td add "'.length },
  { label: 'HELP', command: 'help' },
  { label: 'CLS', command: 'cls' },
  { label: 'EXPERT', command: 'mode expert' },
];
