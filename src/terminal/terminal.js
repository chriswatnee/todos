// The terminal: prompt input, history, output, button bar, and the typing
// animation. Typed and button-sent commands go through the same submit() path.

import { dispatch } from './dispatch.js';
import { History } from './history.js';
import { renderEcho, renderResult } from './render.js';

/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').ButtonDef} ButtonDef */
/** @typedef {import('./types.js').CommandSet} CommandSet */
/** @typedef {import('./builtins.js').Builtin} Builtin */

const TYPING_DELAY_MS = 35;

/**
 * @param {Object} options
 * @param {{ output: HTMLElement, input: HTMLInputElement, cursor: HTMLElement,
 *           prompt: HTMLElement, app: HTMLElement, buttonBar: HTMLElement }} options.elements
 * @param {string} options.prompt
 * @param {CommandSet} options.commandSet
 * @param {Builtin[]} options.builtins
 * @param {any} options.ctx            passed to every handler
 * @param {ButtonDef[]} options.buttons
 */
export function createTerminal({ elements, prompt, commandSet, builtins, ctx, buttons }) {
  const { output, input, cursor, app, buttonBar } = elements;
  const history = new History();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {null | { text: string, typed: number, timer: number, def: ButtonDef, button?: HTMLElement }} */
  let animation = null;
  let busy = false; // true while a command is running
  let swallowNextClick = false; // a click that only served to skip an animation

  elements.prompt.textContent = prompt;

  // ---- Output -------------------------------------------------------------

  function append(node) {
    if (!node) return;
    output.append(node);
    output.scrollTop = output.scrollHeight;
  }

  /** Print a Result that did not come from a command (e.g. the startup banner). */
  function print(result) {
    append(renderResult(result, { onAction: runFromButton }));
  }

  // ---- Running commands ---------------------------------------------------

  /** The one path every command takes, typed or from a button. */
  async function submit(line) {
    if (busy) return;
    busy = true;
    document.body.classList.add('is-busy');

    append(renderEcho(prompt, line));
    history.push(line);
    setInput('');

    try {
      const result = await dispatch(line, { commandSet, builtins, ctx });
      apply(result);
    } finally {
      busy = false;
      document.body.classList.remove('is-busy');
      input.focus();
      updateCursor();
    }
  }

  /** @param {Result} result */
  function apply(result) {
    if (result.type === 'clear') {
      output.replaceChildren();
      return;
    }
    if (result.type === 'setMode') {
      setExpertMode(result.expert);
      print({
        type: 'message',
        text: result.expert
          ? 'Expert mode. Buttons hidden. Type mode normal to bring them back.'
          : 'Normal mode. Buttons shown.',
      });
      return;
    }
    print(result);
  }

  // One class on the app container switches everything at once (CSS does the
  // rest): the button bar and task-row buttons hide, and id: refs show. This
  // also applies to rows already on screen.
  function setExpertMode(expert) {
    app.classList.toggle('expert-mode', expert);
  }

  // ---- Typing animation (buttons only) -----------------------------------

  /**
   * Type a command into the prompt, then run it (unless def.execute is false).
   * @param {ButtonDef | string} defOrCommand
   * @param {HTMLElement} [button]  shown pressed while its command types
   */
  function runFromButton(defOrCommand, button) {
    if (animation || busy) return; // extra clicks are ignored
    const def = typeof defOrCommand === 'string' ? { command: defOrCommand } : defOrCommand;

    if (reducedMotion.matches) {
      finishTyping(def);
      return;
    }

    setInput('');
    input.readOnly = true;
    document.body.classList.add('is-typing');
    button?.classList.add('pressed');
    animation = { text: def.command, typed: 0, def, timer: 0, button };
    animation.timer = window.setInterval(typeNextChar, TYPING_DELAY_MS);
    input.focus();
  }

  function typeNextChar() {
    animation.typed++;
    setInput(animation.text.slice(0, animation.typed));
    if (animation.typed >= animation.text.length) skipAnimation();
  }

  /** Jump straight to the end of the current animation. */
  function skipAnimation() {
    if (!animation) return;
    const { def, timer, button } = animation;
    window.clearInterval(timer);
    button?.classList.remove('pressed');
    animation = null;
    input.readOnly = false;
    document.body.classList.remove('is-typing');
    finishTyping(def);
  }

  /** @param {ButtonDef} def */
  function finishTyping(def) {
    setInput(def.command);
    input.focus();
    if (def.execute === false) {
      const caret = def.caret ?? def.command.length;
      input.setSelectionRange(caret, caret);
      updateCursor();
    } else {
      submit(def.command);
    }
  }

  // Any keypress or click during the animation skips to the end. Capture phase,
  // so it runs before anything else sees the event.
  document.addEventListener(
    'keydown',
    (event) => {
      if (!animation) return;
      event.preventDefault();
      event.stopPropagation();
      skipAnimation();
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    () => {
      if (!animation) return;
      swallowNextClick = true;
      skipAnimation();
    },
    true,
  );
  // The click that follows a skip-pointerdown must not trigger a button.
  document.addEventListener(
    'click',
    (event) => {
      if (!swallowNextClick) return;
      swallowNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  // A pointerdown with no click (e.g. drag) shouldn't leave the flag set forever.
  document.addEventListener('pointerup', () => setTimeout(() => (swallowNextClick = false)), true);

  // ---- Input, history, cursor ---------------------------------------------

  function setInput(value) {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    updateCursor();
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit(input.value);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const line = history.previous(input.value);
      if (line !== null) setInput(line);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const line = history.next();
      if (line !== null) setInput(line);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      // The output has no visible scrollbar, so let the prompt scroll it.
      event.preventDefault();
      const page = output.clientHeight * 0.9;
      output.scrollBy({ top: event.key === 'PageUp' ? -page : page });
    }
  });

  // Keep the block cursor in sync with the real caret. The font is monospace,
  // so the caret's x position is simply (caret index)ch, minus any scroll.
  // The block is solid, so it re-draws the character under it (in reverse colors).
  function updateCursor() {
    const start = input.selectionStart ?? input.value.length;
    const hasSelection = start !== input.selectionEnd;
    cursor.hidden = hasSelection;
    cursor.textContent = input.value[start] || ' ';
    cursor.style.transform = `translateX(calc(${start}ch - ${input.scrollLeft}px))`;
  }
  for (const type of ['input', 'keyup', 'click', 'select', 'scroll', 'focus']) {
    input.addEventListener(type, updateCursor);
  }
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) updateCursor();
  });

  // Clicking empty terminal space puts focus back in the prompt (but don't
  // steal a text selection the user is making).
  output.parentElement.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    if (String(window.getSelection())) return;
    input.focus();
  });

  // ---- Buttons ------------------------------------------------------------

  // The CSS grid uses this to give every button an equal share of the row.
  buttonBar.style.setProperty('--button-count', String(buttons.length));

  for (const def of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = def.label;
    button.title = def.command;
    button.addEventListener('click', () => runFromButton(def, button));
    buttonBar.append(button);
  }

  input.focus();
  updateCursor();

  return { submit, runFromButton, print };
}
