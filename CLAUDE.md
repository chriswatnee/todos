# Todos: conventions

A to-do client styled like a classic late-80s adventure game. Today the backend is Todoist (API v1),
driven by commands that mirror the official `td` CLI. Vite + vanilla JS (ES
modules), with no framework and no TypeScript. JSDoc types the important shapes. Tests
use Vitest. Favor clear, plain code over cleverness.

## Design direction
- The shell is a classic adventure-game text parser (Infocom/Sierra style),
  not a DOS prompt. The prompt is `> ` (a `>` and one space), built-ins are plain words
  (`clear`, `help`, `expert on|off`), and messages talk like a parser
  (`I don't understand "xyzzy". Type help for commands.`). Avoid DOS-isms
  such as `C:\` prompts, `cls`, or "Bad command or file name".
- The EGA palette, cyan frame, and beveled buttons stay. The td commands themselves never
  change; they mirror the real CLI.

## Naming
- The app is **Todos**. The display name is defined once, in
  `src/config.js` (`APP_NAME`). The title bar, `<title>` (via the
  `%APP_NAME%` plugin in `vite.config.js`), and banner all read it from there.
  The identifier form (`APP_ID`, package name) is `todos`.
- The GitHub repository (`chriswatnee/todos`) and project folder are also
  named `todos`. The old name `retro-todolist` is retired.
- Use "Todoist" only where it really means the Todoist service: `src/todoist/`,
  td commands, and API error messages.

## Layout and the backend boundary
```
src/config.js       app name, prompt
src/main.js         composition root: the ONLY file that imports both terminal/ and todoist/
src/terminal/       generic UI: tokenizer, dispatch, built-ins, history, renderer, terminal, types
src/todoist/        backend: api.js (fetch client), auth.js (token storage, sign-in hint),
                    commands.js (td command table), errors.js, buttons.js
scripts/check-dist.js  post-build leak check (fails the build on token-like content in dist/)
tests/              Vitest tests, including boundary.test.js and security.test.js
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
- Shell built-ins (`clear`, `help`, `expert on|off`) live in
  `src/terminal/builtins.js` and stay separate from td commands. Unknown input
  prints `I don't understand "<first word>". Type help for commands.`
- Handlers return structured data (`{type: 'itemList' | 'message' | 'lines' |
  'clear' | 'setMode' | 'none', ...}`), never HTML. `render.js` turns results
  into DOM.
- `td task complete <name>` never guesses. If a name is ambiguous, list the
  matches with their `id:` refs.
- Auth mirrors `td auth`: `td auth token "<token>"` (verified with `GET /user`
  before saving), `td auth status`, `td auth logout`, and `td auth login` (which
  only points to `td auth token` for now). With no token, every other td command
  returns `notSignedIn()` from `src/todoist/auth.js` before any usage check or
  API call. Help still works.
- A command set can define `redact(line)`. The terminal uses it for the echoed
  command and history, never for dispatch. The td set masks
  `td auth token "********"`.
- A command can define `help()` for its own `--help` output (e.g. `td auth`).
  Otherwise its help is its usage plus summary.

## Buttons and animation
- Buttons and task-row checkboxes never call handlers directly. They send a
  command string to `terminal.runFromButton()`, which types it and then calls
  the same `submit()` path as typed input. `runFromButton()` returns a promise
  of the command's Result (or null if the click was ignored).
- UI state that depends on a command's outcome is driven by the Result in
  `terminal.apply()`, never by the button or checkbox that started it. That
  way typed and clicked commands behave the same.
- Only button-initiated commands animate, at 35ms per character. Typed commands
  run immediately, and output never animates.
- Input is locked while a command types, and extra clicks are ignored. Any
  keypress or click skips to the end. There is no animation under
  `prefers-reduced-motion`.

## Todoist API (v1)
- Base URL `https://api.todoist.com/api/v1`, Bearer token, called with
  `fetch()` (no SDK).
- Endpoints:
  - `GET /user` (verify a token; keep only `email` and `full_name`, because the
    response also echoes the token)
  - `GET /tasks/filter?query=today | overdue`
  - `GET /projects` (find the project with `inbox_project === true`)
  - `GET /tasks?project_id=`
  - `POST /tasks/quick {text}`
  - `POST /tasks/{id}/close`
- List endpoints are paginated with `{results, next_cursor}`, so follow the
  cursor.
- Check https://developer.todoist.com/api/v1/ before adding endpoints. Don't
  guess their shapes.

## Visual conventions
Future apps on this UI reuse the same look.
- **Palette:** all colors are CSS custom properties on `:root` in
  `src/styles.css`, and nowhere else. The base is EGA-inspired: black `#000000`,
  blue `#0000AA`, light gray `#AAAAAA`, dark gray `#555555`, white `#FFFFFF`,
  light cyan `#55FFFF`, and yellow `#FFFF55`.
- **Roles:** components use role tokens such as `--color-frame`,
  `--color-panel`, `--color-echo`, and `--color-alert`, never raw hex values. To
  add a color, add an EGA base token, then a role that points to it.
- **Frame:**
  - The page is black, with a bright cyan border around the whole app.
  - The title bar is a flat gray bar with no bevel, so it doesn't look like a
    button. The title is left-aligned in Press Start 2P, a bold pixel
    font. The right side is reserved, e.g. for a username later.
  - The output panel is blue, with a cyan border and a thin black inner gap.
  - "CHOOSE AN ACTION:" (yellow) and the buttons sit directly on black.
- **Text:**
  - Body text uses VT323.
  - Output is white. Confirmations and empty states are cyan. Errors, headings,
    and priority marks are yellow.
  - Echoed commands (`> td today`), the input prompt (`> `), typed text, and
    the block cursor are cyan. The `>` is plain VT323 (no shadow, no other
    font); the space after it is what makes it read clearly.
- **Buttons:**
  - Buttons are gray raised bevels. The bevel inverts when pressed, and also
    while a button's command is typing (`.pressed`).
  - They share the full width equally in a grid (`--button-count`, set by
    `terminal.js`), and wrap to rows of 3, or 2 on very small screens.
- **Task rows:**
  - Each row has two columns, shared across the list via CSS subgrid, with a
    1ch gap. The left column is exactly as wide as its content: `[ ]` in normal
    mode, the `id:` ref in expert mode.
  - The right column holds an optional priority mark, then a text block (task
    text plus detail) that wraps on its own. Wrapped lines hang under the task
    text.
  - Due dates read "today" for today, and keep the date otherwise. Overdue dates
    use `--color-warning` (yellow; light red is only 4.2:1 on blue). The item's
    `detailWarning` text ("overdue") is added as screen-reader-only text, so
    color isn't the only signal.
  - The checkbox is a `<button role="checkbox" aria-checked>` labelled by the
    task text (`aria-labelledby`), with a yellow focus outline.
  - It shows `[ ]` while open and turns yellow on hover or while its command
    types.
  - Clicking only types and runs the command. Rows are ticked from the result:
    a successful `td task complete` returns `checkedKey` (the task id), and
    the terminal calls `markItemsChecked()` for every on-screen row whose
    `key` matches. This works whether the command was typed by id, typed by
    name, or clicked.
  - A ticked row shows `[X]` in cyan, its text dims (no strikethrough),
    and the box becomes disabled. There is no uncomplete yet. A failed or
    ambiguous command ticks nothing.
  - Secondary info such as `id:` refs uses `--color-dim` (light gray). On
    phones the refs are shrunk so they don't squeeze the text column.
- **Expert mode:** `expert on` (the EXPERT button) adds the `expert-mode` class to `#app`. CSS
  then hides the button bar and the row checkboxes, and shows each row's `id:` ref
  instead. Because it's one class, rows already on screen switch too.
  `expert off` brings the buttons back, and the expert-mode message says so.
- **Output panel:** it scrolls, but its scrollbar is hidden in all browsers.
  The wheel, touch, keyboard (when focused), and PageUp/PageDown from the
  prompt all still scroll it, and new output always scrolls to the bottom.

## Security
- The app is meant to be hosted publicly. Each user supplies their own token
  with `td auth token`. It's stored in localStorage (key `todos:todoist-token`)
  only through `src/todoist/auth.js`, which wraps every storage access in
  try/catch. `main.js` passes it to `createTodoistApi()`, and `api.setToken()`
  swaps it.
- Never read a token from the build environment. Nothing in `src/` may
  reference `import.meta.env` (`tests/security.test.js` enforces this), so Vite
  never inlines one.
- Never log the token, never show it (the echo and history are masked via
  `redact`), and never write it to a file or `.env`.
- `npm run build` runs `scripts/check-dist.js` as `postbuild`. It fails the build
  if `dist/` contains `VITE_TODOIST_TOKEN` or a 40-hex-character string.
- The production build gets a strict CSP `<meta>` from `cspPlugin()` in
  `vite.config.js` (`apply: 'build'`, so the dev server is untouched). It allows
  `'self'`, `https://api.todoist.com` (connect), and Google Fonts (style/font). If
  you add a host, add it there and say why.
- `script-src` stays `'self'`. Never allow a third-party script host (analytics,
  tag managers, CDNs). The token is in localStorage, so any script on the page
  can read it and send it anywhere. For this reason Cloudflare Web Analytics
  injection stays off for todos.chriswatnee.com. If its beacon ever shows up as
  a CSP error, turn the injection off in the dashboard; don't widen the CSP.
  `tests/headers.test.js` checks that `script-src` is exactly `'self'`.
- Deployment is Cloudflare Workers static assets (`wrangler.jsonc`, Node from
  `.nvmrc`). `public/_headers` sends the same CSP as a header plus
  `frame-ancestors 'none'`, `nosniff`, and the referrer policy. A CSP change
  goes in both places; `tests/headers.test.js` enforces this.
- Task names are untrusted. Render with `textContent` / `createElement` only,
  never `innerHTML`.

## Accessibility
- Use real `<button>` elements.
- Output is a `role="log"` / `aria-live` region.
- Focus must be visible (yellow outline).
- The prompt input keeps focus after every command.

## Verification
- `npm test` must pass.
- `npm run build` must pass, including the leak check.
- To try it, run `npm run dev` (or the `dev` entry in `.claude/launch.json`).
  To check the built app and its CSP, use the `preview` entry after a build.
  Never use the user's real token. Test sign-in rejection with an obviously
  fake token. Read-only commands are fine if the user has signed in themselves.
  Don't add or complete real tasks while verifying; the user tests those.

## Git
- Temporary files such as commit messages go in a scratchpad outside the
  project, and are deleted after use.
- Check `git status` before staging.
