# Fern — Current Build State

> **Stack:** Electron 33.4.4 · Vite + React 19 · TypeScript · CodeMirror 6
> **Description:** "The end of README rot." — a local-first markdown editor for technical workspaces.
> **Version:** 0.1.0 (pre-release, not yet packaged for distribution)

---

## App Architecture

### Shell
- **Electron** main process + renderer (Vite dev server in dev, `dist/` in prod)
- **electron-store** for persisted settings, recent folders, pinned files, revisions, snapshots, file colours
- **simple-git** for all git operations in the main process
- **node-pty** (optional, requires VC++ build tools on Windows) for an embedded terminal
- **IPC bridge** via `contextBridge` — renderer never touches Node directly
- **Preload script** (`electron/preload.ts`) exposes `window.fern` API

### Renderer layout
```bash run
TopBar (36px)
└── app-body
    ├── Sidebar (240px, fixed)
    └── app-main (flex: 1)
        ├── Editor / PreviewPane / page views
        ├── Terminal (collapsible panel, bottom)
        └── StatusBar (24px)
```

---

## Navigation — AppPage System

Single `activePage` state drives full-page rendering (no modal overlays):

| Page | Renders |
|---|---|
| `editor` | Editor + optional PreviewPane split |
| `overview` | OverviewPage — project summary, stats, block index |
| `git` | GitPanel — full source control UI |
| `settings` | SettingsPanel — all user preferences |
| `revisions` | RevisionHistory — per-file snapshot browser |
| `search` | WorkspaceSearch — full-workspace text search across all files |

Clicking any file in the sidebar always returns to `editor` page.

---

## Features

### Editor (`Editor.tsx`)
- **CodeMirror 6** markdown editor with custom `fernHighlight` syntax theme
- **Dark/light-aware syntax highlighting** — headings, bold, links, inline code adapt to theme via compartment hot-swap
- **View modes:** Edit · Split · Preview (toggled from TopBar)
- **Vim mode** — hot-swappable via compartment, no editor restart
- **Font size & line height** — hot-swappable, persisted in settings
- **Spell check** — native browser spell check on `contentDOM`, toggle in settings
- **Spell check context menu** — right-click misspelled words: suggestions, "Add to dictionary", cut/copy/paste/undo/redo (native Electron context-menu event)
- **Slash menu** — type `/` anywhere to open a searchable block-insertion menu
- **Image drag-drop** — drop image files; copies to `assets/` folder, inserts `![name](assets/name.ext)` at cursor; dashed green drop overlay while dragging
- **Autosave** — configurable delay (default 800ms), saves a revision snapshot on each autosave
- **Outline scroll sync** — emits `fern:visible-line` events on scroll; OutlinePanel listens and highlights active heading
- **Jump-to-line** — listens for `fern:jump-to-line` events; scrolls wrapper directly using `lineBlockAt().top + editorOffsetTop`
- **In-file search** — `Ctrl/Cmd+F` opens CodeMirror's native search panel (find + inline replace) via `@codemirror/search`'s `searchKeymap`; also triggerable via the `fern:open-search` custom event from the Command Palette's "Find in Document" action

### Preview Pane (`PreviewPane.tsx`)
- **marked** for markdown-to-HTML rendering
- **Inline runnable code blocks** (`CodeBlock.tsx`) — bash, python, node, http/https with output displayed inline
- **HTTP blocks** (`HttpBlock.tsx`) — run API calls inline, response shown in preview
- **API embed blocks** (`ApiEmbed.tsx`) — live API responses embedded in documents, per-workspace trust + cache duration controls
- **File embed blocks** (`FileEmbed.tsx`) — embed contents of local workspace files inline
- **CSV embed / table** (`CsvEmbed.tsx`, `CsvTable.tsx`, papaparse) — render CSV files as formatted tables
- **Env embed** (`EnvEmbed.tsx`) — display `.env` values masked in the document
- **Issues embed** (`IssuesEmbed.tsx`, @octokit/rest) — embed live GitHub issues lists
- **JSON tree** (`JsonTree.tsx`) — collapsible JSON viewer
- **Mermaid diagrams** — renders ` ```mermaid ``` ` fences as SVG via the mermaid npm package (lazy, on-demand)
- **Pinned outputs** — code block outputs can be pinned and persist between sessions (stored in `.fern/snapshots/`)
- **Jump-to-heading** — listens for `fern:jump-to-heading` events, scrolls preview to matching `<h1/2/3>` by text
- **Per-segment error boundaries** — every chart, diagram, and embed (file/csv/api/issues/env) plus every code/HTTP block is individually wrapped in `ErrorBoundary.tsx`. A render exception in one segment shows an inline "Couldn't render this" box with a retry button instead of taking down the whole preview or app.

### Workspace Search (`WorkspaceSearch.tsx`, full-page)
- `Ctrl/Cmd+Shift+F` — full-text search across every file in the open workspace
- Results grouped by file, with line numbers and match count per file
- Click a result to open that file and jump straight to the matching line

### Multi-file Tabs (`TabBar.tsx`)
- Opening a file (sidebar, Quick Open, search result) adds it to the tab bar if not already open
- `Ctrl/Cmd+W` closes the active tab; closing the active tab activates a neighbouring tab
- `Ctrl/Cmd+Shift+[` / `Ctrl/Cmd+Shift+]` cycle to the previous/next tab
- Dirty (unsaved) dot per tab, synced from the same `dirtyFiles` set as the sidebar

### Welcome Screen (`WelcomeScreen.tsx`)
- Shown whenever no file is open (fresh launch or after closing the last tab)
- **Get started** panel: Open folder (`Ctrl/Cmd+O`), New file (`Ctrl/Cmd+N`)
- **Recent** panel: up to `MAX_RECENT` (5) most recently opened workspace folders, click to reopen
- **What Fern can do** panel: tabbed feature overview (Home / Code blocks / Embeds / Shortcuts) summarising run code, live embeds, charts & diagrams, git integration, revision history, and named block I/O

### Sidebar (`Sidebar.tsx`)
- File tree with folder expand/collapse
- Drag-and-drop file move between folders
- Inline rename (click → type name → Enter)
- Per-file colour tagging (7 colours + none)
- Pinned files section at top of tree
- Dirty (unsaved) dot indicator per file
- Right-click context menu: rename, delete, pin, set colour, show in Explorer
- Recent workspaces list on welcome/no-folder state
- "Open folder" button (accent green)

### Outline Panel (`OutlinePanel.tsx`)
- Parses `#`, `##`, `###` headings from document content (skips code fences)
- Collapsible, sits below file tree in sidebar
- **Active section tracking** — `fern:visible-line` events from Editor scroll; highlights last heading whose line <= visible line (with +90px lookahead)
- Active heading: bold (700 weight), accent green colour, left accent border, accent-bg background
- **Click to navigate** — fires `fern:jump-to-line` (Editor scrolls) + `fern:jump-to-heading` (Preview scrolls); immediately fires correct `fern:visible-line` so highlight updates instantly on click
- Indentation: H1 = 10px, H2 = 20px, H3 = 30px

### Git Panel (`GitPanel.tsx`, full-page)
- **Changes tab** — staged/unstaged file list with status indicators (M, A, D, ?)
- **History tab** — last 50 commits via simple-git: message · short hash · author · relative date
- **Diff view** — click any changed file or commit for line-by-line diff (added/removed/context/hunk headers)
- Commit message input + commit button
- Push / pull with upstream detection prompt
- Init repository if not a git repo
- Diff colours adapt to dark/light mode via CSS variables

### Revision History (`RevisionHistory.tsx`, full-page)
- Per-file snapshots saved on every autosave
- Browse timeline, preview content, restore any version

### Settings Panel (`SettingsPanel.tsx`, full-page)

**Appearance**
- Theme: Light · System · Dark (three-way toggle, accent-green active state)

**Editor**
- Vim keybindings (toggle)
- Font size (slider)
- Line height (slider)
- Spell check (toggle)
- Autosave delay (slider, 200ms–3000ms)

**Interface**
- Show word count (toggle)
- Show outline panel (toggle)

**GitHub**
- Personal access token input (for Issues embed + GitHub API)
- Connect / disconnect button

**Embeds & Network**
- API embeds trust per workspace (Allow / Block)
- Cache duration selector (30s / 60s / 5min / never)

### Overview Page (`OverviewPage.tsx`)
- Project-level summary: file count, word count, block count
- Index of all runnable blocks across the workspace with file + language

### Quick Open (`QuickOpen.tsx`)
- `Cmd/Ctrl+P` — fuzzy file search, keyboard-navigable

### Command Palette (`CommandPalette.tsx`)
- `Cmd/Ctrl+Shift+P` — searchable action palette

### Terminal (`Terminal.tsx`)
- Embedded xterm.js terminal (node-pty)
- Collapsible panel at bottom of editor area
- CWD set to workspace folder

### Status Bar (`StatusBar.tsx`)
- Block run status: `N of M ran` / `Running N...` / `0 blocks`
- Vim mode badge
- Word count + estimated read time (strips code blocks before counting)
- Detected runtime versions: node · python · deno · bun · ruby · go · rust · php (up to 3 shown)

### Loading Screen (`LoadingScreen.tsx`)
- Animated fern logo (breathe/pulse animation)
- Rotating tips while workspace loads

### Auto-Update
- `electron-updater` checks for updates in packaged builds
- `window.fern.onUpdateDownloaded` fires when a new version has finished downloading in the background
- A fixed bottom bar appears: "Fern {version} is ready to install" with **Restart & Update** (`window.fern.installUpdate()`) and **Later** (dismiss) buttons

---

## Slash Menu (`SlashMenu.tsx`)

Type `/` in the editor to open. Filters by label, description, group or id. Keyboard: up/down to navigate, Enter to insert, Esc to close. Opens above cursor if near bottom of viewport.

| Group | Items |
|---|---|
| **Text** | Heading 1/2/3, Bullet List, Numbered List, To-do List, Quote, Divider, Table, Bold, Italic, Link, Image |
| **Color** | Muted, Red, Orange, Yellow, Green, Blue, Purple (HTML span wrappers with c-* classes) |
| **API** | GET, POST, PUT, DELETE, Authenticated GET (all as http run blocks) |
| **Run** | Bash, PowerShell, Node.js, TypeScript, Python, Ruby, Go, Deno, PHP, Rust |
| **Embed** | File embed, CSV embed, API embed, Issues embed, Env variable |
| **Code** | JS, TS, Python, HTML, CSS, JSON, YAML, SQL, GraphQL, Dockerfile, Shell, Go, Rust, TOML, XML, Plain |

---

## IPC Bridge — `window.fern` API

### File System
`openFolder` · `readFile` · `writeFile` · `listFiles` · `createFile` · `createFolder` · `renameFile` · `deleteFile` · `moveFile` · `showInFolder` · `copyFile`

### File Metadata
`getFileColors` · `setFileColor` · `getPinnedFiles` · `setPinnedFiles`

### Settings
`getSettings` · `setSettings` — persisted via electron-store, merged with defaults

### Revision History
`getRevisions` · `saveRevision` · `deleteRevisions`

### Pinned Outputs
`getSnapshots` · `setSnapshot` · `clearSnapshot`

### Code Execution
`runBlock` (bash/node/python/etc via child_process) · `stopBlock` · `onOutput` (streaming stdout/stderr per blockId)

### Git
`gitStatus` · `gitCommit` · `gitPush` · `gitPull` · `gitInit` · `gitDiffFile` · `gitGetRemotes` · `gitHasUpstream` · `gitLog` (last 50) · `gitShow` (commit diff text)

### Terminal
`createTerminal` · `terminalInput` · `terminalResize` · `closeTerminal` · `onTerminalOutput`

### Embeds & API
`readWorkspaceFile` · `apiEmbedFetch` · `apiEmbedInvalidate` · `getApiTrust` · `setApiTrust` · `readEnvFile` · `checkEnvGitignore` · `addEnvToGitignore`

### GitHub
`getGithubToken` · `setGithubToken` · `githubWhoami` · `githubListIssues`

### Misc
`getLastFolder` · `setLastFolder` · `getRuntimeVersions` · `openExternal` · `onUpdateDownloaded` · `installUpdate`

---

## Theme System

### Mechanism
- CSS custom properties on `:root` (light defaults)
- Dark mode: `[data-theme="dark"]` set on `<html>` by App.tsx useEffect
- System mode: `@media (prefers-color-scheme: dark)` applies same dark values when no explicit theme is set
- Editor CodeMirror theme + highlight style swap via compartments when `isDark` prop changes

### Key CSS Variables

| Token | Light | Dark |
|---|---|---|
| `--bg-app` | `#FFFFFF` | `#191919` |
| `--bg-sidebar` | `#FBFBFA` | `#202020` |
| `--bg-hover` | `#F1F1EF` | `#2A2A2A` |
| `--bg-selected` | `#E9E9E7` | `#333333` |
| `--bg-code` | `#F7F6F3` | `#2F3437` |
| `--text-primary` | `#37352F` | `#E9E9E7` |
| `--text-secondary` | `#6B6B6B` | `#9B9A97` |
| `--text-muted` | `#9B9A97` | `#6F6E69` |
| `--accent` | `#1A5C43` | `#1A5C43` |
| `--accent-hover` | `#144D38` | `#144D38` |
| `--accent-bg` | `#E8F0EC` | `#192820` |
| `--border` | `#E9E9E7` | `#2A2A2A` |
| `--border-strong` | `#D3D1CB` | `#3D3D3D` |
| `--diff-added-bg` | `#EAF3DE` | `#1A2E1A` |
| `--diff-added-text` | `#2D5740` | `#7EC897` |
| `--diff-removed-bg` | `#FDECEA` | `#2E1A1A` |
| `--diff-removed-text` | `#A6342B` | `#E07070` |

### Brand / Icon
- App icon: `assets/logo.svg` -> `assets/icon.ico` (Windows), `assets/icon.png` (all platforms)
- Brand green: `#1A5C43` — hardcoded in FernLogo and icon, never changes with theme
- All primary action buttons use `var(--accent)` / `var(--accent-hover)`: Run all, Commit, Push, Init, Connect, Open folder, Allow, theme toggle active state
- Global button reset includes `background: transparent; color: inherit` so un-styled buttons never flash OS default grey

### Editor Syntax Colours (dark-aware, via compartment)

| Token | Light | Dark |
|---|---|---|
| Headings / Bold | `#37352F` | `#E9E9E7` |
| Links | `#1A5C43` | `#5DC09E` |
| URLs | `#2F7C5F` | `#4DAB8C` |
| Inline code text | `#EB5757` | `#FF8A80` |
| Inline code bg | `rgba(135,131,120,0.15)` | `rgba(255,255,255,0.08)` |
| Strings | `#98C379` | `#98C379` |
| Keywords | `#E5C07B` | `#E5C07B` |
| Comments / muted | `#9A9589` | `#6B6B6B` |
| Punctuation | `#C7C4BD` | `#555555` |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+O` | Open folder |
| `Cmd/Ctrl+P` | Quick Open (file search) |
| `Cmd/Ctrl+Shift+P` | Command Palette |
| `Cmd/Ctrl+N` | New file |
| `Cmd/Ctrl+W` | Close active tab |
| `Cmd/Ctrl+Shift+[` / `]` | Previous / next tab |
| `Cmd/Ctrl+F` | Find in current document (CodeMirror search panel) |
| `Cmd/Ctrl+Shift+F` | Search workspace (toggles the `search` page) |
| `Cmd/Ctrl+1` / `2` / `3` | Edit / Split / Preview view mode |
| `Cmd/Ctrl+Shift+D` | Toggle distraction-free mode |
| `Cmd/Ctrl+Shift+Enter` | Run all blocks |
| `` Cmd/Ctrl+` `` or `Cmd/Ctrl+T` | Toggle embedded terminal |
| `Cmd/Ctrl+Shift+G` | Toggle Git panel |
| `Cmd/Ctrl+Shift+H` | Revision history (current file) |
| `Cmd/Ctrl+,` | Toggle Settings |
| `Escape` | Close overlay / diff / palette / quick open, else return to `editor` page, else exit distraction-free |
| `/` in editor | Open slash menu |
| `Tab` | Indent |
| Up/Down/Enter/Esc | Navigate slash menu |

---

## Build & Distribution

### Dev
```bash
npm run dev   # Starts Vite (auto-detects port from stdout), tsc --watch, then Electron
```

### Production
```bash
npm run build      # vite build + tsc electron
npm run dist       # build + electron-builder (NSIS installer on Windows)
npm run dist:dir   # build + electron-builder --dir (unpackaged folder)
```

### electron-builder config (package.json "build" key)
- **appId:** `app.fern.editor`
- **Windows:** NSIS installer, icon `assets/icon.ico`
- **Mac:** DMG, category `public.app-category.developer-tools`, icon `assets/icon.png`
- **Linux:** AppImage, icon `assets/icon.png`
- **Output:** `release/`

---

## Known Gaps / Areas to Explore Next
- Distribution not yet tested end-to-end (electron-builder config in place, not run)
- Terminal requires native build tools (VC++ on Windows) for node-pty
- Mermaid only renders in preview pane, not in edit-only or distraction-free mode
- Editor syntax highlight compartment re-fires only when isDark prop changes — system theme changes mid-session may need a page interaction to take effect
- No mobile / responsive layout (desktop Electron app only)
- Error boundaries only cover PreviewPane segments and the app root (`main.tsx`) — Editor, Sidebar, GitPanel, SettingsPanel, etc. aren't individually wrapped, so a crash there still falls through to the coarse app-root boundary (recoverable, but loses more in-flight state than a scoped boundary would)
- `CsvEmbed`→`CsvTable` and `ApiEmbed`→`JsonTree` had prop-name mismatches (`output`/`data` vs the components' actual `csv`/`json` props) that respectively crashed the whole app (no error boundary existed yet) and silently rendered nothing; both fixed 2026-07, worth a broader audit for similar prop-name drift in less-exercised components

---

## Changelog
- **2026-07** — Fixed a white-screen crash: `CsvEmbed.tsx` passed `output={csv}` to `CsvTable`, which expects `csv`; `csv.trim()` on the resulting `undefined` threw during render with no error boundary to catch it. Also fixed `ApiEmbed.tsx` passing `data={result.data}` to `JsonTree`, which expects `json` (silently rendered nothing rather than crashing). Added `ErrorBoundary.tsx`, wrapped every Preview segment (blocks, HTTP blocks, charts, mermaid, all five embed types) individually, and wrapped the app root in `main.tsx` as a last line of defense.
- **2026-07** — Corrected stale gap claims: in-file search, workspace search, multi-file tabs, and auto-update were already implemented but listed as missing. Documented `WorkspaceSearch.tsx`, `TabBar.tsx`, `WelcomeScreen.tsx`, and the `electron-updater` flow above.
