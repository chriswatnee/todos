// Shell built-ins. These belong to the terminal itself, not to any backend.

/** @typedef {import('./types.js').Result} Result */

/**
 * @typedef {Object} Builtin
 * @property {string} name
 * @property {string} summary
 * @property {string} usage
 * @property {(args: string[], ctx: { helpFooter?: string }) => Result} handler
 */

/** @type {Builtin[]} */
export const builtins = [
  {
    name: 'clear',
    summary: 'Clear the screen',
    usage: 'clear',
    handler: () => ({ type: 'clear' }),
  },
  {
    name: 'help',
    summary: 'List built-in commands',
    usage: 'help',
    handler: (_args, ctx) => {
      const lines = ['Built-in commands:', ''];
      for (const b of builtins) {
        lines.push(`  ${b.usage.padEnd(22)}${b.summary}`);
      }
      if (ctx.helpFooter) {
        lines.push('', ctx.helpFooter);
      }
      return { type: 'lines', lines };
    },
  },
  {
    name: 'expert',
    summary: 'Hide (on) or show (off) the buttons',
    usage: 'expert on|off',
    handler: (args) => {
      const arg = args[0]?.toLowerCase();
      if (arg === 'on') return { type: 'setMode', expert: true };
      if (arg === 'off') return { type: 'setMode', expert: false };
      return { type: 'message', tone: 'error', text: 'Usage: expert on|off' };
    },
  },
];
