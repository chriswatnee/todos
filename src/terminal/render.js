// Turns Results into DOM. Everything is built with createElement + textContent;
// never innerHTML, because task names and other output are untrusted.

/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').ListItem} ListItem */

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The echoed command line, e.g. `>td today`. */
export function renderEcho(prompt, line) {
  const row = el('div', 'line echo');
  row.append(el('span', 'prompt', prompt), el('span', 'echo-text', line));
  return row;
}

/**
 * @param {Result} result
 * @param {{ onAction: (command: string, button: HTMLElement) => void }} hooks
 *   onAction types and runs a command
 * @returns {HTMLElement | null}
 */
export function renderResult(result, { onAction }) {
  switch (result.type) {
    case 'message':
      return el('div', `line tone-${result.tone || 'info'}`, result.text);

    case 'lines': {
      const block = el('div', 'lines');
      for (const text of result.lines) block.append(el('div', 'line', text));
      return block;
    }

    case 'itemList':
      return renderItemList(result, onAction);

    default:
      // 'none', 'clear', 'setMode' produce no output of their own.
      return null;
  }
}

function renderItemList(result, onAction) {
  const block = el('div', 'item-list');
  const count = result.items.length;
  block.append(el('div', 'line list-title', `${result.title} (${count})`));

  if (count === 0) {
    block.append(el('div', 'line tone-success', result.emptyText));
    return block;
  }

  const list = el('ul', 'items');
  for (const item of result.items) list.append(renderItem(item, onAction));
  block.append(list);
  return block;
}

let nextTextId = 0;

/**
 * A row has two columns: a lead (checkbox in normal mode, the ref in expert
 * mode; CSS picks which) and a body holding the mark, text, and detail.
 * @param {ListItem} item
 */
function renderItem(item, onAction) {
  const row = el('li', 'item');
  if (item.key) row.dataset.key = item.key;
  const textEl = el('span', 'item-text', item.text);
  textEl.id = `item-text-${++nextTextId}`;

  const lead = el('div', 'item-lead');
  if (item.checkCommand) lead.append(renderCheckbox(item.checkCommand, textEl.id, onAction));
  if (item.ref) lead.append(el('span', 'item-ref', item.ref));

  // Body: optional mark, then a block with the text + detail that wraps on its
  // own, so wrapped lines hang under the text (not under the mark).
  const body = el('div', 'item-body');
  if (item.mark) body.append(el('span', 'item-mark', item.mark));
  const main = el('span', 'item-main');
  main.append(textEl);
  // A real space (not a margin) so it disappears if the detail wraps to a new line.
  if (item.detail) main.append(' ', renderDetail(item));
  body.append(main);

  row.append(lead, body);
  return row;
}

/** @param {ListItem} item */
function renderDetail(item) {
  if (!item.detailWarning) return el('span', 'item-detail', item.detail);
  // Color alone shouldn't carry the meaning, so add the warning as hidden text.
  const detail = el('span', 'item-detail is-warning', item.detail);
  detail.append(el('span', 'sr-only', ` (${item.detailWarning})`));
  return detail;
}

/**
 * A DOS-style "[ ]" checkbox. It's a real button with role="checkbox", so it is
 * focusable and toggled with Space/Enter, and its name is the task text.
 * Clicking only types and runs `command`. The box is ticked later, by
 * markItemsChecked(), when a command's result says the item was checked; that
 * way typed commands and clicks update rows the same way.
 */
function renderCheckbox(command, labelId, onAction) {
  const box = el('button', 'checkbox item-action', '[ ]');
  box.type = 'button';
  box.setAttribute('role', 'checkbox');
  box.setAttribute('aria-checked', 'false');
  box.setAttribute('aria-labelledby', labelId);
  box.title = command;

  box.addEventListener('click', () => {
    if (box.getAttribute('aria-checked') === 'true') return;
    onAction(command, box);
  });
  return box;
}

/**
 * Tick every rendered row whose item key matches: "[X]", dimmed and struck
 * through, and inert (no uncomplete yet). Rows can repeat across listings
 * (e.g. td today and td inbox), so all of them are updated.
 * @param {ParentNode} root  where to look, normally the output panel
 * @param {string} key
 */
export function markItemsChecked(root, key) {
  for (const row of root.querySelectorAll('.item')) {
    if (row.dataset.key !== key) continue; // compare as data, not via a selector
    row.classList.add('is-done');
    const box = row.querySelector('.checkbox');
    if (box) {
      box.setAttribute('aria-checked', 'true');
      box.textContent = '[X]';
      box.disabled = true;
    }
  }
}
