# Fern

> The end of README rot.

A local-first markdown editor for technical workspaces. Write docs with live, runnable code blocks — bash, Python, Node.js, Go, Rust, and more — all executing locally on your machine.

---

## Platform support

**Windows only** — Fern currently ships as a Windows desktop app (x64). Mac and Linux builds are not yet available.

---

## Download & install

Download the latest `.exe` installer from the [Releases](../../releases) page.

### Windows SmartScreen warning

Because Fern is not yet code-signed, Windows will show a SmartScreen prompt when you run the installer. This is expected.

**To proceed:**

1. When you see _"Windows protected your PC"_, click **More info**
2. Click **Run anyway**

Alternatively, right-click the `.exe` → **Properties** → tick **Unblock** → **OK**, then run it.

Once installed, Fern launches normally and the warning will not appear again.

---

## Features

- **Runnable code blocks** — execute bash, PowerShell, Node.js, TypeScript, Python, Ruby, Go, Rust, PHP, Deno, Bun, and Perl directly inside your documents
- **Live embeds** — embed local files, CSV tables, API responses, GitHub issues, and `.env` variables inline
- **Charts & diagrams** — Mermaid diagrams (flowcharts, sequence, Gantt, pie, radar…) and Chart.js visualisations rendered in the preview pane
- **Git integration** — stage, commit, push, pull, and browse history without leaving the editor
- **Revision history** — per-file snapshots saved on every autosave, browseable and restorable at any time
- **Named block I/O** — pipe stdout from one block into the environment of another
- **Workspace search** — full-text search across every file in your workspace
- **Embedded terminal** — xterm.js terminal running in the workspace directory

---

## Running runtimes

Fern executes code using whatever is already installed on your machine. To run a given language, the corresponding runtime must be on your `PATH`:

| Language | Required | Install |
|---|---|---|
| Bash / Shell | Git for Windows (ships bash) | [git-scm.com](https://git-scm.com) |
| PowerShell | Built into Windows | — |
| Node.js / TypeScript | Node.js | [nodejs.org](https://nodejs.org) |
| Python | Python | [python.org](https://python.org) |
| Ruby | Ruby | [ruby-lang.org](https://ruby-lang.org) |
| Go | Go | [go.dev](https://go.dev) |
| Rust | Rust (rustc) | [rustup.rs](https://rustup.rs) |
| PHP | PHP | [php.net](https://php.net) |
| Deno | Deno | [deno.land](https://deno.land) |
| Bun | Bun | [bun.sh](https://bun.sh) |
| Perl | Perl | Included on most systems |

If a runtime is not installed, Fern will show a clear message telling you what to install when you try to run a block.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Open folder |
| `Ctrl+P` | Quick open (file search) |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+N` | New file |
| `Ctrl+W` | Close active tab |
| `Ctrl+F` | Find in document |
| `Ctrl+Shift+F` | Search workspace |
| `Ctrl+1` / `2` / `3` | Edit / Split / Preview mode |
| `Ctrl+Shift+Enter` | Run all blocks |
| `Ctrl+Shift+G` | Git panel |
| `Ctrl+Shift+H` | Revision history |
| `Ctrl+,` | Settings |
| `/` in editor | Insert block (slash menu) |

---

## Building from source

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build a distributable installer
npm run dist
```

Requires Node.js 18+ and Git for Windows.

---

## License

MIT
