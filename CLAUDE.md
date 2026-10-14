# Retro Todolist: conventions

A DOS-adventure-game-styled to-do client. Today the backend is Todoist (API v1),
driven by commands that mirror the official `td` CLI. Vite + vanilla JS (ES
modules), with no framework and no TypeScript. JSDoc types the important shapes. Tests
use Vitest. Favor clear, plain code over cleverness.

## Naming
- The app is **Retro Todolist**. The display name is defined once, in
  `src/config.js` (`APP_NAME`). The title bar, `<title>` (via the
  `%APP_NAME%` plugin in `vite.config.js`), and banner all read it from there.
  The identifier form is `retro-todolist`.
- Use "Todoist" only where it really means the Todoist service: `src/todoist/`,
  td commands, and API error messages.

## Layout and the backend boundary
```
src/config.js       app name, prompt
src/main.js         composition root: the ONLY file that imports both terminal/ and todoist/
src/terminal/       generic UI: tokenizer, dispatch, built-ins, history, renderer, terminal, types
src/todoist/        backend: api.js (fetch client), commands.js (td command table), errors.js, buttons.js
tests/              Vitest tests, including boundary.test.js
```
- `src/terminal/` must never import from `src/todoist/`. `tests/boundary.test.js`
  enforces this. The terminal only knows the plain shapes in
  `src/terminal/types.js`: `CommandSet`, `Command`, `Result`, `ListItem`, and
  `ButtonDef`.
- Don't add a backend abstraction layer. Keep the boundary clean with plain data.

## Commands
- All td commands are defined in one place: `src/todoist/commands.js`. Each has
  `name`, `summary`, `usage`, and `handler`.
- The syntax must match the real Todoist CLI. Check with read-only
  `td <cmd> --help`. Never run `td` commands that modify data.
- Shell built-ins (`cls`, `help`, `mode`) live in `src/terminal/builtins.js` and
  stay separate from td commands. Unknown input prints `Bad command or file name`.
- Handlers return structured data (`{type: 'itemList' | 'message' | 'lines' |
  'clear' | 'setMode' | 'none', ...}`), never HTML. `render.js` turns results
  into DOM.
- `td task complete <name>` never guesses. If a name is ambiguous, list the
  matches with their `id:` refs.

## Buttons and animation
- Buttons never call handlers directly. A button sends a command string to
  `terminal.runFromButton()`, which types it and then calls the same `submit()`
  path as typed input.
- Only button-initiated commands animate, at 35ms per character. Typed commands
  run immediately, and output never animates.
- Input is locked while a command types, and extra clicks are ignored. Any
  keypress or click skips to the end. There is no animation under
  `prefers-reduced-motion`.

## Todoist API (v1)
- Base URL `https://api.todoist.com/api/v1`, Bearer token, called with
  `fetch()` (no SDK).
- Endpoints:
  - `GET /tasks/filter?query=today | overdue`
  - `GET /projects` (find the project with `inbox_project === true`)
  - `GET /tasks?project_id=`
  - `POST /tasks/quick {text}`
  - `POST /tasks/{id}/close`
- List endpoints are paginated with `{results, next_cursor}`, so follow the
  cursor.
- Check https://developer.todoist.com/api/v1/ before adding endpoints. Don't
  guess their shapes.

## Security
- Read the token only via `import.meta.env.VITE_TODOIST_TOKEN`, in
  `src/todoist/api.js`.
- Never write the token to a file, never log it, and never create `.env` files
  containing it.
- Don't add a build/deploy step. A build would embed the token in `dist/`.
- Task names are untrusted. Render with `textContent` / `createElement` only,
  never `innerHTML`.

## Accessibility
- Use real `<button>` elements.
- Output is a `role="log"` / `aria-live` region.
- Focus must be visible (yellow outline).
- The prompt input keeps focus after every command.

## Verification
- `npm test` must pass.
- To try it, run `npm run dev` (or the `dev` entry in `.claude/launch.json`).
  Read-only commands (`td today`, `td inbox`) are fine against the real
  account. Don't add or complete real tasks while verifying; the user tests
  those.
