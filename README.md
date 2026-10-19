# Todos

**Try it: https://todos.chriswatnee.com**

Todos is a to-do list that looks and feels like a late-80s adventure game: EGA
colors, beveled gray buttons, and a `>` text-parser prompt. Your tasks come from
your own [Todoist](https://todoist.com) account, and you manage them with
commands that match Todoist's official command-line tool, `td`.

You don't need to know any commands to start. Clicking a button types the
matching `td` command into the prompt, one character at a time, and then runs
it, so you pick up the commands by watching.

> **Unofficial client.** Todos is an independent project. It is not affiliated
> with, endorsed by, or supported by Doist, the makers of Todoist. "Todoist" is
> used only to say which service Todos connects to.

## Signing in

Todos has no accounts of its own. You sign in with your personal Todoist API
token, the same way as the real `td` CLI.

1. **Get your token.** In Todoist (web or desktop), open **Settings →
   Integrations → Developer** and copy your **API token**.
2. **Sign in.** At the Todos prompt, type:

   ```
   td auth token "<your token>"
   ```

   Todos checks the token with a read-only request to Todoist and saves it only
   if Todoist accepts it. The token is masked as `td auth token "********"`
   on screen and in the command history.

Other sign-in commands:

- `td auth status` shows which Todoist account you're signed in as.
- `td auth logout` removes the token from this browser.
- `td auth login` (sign-in through the browser) isn't available yet.

### Where your token goes

Your token is a password for your Todoist account, so Todos keeps it in as few
places as possible:

- **It's stored only in your browser,** in `localStorage` for this site. Todos
  has no server and no database, so there's nowhere else for it to go.
- **It's sent only to Todoist.** The page is static files plus your browser
  talking directly to `api.todoist.com`. The site's Content Security Policy
  allows network requests to `api.todoist.com` and nowhere else, and allows no
  third-party scripts (no analytics, no trackers), so nothing else on the page
  can read the token or send it elsewhere.
- **It's never part of the app's files.** Every build is checked, and fails if
  anything shaped like a Todoist token ends up in the published files.

Anyone with access to your browser profile can read `localStorage`, so run
`td auth logout` when you're done on a shared computer. You can also revoke or
regenerate the token at any time from the same Todoist settings page.

## Commands

| Command | What it does |
|---|---|
| `td today` | Tasks due today, plus overdue tasks |
| `td inbox` | Tasks in your Inbox |
| `td add "<text>"` | Quick add with natural language, e.g. `td add "Buy milk tomorrow p1 #Shopping"` |
| `td task complete <ref>` | Complete a task. `<ref>` is `id:xxx` or the task's name (case-insensitive; if a name matches more than one task, nothing is completed and the matches are listed) |
| `td auth token "<token>"` | Check and save your Todoist API token |
| `td auth status` | Show whether you're signed in, and as whom |
| `td auth logout` | Remove the saved token |
| `td --help` | The `td` commands Todos supports |
| `help` | Built-in commands |
| `clear` | Clear the screen |
| `expert on` / `expert off` | Hide or show the button bar |

The Up and Down arrows step through your command history. Press any key or
click during a button's typing animation to skip to the end.

## Running it locally

You need Node 24 (the exact version is in `.nvmrc`) and npm.

```bash
git clone https://github.com/chriswatnee/todos.git
```

```bash
cd todos
```

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173 and sign in with `td auth token` as above.

Other scripts:

- `npm test` runs the Vitest tests.
- `npm run build` builds the site into `dist/` and then runs the leak check
  (`scripts/check-dist.js`). The build fails if `dist/` contains anything shaped
  like a Todoist token.
- `npm run preview` serves the built `dist/` locally, with the production
  Content Security Policy.

## Hosting your own copy

Todos is a static site with no secrets of its own, so you can host the `dist/`
folder anywhere. Never put a Todoist token in the build environment; each person
signs in from their own browser.

Send these response headers if your host allows it. `public/_headers` already
sets them for Cloudflare:

- `Content-Security-Policy`: the policy in `CSP` in `vite.config.js`, plus
  `frame-ancestors 'none'`. The built `index.html` also carries the policy as a
  `<meta>` tag, but a `<meta>` tag can't set `frame-ancestors`.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Cloudflare

The public site runs on Cloudflare Workers as a static-assets-only Worker
(`wrangler.jsonc`, no Worker script). To deploy your own, import the repository
in the Cloudflare dashboard (Workers & Pages → Create application) with:

| Setting | Value |
|---|---|
| Worker name | must match `name` in `wrangler.jsonc` (`todos`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (the default; it uses the Wrangler version pinned in `package.json`) |
| Root directory | leave empty |
| Node version | read from `.nvmrc`; no setting needed |
| Build variables | none |

Add your custom domain in the dashboard and keep `route`/`routes` out of
`wrangler.jsonc`, because Wrangler replaces dashboard routes with any routes in
the config on every deploy. `"workers_dev": false` turns off the `workers.dev`
address. To try a build with Cloudflare's own server, headers included, run
`npm run build` and then `npx wrangler dev`.

The HTML page is sent with `Cache-Control: ... no-transform`, which stops
Cloudflare Web Analytics from injecting its script into the page.

## License

[MIT](LICENSE) © 2026 Chris Watnee
