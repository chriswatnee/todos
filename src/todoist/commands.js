// The `td` commands this app supports. Syntax mirrors the official Todoist CLI.
// This is the single place where td commands are defined.

import { ApiError } from './api.js';
import { errorToResult } from './errors.js';
import { saveToken, clearToken, notSignedIn, SIGN_IN_HINT } from './auth.js';
import { tokenize } from '../terminal/tokenizer.js';

/** @typedef {import('./api.js').Task} Task */
/** @typedef {import('../terminal/types.js').Result} Result */
/** @typedef {import('../terminal/types.js').ListItem} ListItem */
/** @typedef {import('../terminal/types.js').CommandSet} CommandSet */

/**
 * Context the td handlers need. Created once in main.js.
 * @typedef {Object} TodoistContext
 * @property {ReturnType<typeof import('./api.js').createTodoistApi>} api
 * @property {Task[]} knownTasks  tasks from the most recent listing, used for name lookup
 */

export const HELP_FOOTER = 'Type td --help for Todoist commands.';

/** @type {CommandSet['commands']} */
const commands = [
  {
    name: 'today',
    summary: 'Show tasks due today and overdue',
    usage: 'td today',
    handler: requireAuth((_args, ctx) =>
      withApiErrors(async () => {
        const tasks = sortForToday(await ctx.api.getTodayTasks());
        ctx.knownTasks = tasks;
        return taskList('Today', tasks, 'No tasks due today.');
      }),
    ),
  },
  {
    name: 'inbox',
    summary: 'List tasks in Inbox',
    usage: 'td inbox',
    handler: requireAuth((_args, ctx) =>
      withApiErrors(async () => {
        const tasks = (await ctx.api.getInboxTasks()).sort(
          (a, b) => (a.child_order ?? 0) - (b.child_order ?? 0),
        );
        ctx.knownTasks = tasks;
        return taskList('Inbox', tasks, 'Inbox is empty.');
      }),
    ),
  },
  {
    name: 'add',
    summary: 'Quick add task with natural language (e.g., "Buy milk tomorrow p1 #Shopping")',
    usage: 'td add "<text>"',
    handler: requireAuth((args, ctx) => {
      const text = args.join(' ').trim();
      if (!text) {
        return { type: 'message', tone: 'error', text: 'Usage: td add "<text>"' };
      }
      return withApiErrors(async () => {
        const task = await ctx.api.quickAdd(text);
        const due = task.due ? ` (due: ${task.due.string || task.due.date})` : '';
        return { type: 'message', tone: 'success', text: `Added: ${task.content}${due}  id:${task.id}` };
      });
    }),
  },
  {
    name: 'task complete',
    summary: 'Complete a task (ref: id:xxx or task name)',
    usage: 'td task complete <ref>',
    handler: requireAuth((args, ctx) =>
      withApiErrors(async () => {
        const ref = args.join(' ').trim();
        if (!ref) {
          return { type: 'message', tone: 'error', text: 'Usage: td task complete <ref>' };
        }
        const resolved = await resolveTaskRef(ref, ctx);
        if (resolved.error) return resolved.error;

        await ctx.api.closeTask(resolved.id);
        ctx.knownTasks = ctx.knownTasks.filter((t) => t.id !== resolved.id);
        return {
          type: 'message',
          tone: 'success',
          text: `Completed: ${resolved.label}`,
          checkedKey: resolved.id, // ticks this task's rows on screen
        };
      }),
    ),
  },
  {
    name: 'auth',
    summary: 'Manage authentication',
    usage: 'td auth <command>',
    help: authHelp,
    handler: (args) =>
      args.length === 0 || HELP_WORDS.has(args[0])
        ? authHelp()
        : { type: 'message', tone: 'error', text: `Unknown command: td auth ${args[0]}. Type td auth --help for a list.` },
  },
  {
    name: 'auth token',
    summary: 'Save API token for authentication',
    usage: 'td auth token "<token>"',
    handler: async (args, ctx) => {
      if (args[0]?.toLowerCase() === 'view') {
        return { type: 'message', tone: 'error', text: "Printing the stored token isn't supported here." };
      }
      const candidate = args.length === 1 ? args[0].trim() : '';
      if (!candidate) {
        return { type: 'lines', tone: 'error', lines: ['Usage: td auth token "<token>"', SIGN_IN_HINT[0]] };
      }

      let user;
      try {
        user = await ctx.api.verifyToken(candidate);
      } catch (err) {
        if (err instanceof ApiError && (err.kind === 'auth' || err.kind === 'forbidden' || err.status === 400)) {
          return { type: 'message', tone: 'error', text: 'Todoist rejected that token. Check it and try again.' };
        }
        return errorToResult(err);
      }

      ctx.api.setToken(candidate);
      ctx.knownTasks = [];
      const saved = saveToken(candidate);
      return {
        type: 'message',
        tone: 'success',
        text: saved
          ? `Signed in as ${user.email}. Token saved in this browser.`
          : `Signed in as ${user.email} until you close this page. This browser wouldn't let me save the token.`,
      };
    },
  },
  {
    name: 'auth status',
    summary: 'Show current authentication status',
    usage: 'td auth status',
    handler: requireAuth(async (_args, ctx) => {
      try {
        const user = await ctx.api.getUser();
        return { type: 'message', tone: 'success', text: `Signed in as ${user.email}.` };
      } catch (err) {
        if (err instanceof ApiError && err.kind === 'auth') {
          return {
            type: 'message',
            tone: 'error',
            text: 'The saved token was rejected. Run td auth token "<token>" or td auth logout.',
          };
        }
        return errorToResult(err);
      }
    }),
  },
  {
    name: 'auth logout',
    summary: 'Remove the saved authentication token',
    usage: 'td auth logout',
    handler: requireAuth((_args, ctx) => {
      clearToken();
      ctx.api.setToken('');
      ctx.knownTasks = [];
      return { type: 'message', tone: 'success', text: 'Signed out. Token removed from this browser.' };
    }),
  },
  {
    name: 'auth login',
    summary: 'Authenticate with Todoist in the browser (not available yet)',
    usage: 'td auth login',
    handler: () => ({
      type: 'lines',
      tone: 'error',
      lines: [
        "Browser login isn't available yet. Use td auth token instead.",
        ...SIGN_IN_HINT,
      ],
    }),
  },
];

const HELP_WORDS = new Set(['--help', '-h', 'help']);

/** @param {string} name */
const byName = (name) => commands.find((c) => c.name === name);

/** @type {CommandSet} */
export const tdCommandSet = {
  prefix: 'td',
  commands,
  help: () => ({ type: 'lines', lines: helpLines() }),
  redact,
};

/**
 * Hide the token in `td auth token "<token>"` so it never shows in the echoed
 * command or in history. Everything else passes through unchanged.
 * @param {string} line
 * @returns {string}
 */
export function redact(line) {
  const [td, auth, token, arg] = tokenize(line).map((t, i) => (i < 3 ? t.toLowerCase() : t));
  const isTokenCommand = td === 'td' && auth === 'auth' && token === 'token';
  if (!isTokenCommand || arg === undefined || HELP_WORDS.has(arg) || arg.toLowerCase() === 'view') {
    return line;
  }
  return 'td auth token "********"';
}

/**
 * Wrap a handler so it answers "Not signed in." (with how to sign in) when
 * there's no token, before any usage check or API call.
 */
function requireAuth(handler) {
  return (args, ctx) => (ctx.api.hasToken ? handler(args, ctx) : notSignedIn());
}

/** `td auth --help`, in the real CLI's format. */
function authHelp() {
  const rows = [
    ['login', byName('auth login').summary],
    ['logout', byName('auth logout').summary],
    ['status', byName('auth status').summary],
    ['token <token>', byName('auth token').summary],
    ['help [command]', 'display help for command'],
  ];
  return {
    type: 'lines',
    lines: [
      'Usage: td auth [options] [command]',
      '',
      'Manage authentication',
      '',
      'Options:',
      `  ${'-h, --help'.padEnd(25)}display help for command`,
      '',
      'Commands:',
      ...rows.map(([name, summary]) => `  ${name.padEnd(25)}${summary}`),
    ],
  };
}

/** Help in the real CLI's format, listing only what this app supports. */
function helpLines() {
  const rows = [
    ['today', byName('today').summary],
    ['inbox', byName('inbox').summary],
    ['add <text>', byName('add').summary],
    ['task complete <ref>', byName('task complete').summary],
    ['auth <command>', byName('auth').summary],
    ['help [command]', 'display help for command'],
  ];
  return [
    'Usage: td [options] [command]',
    '',
    'Todoist CLI',
    '',
    'Options:',
    `  ${'-h, --help'.padEnd(25)}display help for command`,
    '',
    'Commands:',
    ...rows.map(([name, summary]) => `  ${name.padEnd(25)}${summary}`),
    '',
    'The real td CLI has many more commands. This app supports only the ones above.',
  ];
}

/**
 * Work out which task a `td task complete` ref points to.
 * - "id:xxx" -> that id.
 * - Otherwise a task name, matched case-insensitively against ctx.knownTasks
 *   (fetched from today + inbox if nothing is known yet). An exact match wins;
 *   if there is none, a substring match is used. More than one match is an
 *   error that lists the candidates. We never guess.
 *
 * @param {string} ref
 * @param {TodoistContext} ctx
 * @returns {Promise<{ id: string, label: string, error?: undefined } | { error: Result }>}
 */
export async function resolveTaskRef(ref, ctx) {
  if (ref.toLowerCase().startsWith('id:')) {
    const id = ref.slice(3).trim();
    if (!id) return { error: { type: 'message', tone: 'error', text: 'Missing task id after "id:".' } };
    const known = ctx.knownTasks.find((t) => t.id === id);
    return { id, label: known ? known.content : `id:${id}` };
  }

  if (ctx.knownTasks.length === 0) {
    const [today, inbox] = await Promise.all([ctx.api.getTodayTasks(), ctx.api.getInboxTasks()]);
    const byId = new Map([...today, ...inbox].map((t) => [t.id, t]));
    ctx.knownTasks = [...byId.values()];
  }

  const needle = ref.toLowerCase();
  let matches = ctx.knownTasks.filter((t) => t.content.toLowerCase() === needle);
  if (matches.length === 0) {
    matches = ctx.knownTasks.filter((t) => t.content.toLowerCase().includes(needle));
  }

  if (matches.length === 1) {
    return { id: matches[0].id, label: matches[0].content };
  }
  if (matches.length === 0) {
    return {
      error: {
        type: 'message',
        tone: 'error',
        text: `No task matching "${ref}". Run td today or td inbox, or use id:xxx.`,
      },
    };
  }
  return {
    error: {
      type: 'lines',
      lines: [
        `Error: "${ref}" matches ${matches.length} tasks. Use an id: ref instead:`,
        ...matches.map((t) => `  id:${t.id}  ${t.content}`),
      ],
    },
  };
}

/** Run an API call, turning known API errors into DOS-style messages. */
async function withApiErrors(fn) {
  try {
    return await fn();
  } catch (err) {
    return errorToResult(err);
  }
}

/** Overdue first (oldest first), then by priority (p1 first). */
function sortForToday(tasks) {
  return [...tasks].sort((a, b) => {
    const dateA = a.due?.date?.slice(0, 10) ?? '';
    const dateB = b.due?.date?.slice(0, 10) ?? '';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    return b.priority - a.priority;
  });
}

/**
 * @param {string} title
 * @param {Task[]} tasks
 * @param {string} emptyText
 * @returns {Result}
 */
function taskList(title, tasks, emptyText) {
  const now = new Date();
  return { type: 'itemList', title, emptyText, items: tasks.map((t) => toListItem(t, now)) };
}

const PRIORITY_MARKS = { 4: '!!!', 3: '!!', 2: '!', 1: '' };

/**
 * @param {Task} task
 * @param {Date} [now]  injectable for tests
 * @returns {ListItem}
 */
export function toListItem(task, now = new Date()) {
  const item = {
    key: task.id,
    text: task.content,
    mark: PRIORITY_MARKS[task.priority] ?? '',
    checkCommand: `td task complete id:${task.id}`,
    ref: `id:${task.id}`,
  };
  if (task.due) {
    const day = task.due.date.slice(0, 10); // "YYYY-MM-DD", with or without a time
    const today = localDateString(now);
    if (day === today) {
      item.detail = 'today';
    } else {
      item.detail = task.due.string || day;
      // Overdue dates show in the warning color; the note is for screen readers.
      if (day < today) item.detailWarning = 'overdue';
    }
  }
  return item;
}

/** Local calendar date as "YYYY-MM-DD" (Todoist due dates are in the user's local time). */
function localDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
