# Retro Todolist

A to-do list client that looks like a late-80s adventure game: EGA colors,
beveled gray buttons, and a `>` parser prompt. The current backend is
[Todoist](https://todoist.com), driven through commands that match the official
Todoist CLI (`td`).

Clicking a button types the equivalent `td` command into the prompt, one
character at a time, and then runs it, so you learn the commands by watching.

> **Local-only prototype. Do not deploy it publicly.**
> The Todoist API token is read through `import.meta.env`, so Vite puts it
> into the JavaScript sent to the browser. Anyone who can load the page can read
> your token. That's also why there is no `build` script: a production build
> would write the token into the files in `dist/`.

## Setup

Requirements: Node 20+ and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Provide your Todoist API token as the environment variable
   `VITE_TODOIST_TOKEN`. You can find the token in Todoist under
   Settings → Integrations → Developer. Set it in your shell or tool
   environment (for example, Claude Desktop's local environment editor). Don't
   put it in a committed file. `.env*.local` files are git-ignored if you must
   use one.

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
| `td --help` | The td commands this app supports |
| `help` | Built-in shell commands |
| `clear` | Clear the screen |
| `expert on` / `expert off` | Hide or show the button bar |

Up and Down arrows cycle through command history. Pressing any key or clicking
during a button's typing animation skips to the end of the animation.
