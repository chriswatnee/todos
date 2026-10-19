# Todos

A to-do list client that looks like a late-80s adventure game: EGA colors,
beveled gray buttons, and a `>` parser prompt. The current backend is
[Todoist](https://todoist.com), driven through commands that match the official
Todoist CLI (`td`).

Clicking a button types the equivalent `td` command into the prompt, one
character at a time, and then runs it, so you learn the commands by watching.

> **Unofficial client.** Todos is not affiliated with, endorsed by, or
> supported by Doist, the makers of Todoist.

## Signing in

Each person signs in with their own Todoist API token, the same way as the real
`td` CLI:

1. In Todoist, open Settings → Integrations → Developer and copy your API token.
2. At the prompt, type:

   ```
   td auth token "<your token>"
   ```

   The app checks the token with a read-only call to Todoist and saves it only if
   Todoist accepts it. The token is masked in the echoed command and in history
   (`td auth token "********"`).

`td auth status` shows which account you're signed in as. `td auth logout`
removes the token. `td auth login` (browser sign-in) isn't available yet.

**Where the token is stored:** in your browser's `localStorage`, for this site
only. It's never part of the app's files and is only ever sent to
`api.todoist.com`. Anyone with access to your browser profile can read it, so
run `td auth logout` on shared computers. You can also revoke the token at any
time in Todoist.

## Setup

Requirements: Node 24 (pinned in `.nvmrc`) and npm.

```bash
npm install
```

## Running

```bash
npm run dev
```

Open http://localhost:5173.

```bash
npm test
```

Runs the Vitest unit tests.

## Commands

| Command | What it does |
|---|---|
| `td today` | Tasks due today plus overdue |
| `td inbox` | Tasks in the Inbox |
| `td add "<text>"` | Quick add with natural language, e.g. `td add "Buy milk tomorrow p1 #Shopping"` |
| `td task complete <ref>` | Complete a task. `<ref>` is `id:xxx` or a task name (case-insensitive; ambiguous names are refused) |
| `td auth token "<token>"` | Check and save your Todoist API token |
| `td auth status` | Show whether you're signed in, and as whom |
| `td auth logout` | Remove the saved token |
| `td auth login` | Browser sign-in (not available yet; use `td auth token`) |
| `td --help` | The td commands this app supports |
| `help` | Built-in shell commands |
| `clear` | Clear the screen |
| `expert on` / `expert off` | Hide or show the button bar |

Up and Down arrows cycle through command history. Pressing any key or clicking
during a button's typing animation skips to the end of the animation.

## Hosting

The app is a static site with no server and no secrets of its own, so it's safe
to host publicly.

```bash
npm run build
```

This writes `dist/`. Deploy that folder to any static host. `npm run preview`
serves the built files locally.

Two safeguards run with every build:

- **Leak check** (`scripts/check-dist.js`, run automatically as `postbuild`).
  The build fails if any file in `dist/` contains `VITE_TODOIST_TOKEN` or
  anything shaped like a Todoist token (40 hex characters).
- **Content Security Policy.** The built `index.html` carries a strict CSP
  `<meta>` tag. It allows only the app's own files, `api.todoist.com`, and Google
  Fonts. The dev server doesn't get the policy, so hot reload keeps working.

## Deploying to Cloudflare

The app deploys to Cloudflare Workers as a static-assets-only Worker (no Worker
script). `wrangler.jsonc` points Cloudflare at `dist/`. Connect the GitHub repo
in the Cloudflare dashboard (Workers & Pages → Create application → import the
repository) and use:

| Setting | Value |
|---|---|
| Project (Worker) name | `todos`. It must match `name` in `wrangler.jsonc` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (the default; it runs the Wrangler version pinned in `package.json`) |
| Root directory | leave empty (repo root) |
| Node version | from `.nvmrc` (24.18.0); no `NODE_VERSION` variable needed |
| Build variables | none. Never add a Todoist token |

Cloudflare installs dependencies with npm (from `package-lock.json`), runs the
build (including the leak check, so a leak fails the deploy), then uploads
`dist/`. Wrangler is a pinned devDependency, so `npx wrangler` uses that exact
version rather than downloading the latest.

`wrangler.jsonc` defines no routes or custom domains. Add the custom domain in
the dashboard (the Worker's Settings → Domains & Routes). Keep `route` and
`routes` out of `wrangler.jsonc`: Wrangler replaces dashboard routes with the
config's routes on every deploy. `"workers_dev": false` turns off the
`workers.dev` address, so the app is served only at
https://todos.chriswatnee.com.

**Response headers.** `public/_headers` is copied into `dist/`, and Cloudflare
sends its headers on every response (it doesn't serve the file itself):

- `Content-Security-Policy`: the same policy as the `<meta>` tag (`CSP` in
  `vite.config.js`) plus `frame-ancestors 'none'`, which a `<meta>` tag can't
  set. `tests/headers.test.js` fails if the two drift apart, so change the
  policy in both places.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

To check a build locally with Cloudflare's own server (headers included), run
`npm run build` and then `npx wrangler dev`.

Other static hosts work too: deploy `dist/` and send the same headers with
that host's own mechanism.
