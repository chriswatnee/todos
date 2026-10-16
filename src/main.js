// Composition root: the only file that knows about both the terminal and the
// Todoist backend. Swapping the backend means changing the imports here.

import './styles.css';
import { APP_NAME, PROMPT } from './config.js';
import { createTerminal } from './terminal/terminal.js';
import { builtins } from './terminal/builtins.js';
import { createTodoistApi } from './todoist/api.js';
import { tdCommandSet, HELP_FOOTER } from './todoist/commands.js';
import { tdButtons } from './todoist/buttons.js';
import { loadToken, notSignedIn } from './todoist/auth.js';

document.title = APP_NAME;

// Each visitor signs in with their own token (td auth token); it lives in this
// browser's localStorage. Nothing comes from the build environment.
const api = createTodoistApi({ token: loadToken() });

const terminal = createTerminal({
  elements: {
    output: document.getElementById('output'),
    input: /** @type {HTMLInputElement} */ (document.getElementById('command-input')),
    cursor: document.getElementById('cursor'),
    prompt: document.getElementById('prompt'),
    app: document.getElementById('app'),
    buttonBar: document.getElementById('button-bar'),
  },
  prompt: PROMPT,
  commandSet: tdCommandSet,
  builtins,
  ctx: { api, knownTasks: [], helpFooter: HELP_FOOTER },
  buttons: tdButtons,
});

terminal.print({
  type: 'lines',
  lines: [`${APP_NAME.toUpperCase()} v0.1`, 'Type help for commands, or td --help for Todoist commands.', ''],
});

if (!api.hasToken) {
  terminal.print(notSignedIn());
}
