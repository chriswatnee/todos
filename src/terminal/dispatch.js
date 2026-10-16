import { tokenize } from './tokenizer.js';

/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').CommandSet} CommandSet */
/** @typedef {import('./builtins.js').Builtin} Builtin */

const HELP_FLAGS = new Set(['--help', '-h', 'help']);

/**
 * Turn one line of input into a Result. This is the single path for all
 * commands, whether typed or sent by a button.
 *
 * @param {string} line
 * @param {{ commandSet: CommandSet, builtins: Builtin[], ctx: any }} env
 * @returns {Promise<Result>}
 */
export async function dispatch(line, { commandSet, builtins, ctx }) {
  const tokens = tokenize(line);
  if (tokens.length === 0) return { type: 'none' };

  const [first, ...rest] = tokens;
  const word = first.toLowerCase();

  try {
    if (word === commandSet.prefix) {
      return await runFromSet(commandSet, rest, ctx);
    }

    const builtin = builtins.find((b) => b.name === word);
    if (builtin) {
      return builtin.handler(rest, ctx);
    }
  } catch (err) {
    // Backends turn their own known errors into messages; this is the last resort.
    return { type: 'message', tone: 'error', text: `General failure: ${err?.message || err}` };
  }

  return {
    type: 'message',
    tone: 'error',
    text: `I don't understand "${first}". Type help for commands.`,
  };
}

/**
 * Find the command whose name matches the most leading words, e.g.
 * ["task", "complete", "Buy milk"] matches "task complete" with args ["Buy milk"].
 *
 * @param {CommandSet} commandSet
 * @param {string[]} words
 * @returns {{ command: import('./types.js').Command, args: string[] } | null}
 */
export function findCommand(commandSet, words) {
  let best = null;
  for (const command of commandSet.commands) {
    const parts = command.name.split(' ');
    const matches = parts.every((part, i) => words[i]?.toLowerCase() === part);
    if (matches && (!best || parts.length > best.length)) {
      best = { command, length: parts.length };
    }
  }
  return best ? { command: best.command, args: words.slice(best.length) } : null;
}

async function runFromSet(commandSet, words, ctx) {
  if (words.length === 0) return commandSet.help(ctx);

  // `td help add` -> help for `add`; `td help` / `td --help` -> overall help.
  if (HELP_FLAGS.has(words[0])) {
    const found = words.length > 1 && findCommand(commandSet, words.slice(1));
    return found ? commandHelp(found.command) : commandSet.help(ctx);
  }

  const found = findCommand(commandSet, words);
  if (!found) {
    return {
      type: 'message',
      tone: 'error',
      text: `Unknown command: ${commandSet.prefix} ${words[0]}. Type ${commandSet.prefix} --help for a list.`,
    };
  }
  // `td add --help` -> help for `add` (but `td add "--help"` text is rare enough to ignore).
  if (found.args.length === 1 && (found.args[0] === '--help' || found.args[0] === '-h')) {
    return commandHelp(found.command);
  }
  return found.command.handler(found.args, ctx);
}

/** @param {import('./types.js').Command} command */
function commandHelp(command) {
  return { type: 'lines', lines: [`Usage: ${command.usage}`, '', command.summary] };
}
