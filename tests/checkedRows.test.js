// @vitest-environment happy-dom
//
// A successful `td task complete` ticks every row on screen for that task,
// whether the command was typed by id, typed by name, or sent by a checkbox.

import { describe, it, expect, vi } from 'vitest';
import { createTerminal } from '../src/terminal/terminal.js';
import { builtins } from '../src/terminal/builtins.js';
import { renderResult, markItemsChecked } from '../src/terminal/render.js';
import { tdCommandSet } from '../src/todoist/commands.js';
import { ApiError } from '../src/todoist/api.js';

const WATER = { id: 'w1', content: 'Water plants', priority: 1, due: null };
const RENT = { id: 'r2', content: 'Pay rent', priority: 1, due: null };

/** Build the app's DOM and a terminal backed by a mocked Todoist API. */
function setup() {
  document.body.innerHTML = `
    <div id="app">
      <main><div id="output"></div>
        <span id="prompt"></span><input id="command-input"><span id="cursor"></span>
      </main>
      <div id="button-bar"></div>
    </div>`;
  // Reduced motion: commands run without the typing animation.
  window.matchMedia = () => ({ matches: true });

  const api = {
    hasToken: true,
    // The same task appears in both listings, like a task due today in the Inbox.
    getTodayTasks: vi.fn().mockResolvedValue([WATER]),
    getInboxTasks: vi.fn().mockResolvedValue([WATER, RENT]),
    closeTask: vi.fn().mockResolvedValue(undefined),
  };
  const terminal = createTerminal({
    elements: {
      output: document.getElementById('output'),
      input: document.getElementById('command-input'),
      cursor: document.getElementById('cursor'),
      prompt: document.getElementById('prompt'),
      app: document.getElementById('app'),
      buttonBar: document.getElementById('button-bar'),
    },
    prompt: '> ',
    commandSet: tdCommandSet,
    builtins,
    ctx: { api, knownTasks: [] },
    buttons: [],
  });
  return { terminal, api };
}

/** Every rendered row for a task id, as [box text, aria-checked, disabled, is-done]. */
function rowStates(id) {
  return [...document.querySelectorAll('.item')]
    .filter((row) => row.dataset.key === id)
    .map((row) => {
      const box = row.querySelector('.checkbox');
      return [box.textContent, box.getAttribute('aria-checked'), box.disabled, row.classList.contains('is-done')];
    });
}

const CHECKED = ['[X]', 'true', true, true];
const OPEN = ['[ ]', 'false', false, false];

async function showBothLists(terminal) {
  await terminal.submit('td today');
  await terminal.submit('td inbox');
}

describe('completed tasks are ticked on screen', () => {
  it('typed by id: ticks every row for that task, and only that task', async () => {
    const { terminal, api } = setup();
    await showBothLists(terminal);
    expect(rowStates('w1')).toEqual([OPEN, OPEN]);

    await terminal.submit('td task complete id:w1');

    expect(api.closeTask).toHaveBeenCalledWith('w1');
    expect(rowStates('w1')).toEqual([CHECKED, CHECKED]);
    expect(rowStates('r2')).toEqual([OPEN]);
  });

  it('typed by name: resolves the name, then ticks that task', async () => {
    const { terminal } = setup();
    await showBothLists(terminal);

    await terminal.submit('td task complete "water plants"');

    expect(rowStates('w1')).toEqual([CHECKED, CHECKED]);
    expect(rowStates('r2')).toEqual([OPEN]);
  });

  it('clicked checkbox: ticks every row for that task, not just the one clicked', async () => {
    const { terminal } = setup();
    await showBothLists(terminal);

    const firstBox = document.querySelector('.item[data-key="w1"] .checkbox');
    firstBox.click();
    await vi.waitFor(() => expect(rowStates('w1')).toEqual([CHECKED, CHECKED]));
    expect(rowStates('r2')).toEqual([OPEN]);
  });

  it('a failed completion ticks nothing', async () => {
    const { terminal, api } = setup();
    await showBothLists(terminal);
    api.closeTask.mockRejectedValue(new ApiError('not-found', 'Task not found', { status: 404 }));

    const result = await terminal.submit('td task complete id:w1');

    expect(result).toMatchObject({ type: 'message', tone: 'error' });
    expect(rowStates('w1')).toEqual([OPEN, OPEN]);
  });

  it('an ambiguous name ticks nothing', async () => {
    const { terminal, api } = setup();
    api.getInboxTasks.mockResolvedValue([WATER, { ...WATER, id: 'w9' }]);
    await showBothLists(terminal);

    await terminal.submit('td task complete "water plants"');

    expect(api.closeTask).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.item.is-done')).toHaveLength(0);
  });
});

describe('markItemsChecked', () => {
  it('matches keys as data, so odd characters in a key are safe', () => {
    document.body.innerHTML = '<div id="out"></div>';
    const out = document.getElementById('out');
    const key = 'a"] , .item[data-key="b';
    const list = renderResult(
      {
        type: 'itemList',
        title: 'T',
        emptyText: '',
        items: [
          { key, text: 'odd', checkCommand: 'x' },
          { key: 'b', text: 'other', checkCommand: 'y' },
        ],
      },
      { onAction: () => {} },
    );
    out.append(list);

    markItemsChecked(out, key);

    const [odd, other] = out.querySelectorAll('.item');
    expect(odd.classList.contains('is-done')).toBe(true);
    expect(other.classList.contains('is-done')).toBe(false);
  });
});
