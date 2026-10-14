// The `td` commands this app supports. Syntax mirrors the official Todoist CLI.
// This is the single place where td commands are defined.

import { errorToResult } from './errors.js';

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
    handler: (_args, ctx) =>
      withApiErrors(async () => {
        const tasks = sortForToday(await ctx.api.getTodayTasks());
        ctx.knownTasks = tasks;
        return taskList('Today', tasks, 'No tasks due today.');
      }),
  },
  {
    name: 'inbox',
    summary: 'List tasks in Inbox',
    usage: 'td inbox',
    handler: (_args, ctx) =>
      withApiErrors(async () => {
        const tasks = (await ctx.api.getInboxTasks()).sort(
          (a, b) => (a.child_order ?? 0) - (b.child_order ?? 0),
        );
        ctx.knownTasks = tasks;
        return taskList('Inbox', tasks, 'Inbox is empty.');
      }),
  },
  {
    name: 'add',
    summary: 'Quick add task with natural language (e.g., "Buy milk tomorrow p1 #Shopping")',
    usage: 'td add "<text>"',
    handler: (args, ctx) => {
      const text = args.join(' ').trim();
      if (!text) {
        return { type: 'message', tone: 'error', text: 'Usage: td add "<text>"' };
      }
      return withApiErrors(async () => {
        const task = await ctx.api.quickAdd(text);
        const due = task.due ? ` (due: ${task.due.string || task.due.date})` : '';
        return { type: 'message', tone: 'success', text: `Added: ${task.content}${due}  id:${task.id}` };
      });
    },
  },
  {
    name: 'task complete',
    summary: 'Complete a task (ref: id:xxx or task name)',
    usage: 'td task complete <ref>',
    handler: (args, ctx) =>
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
  },
];

/** @type {CommandSet} */
export const tdCommandSet = {
  prefix: 'td',
  commands,
  help: () => ({ type: 'lines', lines: helpLines() }),
};

/** Help in the real CLI's format, listing only what this app supports. */
function helpLines() {
  const rows = [
    ['today', commands[0].summary],
    ['inbox', commands[1].summary],
    ['add <text>', commands[2].summary],
    ['task complete <ref>', commands[3].summary],
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
