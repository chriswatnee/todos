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

/** The echoed command line, e.g. `C:\TODO>td today`. */
export function renderEcho(prompt, line) {
  const row = el('div', 'line echo');
  row.append(el('span', 'prompt', prompt), el('span', 'echo-text', line));
  return row;
}

/**
 * @param {Result} result
 * @param {{ onAction: (command: string, button: HTMLElement) => void }} hooks
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

/** @param {ListItem} item */
function renderItem(item, onAction) {
  const row = el('li', 'item');

  for (const action of item.actions || []) {
    const button = el('button', 'btn btn-small', `[${action.label}]`);
    button.type = 'button';
    button.setAttribute('aria-label', `${action.label}: ${item.text}`);
    button.title = action.command;
    button.addEventListener('click', () => onAction(action.command, button));
    row.append(button);
  }

  row.append(el('span', 'item-mark', item.mark || ''));
  row.append(el('span', 'item-text', item.text));
  if (item.detail) row.append(el('span', 'item-detail', item.detail));
  return row;
}
