import { app, BrowserWindow, ipcMain, dialog, shell, Menu, MenuItem } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { execSync, spawn } from 'child_process'
import * as os from 'os'
import Store from 'electron-store'
import simpleGit from 'simple-git'
import * as diffLib from 'diff'
import chokidar from 'chokidar'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Catch anything that escapes all other handlers so the main process never
// silently dies mid-session.
process.on('uncaughtException', (err) => log.error('[uncaughtException]', err))
process.on('unhandledRejection', (reason) => log.error('[unhandledRejection]', reason))

// node-pty is optional — may fail to compile without Visual C++ build tools
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nodePty: any = null
try {
  nodePty = require('node-pty')
} catch {
  console.warn('[fern] node-pty not available — terminal feature disabled')
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ptyProcess: any = null

interface FernSettings {
  vimMode?: boolean
  fontSize?: number
  lineHeight?: number
  autosaveDelay?: number
  showWordCount?: boolean
  showOutline?: boolean
  embedCacheDuration?: number // seconds: 30, 60, 300, 0 (never)
  theme?: 'light' | 'dark' | 'system'
  spellCheck?: boolean
}

interface StoreSchema {
  lastFolder?: string
  windowBounds?: { width: number; height: number; x?: number; y?: number }
  fileColors?: Record<string, string>
  pinnedFiles?: string[]
  settings?: FernSettings
  revisions?: Record<string, Array<{ ts: number; content: string }>>
  githubToken?: string
  apiEmbedTrust?: Record<string, boolean>
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', '.git', '__pycache__', '.venv', 'venv', '.next', '.nuxt', 'coverage'])

function buildFileTree(dir: string, depth = 0): FileNode[] {
  if (depth > 8) return []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (SKIP_DIRS.has(entry.name)) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, path: fullPath, type: 'folder', children: buildFileTree(fullPath, depth + 1) })
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        nodes.push({ name: entry.name, path: fullPath, type: 'file' })
      }
    }
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return nodes
  } catch { return [] }
}

const store = new Store<StoreSchema>()

let mainWindow: BrowserWindow | null = null

// ─── File watching (chokidar) ──────────────────────────────────────────────
let fileWatcher: chokidar.FSWatcher | null = null
let watchedFolder: string | null = null

// Paths that Fern itself just wrote — suppress the chokidar event so we never
// show a false "changed externally" warning for our own autosaves.
const selfWrittenPaths = new Set<string>()

function normPath(filePath: string): string {
  // Lowercase drive letter + forward-slash → backslash so Set lookups are
  // case-insensitive on Windows (chokidar and Node can disagree on case).
  return filePath.replace(/\//g, '\\').replace(/^[A-Z]:/, (d) => d.toLowerCase())
}

function markSelfWrite(filePath: string) {
  const norm = normPath(filePath)
  selfWrittenPaths.add(norm)
  // Clear after 2 seconds — well past chokidar's 300ms stabilityThreshold
  setTimeout(() => selfWrittenPaths.delete(norm), 2000)
}

// Returns true when p is safely inside base (no path traversal).
function isUnderBase(p: string, base: string): boolean {
  const rp = path.resolve(p)
  const rb = path.resolve(base)
  return rp === rb || rp.startsWith(rb + path.sep)
}

// Human-readable install hints keyed by executable name.
const INSTALL_HINTS: Record<string, string> = {
  node:    'Node.js is not installed — download it from https://nodejs.org',
  python:  'Python is not installed — download it from https://python.org',
  python3: 'Python 3 is not installed — download it from https://python.org',
  ruby:    'Ruby is not installed — download it from https://ruby-lang.org',
  go:      'Go is not installed — download it from https://go.dev',
  rustc:   'Rust is not installed — install rustup from https://rustup.rs',
  php:     'PHP is not installed — download it from https://php.net',
  deno:    'Deno is not installed — download it from https://deno.land',
  bun:     'Bun is not installed — download it from https://bun.sh',
  perl:    'Perl is not installed',
  pwsh:    'PowerShell Core (pwsh) is not installed — download it from https://github.com/PowerShell/PowerShell',
}

function startWatcher(folderPath: string, win: BrowserWindow) {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
  watchedFolder = folderPath
  fileWatcher = chokidar.watch(`${folderPath}/**/*.md`, {
    ignored: /(^|[\/\\])(\.|node_modules|dist|build|out|__pycache__|\.venv|venv|\.next|\.nuxt|coverage)/,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })
  fileWatcher.on('error', (err) => log.error('[chokidar]', err))
  fileWatcher.on('change', (p) => {
    const norm = normPath(p)
    if (selfWrittenPaths.has(norm)) return   // our own write — ignore
    win.webContents.send('file-changed-externally', p)
  })
  fileWatcher.on('add', (p) => win.webContents.send('file-added', p))
  fileWatcher.on('unlink', (p) => win.webContents.send('file-removed', p))
  fileWatcher.on('unlinkDir', (p) => win.webContents.send('folder-removed', p))
}

// ─── Auto-update (electron-updater) ────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.logger = log
  ;(autoUpdater.logger as unknown as { transports: { file: { level: string } } }).transports.file.level = 'info'
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) =>
    mainWindow?.webContents.send('update-available', { version: info.version })
  )
  autoUpdater.on('update-downloaded', (info) =>
    mainWindow?.webContents.send('update-downloaded', { version: info.version })
  )
  autoUpdater.on('error', (err) => log.error('Update error:', err))

  if (app.isPackaged) {
    setTimeout(() => { autoUpdater.checkForUpdatesAndNotify().catch((e) => log.error(e)) }, 3000)
    setInterval(() => { autoUpdater.checkForUpdatesAndNotify().catch((e) => log.error(e)) }, 4 * 60 * 60 * 1000)
  }
}

ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true))

// Map from pid -> ChildProcess for stop support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runningProcesses = new Map<number, any>()

function createWindow() {
  const bounds = store.get('windowBounds', { width: 1280, height: 800 })

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: (bounds as { x?: number }).x,
    y: (bounds as { y?: number }).y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#EDEAE4',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    frame: process.platform !== 'win32',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  if (process.platform === 'win32') {
    mainWindow.setAppDetails({
      appId: 'app.fern.editor',
      appIconPath: path.join(__dirname, '..', 'assets', 'icon.ico'),
      relaunchDisplayName: 'Fern',
    })
  }

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)
  mainWindow.on('maximize', () => mainWindow?.webContents.send('maximize-change', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('maximize-change', false))

  // Prevent in-app navigation — open http(s) links in the OS default browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Spell-check context menu
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => mainWindow!.webContents.replaceMisspelling(suggestion),
          }))
        }
        menu.append(new MenuItem({ type: 'separator' }))
      }
      menu.append(new MenuItem({
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () => mainWindow!.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }))
      menu.append(new MenuItem({ type: 'separator' }))
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo' }))
      menu.append(new MenuItem({ role: 'redo' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'cut' }))
      menu.append(new MenuItem({ role: 'copy' }))
      menu.append(new MenuItem({ role: 'paste' }))
      menu.append(new MenuItem({ role: 'selectAll' }))
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy' }))
    }
    if (menu.items.length > 0) menu.popup()
  })
}

function saveBounds() {
  if (!mainWindow) return
  const b = mainWindow.getBounds()
  store.set('windowBounds', b)
}

// Set app identity before window creation so Windows taskbar shows "Fern"
if (process.platform === 'win32') {
  app.setAppUserModelId('app.fern.editor')
}
app.name = 'Fern'

// Extract a .md file path from argv (passed when launched via "Open with Fern")
function getArgvFile(argv: string[]): string | null {
  const file = argv.find((a) => a.endsWith('.md') && fs.existsSync(a))
  return file ?? null
}

function openFileInWindow(win: BrowserWindow, filePath: string) {
  const folder = path.dirname(filePath)
  store.set('lastFolder', folder)
  startWatcher(folder, win)
  win.webContents.send('open-file-arg', { folder, filePath })
}

// Single-instance lock — focus existing window and open the file if already running
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const file = getArgvFile(argv)
      if (file) openFileInWindow(mainWindow, file)
    }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  // Start watching the last-opened folder on launch, if any
  const lastFolder = store.get('lastFolder')
  if (lastFolder && mainWindow && fs.existsSync(lastFolder)) {
    startWatcher(lastFolder, mainWindow)
  }
  setupAutoUpdater()
  // Open file passed via "Open with Fern" context menu
  const argvFile = getArgvFile(process.argv)
  if (argvFile && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      openFileInWindow(mainWindow!, argvFile)
    })
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  fileWatcher?.close()
  fileWatcher = null
})

// ─── Window Controls ─────────────────────────────────────────────────────────

ipcMain.on('minimize-window', () => mainWindow?.minimize())
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('close-window', () => mainWindow?.close())
ipcMain.handle('is-maximized', () => mainWindow?.isMaximized() ?? false)

// ─── File System ─────────────────────────────────────────────────────────────

function ensureFernDir(workspacePath: string) {
  const fernDir = path.join(workspacePath, '.fern')
  if (!fs.existsSync(fernDir)) fs.mkdirSync(fernDir, { recursive: true })
  // Append .fern to .gitignore if not already present
  const gitignorePath = path.join(workspacePath, '.gitignore')
  try {
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
    let updated = existing
    if (!existing.includes('.fern')) {
      updated = updated + (updated.endsWith('\n') ? '' : '\n') + '.fern\n'
    }
    if (updated !== existing) fs.writeFileSync(gitignorePath, updated, 'utf8')
  } catch {}
  return fernDir
}

function ensureEnvInGitignore(workspacePath: string): boolean {
  const gitignorePath = path.join(workspacePath, '.gitignore')
  try {
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
    const lines = existing.split('\n').map((l) => l.trim())
    return lines.includes('.env') || lines.includes('*.env')
  } catch {
    return true // assume covered on error
  }
}

ipcMain.handle('add-env-to-gitignore', (_event, workspacePath: string) => {
  const gitignorePath = path.join(workspacePath, '.gitignore')
  try {
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
    const updated = existing + (existing.endsWith('\n') ? '' : '\n') + '.env\n'
    fs.writeFileSync(gitignorePath, updated, 'utf8')
    return true
  } catch {
    return false
  }
})

// ─── Workspace-wide search ─────────────────────────────────────────────────
interface WorkspaceSearchMatch {
  filePath: string
  fileName: string
  relativePath: string
  lineNumber: number
  lineContent: string
}

function collectMarkdownFiles(dir: string, acc: string[]) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectMarkdownFiles(full, acc)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(full)
    }
  }
}

ipcMain.handle(
  'workspace-search',
  (_event, folderPath: string, query: string, opts: { caseSensitive: boolean; regex: boolean }) => {
    const results: WorkspaceSearchMatch[] = []
    if (!query || !folderPath) return results

    let matcher: (line: string) => boolean
    if (opts.regex) {
      let re: RegExp
      try {
        re = new RegExp(query, opts.caseSensitive ? undefined : 'i')
      } catch {
        return results // invalid regex → no matches
      }
      matcher = (line) => re.test(line)
    } else {
      const needle = opts.caseSensitive ? query : query.toLowerCase()
      matcher = (line) => (opts.caseSensitive ? line : line.toLowerCase()).includes(needle)
    }

    const files: string[] = []
    collectMarkdownFiles(folderPath, files)
    const MAX_RESULTS = 2000

    for (const filePath of files) {
      let content: string
      try {
        content = fs.readFileSync(filePath, 'utf8')
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (matcher(lines[i])) {
          results.push({
            filePath,
            fileName: path.basename(filePath),
            relativePath: path.relative(folderPath, filePath).replace(/\\/g, '/'),
            lineNumber: i + 1,
            lineContent: lines[i].length > 400 ? lines[i].slice(0, 400) : lines[i],
          })
          if (results.length >= MAX_RESULTS) return results
        }
      }
    }
    return results
  }
)

ipcMain.handle('check-env-gitignore', (_event, workspacePath: string) => {
  const envExists = fs.existsSync(path.join(workspacePath, '.env'))
  if (!envExists) return { envExists: false, inGitignore: true }
  return { envExists, inGitignore: ensureEnvInGitignore(workspacePath) }
})

ipcMain.handle('open-folder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const folderPath = result.filePaths[0]
  ensureFernDir(folderPath)
  return folderPath
})

ipcMain.handle('read-file', (_event, filePath: string) => {
  try { return fs.readFileSync(filePath, 'utf8') }
  catch (e) { throw new Error(`read-file failed: ${String(e)}`) }
})

ipcMain.handle('write-file', (_event, filePath: string, content: string) => {
  try {
    markSelfWrite(filePath)
    fs.writeFileSync(filePath, content, 'utf8')
  } catch (e) { throw new Error(`write-file failed: ${String(e)}`) }
})

ipcMain.handle('create-file', (_event, folderPath: string, fileName: string, content: string) => {
  try {
    const filePath = path.join(folderPath, fileName)
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
  } catch (e) { throw new Error(`create-file failed: ${String(e)}`) }
})

ipcMain.handle('list-files', (_event, folderPath: string) => buildFileTree(folderPath))

ipcMain.handle('create-folder', (_event, folderPath: string) => {
  try { fs.mkdirSync(folderPath, { recursive: true }) }
  catch (e) { throw new Error(`create-folder failed: ${String(e)}`) }
})

ipcMain.handle('move-file', (_event, srcPath: string, dstPath: string) => {
  try { fs.renameSync(srcPath, dstPath) }
  catch (e) { throw new Error(`move-file failed: ${String(e)}`) }

  // Migrate colors for moved file/folder
  const colors = (store.get('fileColors') ?? {}) as Record<string, string>
  const sep = srcPath.includes('\\') ? '\\' : '/'
  const prefix = srcPath + sep
  const updated: Record<string, string> = {}
  for (const [k, v] of Object.entries(colors)) {
    if (k === srcPath) {
      updated[dstPath] = v
    } else if (k.startsWith(prefix)) {
      updated[dstPath + sep + k.slice(prefix.length)] = v
    } else {
      updated[k] = v
    }
  }
  store.set('fileColors', updated)
  return dstPath
})

ipcMain.handle('get-file-colors', () => store.get('fileColors') ?? {})

ipcMain.handle('set-file-color', (_event, filePath: string, color: string | null) => {
  const colors = (store.get('fileColors') ?? {}) as Record<string, string>
  if (color) colors[filePath] = color
  else delete colors[filePath]
  store.set('fileColors', colors)
})

ipcMain.handle('rename-file', (_event, oldPath: string, newPath: string) => {
  try { fs.renameSync(oldPath, newPath) }
  catch (e) { throw new Error(`rename-file failed: ${String(e)}`) }

  // Migrate colors: remap any stored key that is oldPath or starts with oldPath + sep
  const colors = (store.get('fileColors') ?? {}) as Record<string, string>
  const sep = oldPath.includes('\\') ? '\\' : '/'
  const prefix = oldPath + sep
  const updated: Record<string, string> = {}
  for (const [k, v] of Object.entries(colors)) {
    if (k === oldPath) {
      updated[newPath] = v
    } else if (k.startsWith(prefix)) {
      updated[newPath + sep + k.slice(prefix.length)] = v
    } else {
      updated[k] = v
    }
  }
  store.set('fileColors', updated)

  return { newPath, colors: updated }
})

ipcMain.handle('delete-file', (_event, filePath: string) => {
  const workspace = store.get('lastFolder') as string | undefined
  if (workspace && !isUnderBase(filePath, workspace)) {
    throw new Error('delete-file: path is outside the current workspace')
  }
  try {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
  } catch (e) { throw new Error(`delete-file failed: ${String(e)}`) }
})

ipcMain.handle('show-in-folder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// ─── Execution ────────────────────────────────────────────────────────────────

// Plain 'bash' on PATH is unreliable on Windows: many machines have a WSL
// launcher stub at %LOCALAPPDATA%\Microsoft\WindowsApps\bash.exe that some
// PATH-resolution APIs prefer over Git for Windows' real bash.exe. The WSL
// stub fails immediately if no distro is configured, and even when one is,
// it can't see Windows temp-file paths without /mnt/c/ translation. Instead,
// derive Git Bash's real location from wherever git.exe itself resolves —
// git is already a hard requirement for Fern's git panel, so this doesn't
// add a new dependency, and it works on any machine regardless of exactly
// where Git for Windows was installed.
let cachedWindowsBash: string | null = null
function findWindowsBash(): string {
  if (cachedWindowsBash) return cachedWindowsBash

  try {
    // `where` can print multiple matches (Git for Windows commonly
    // registers both <GitRoot>\cmd\git.exe and <GitRoot>\mingw64\bin\git.exe
    // on PATH) — those two are at different depths below GitRoot, so rather
    // than assume a fixed number of ".." hops from any one of them, walk up
    // a few levels from *every* match and test each level.
    const gitPaths = execSync('where git', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    for (const gitPath of gitPaths) {
      let dir = path.dirname(gitPath)
      for (let i = 0; i < 3; i++) {
        dir = path.dirname(dir)
        const candidates = [
          path.join(dir, 'bin', 'bash.exe'),
          path.join(dir, 'usr', 'bin', 'bash.exe'),
        ]
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            cachedWindowsBash = candidate
            return candidate
          }
        }
      }
    }
  } catch {
    // git not on PATH, or `where` failed — fall through to fixed locations
  }

  const fixedCandidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ]
  for (const candidate of fixedCandidates) {
    if (fs.existsSync(candidate)) {
      cachedWindowsBash = candidate
      return candidate
    }
  }

  // Last resort: bare PATH lookup, which may hit the WSL stub.
  cachedWindowsBash = 'bash'
  return cachedWindowsBash
}

function getRuntimeArgs(
  runtime: string,
  code: string
): { cmd: string; args: string[]; tmpFile: string | null } {
  const isWin = process.platform === 'win32'

  switch (runtime.toLowerCase()) {
    case 'bash':
    case 'sh': {
      // Always run bash/sh through a real bash interpreter, even on Windows
      // (Git for Windows ships bash.exe on PATH). PowerShell doesn't support
      // bash-specific syntax (export, $(), grep, C-style for loops) and its
      // default error handling doesn't propagate non-zero exit codes.
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.sh`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      const cmd = isWin ? findWindowsBash() : '/bin/bash'
      return { cmd, args: [tmpFile], tmpFile }
    }
    case 'powershell':
    case 'pwsh': {
      const cmd = isWin ? 'powershell' : 'pwsh'
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.ps1`)
      // $ErrorActionPreference = Stop turns a failed/unrecognized command
      // into a terminating error, and the explicit catch/exit ensures
      // powershell.exe itself returns a non-zero exit code — without this,
      // PowerShell logs errors to stderr but still exits 0, so Run All
      // (and the block's own success/error status) silently ignores them.
      const wrapped = `$ErrorActionPreference = 'Stop'\ntry {\n${code}\n} catch {\n  Write-Error $_\n  exit 1\n}\n`
      fs.writeFileSync(tmpFile, wrapped, 'utf8')
      return { cmd, args: ['-NonInteractive', '-File', tmpFile], tmpFile }
    }
    case 'javascript':
    case 'js':
    case 'node': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.js`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'node', args: [tmpFile], tmpFile }
    }
    case 'typescript':
    case 'ts': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.ts`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      // Node 22.6+ (stable by 24) runs .ts files directly, stripping type
      // annotations rather than fully type-checking. No package, no shell.
      // Known limitation: doesn't support constructor parameter properties,
      // enums, or namespaces.
      return { cmd: 'node', args: [tmpFile], tmpFile }
    }
    case 'python':
    case 'python3': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.py`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      const cmd = isWin ? 'python' : 'python3'
      return { cmd, args: [tmpFile], tmpFile }
    }
    case 'ruby':
    case 'rb': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.rb`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'ruby', args: [tmpFile], tmpFile }
    }
    case 'go': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.go`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'go', args: ['run', tmpFile], tmpFile }
    }
    case 'deno': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.ts`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'deno', args: ['run', '--allow-all', tmpFile], tmpFile }
    }
    case 'php': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.php`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'php', args: [tmpFile], tmpFile }
    }
    case 'perl': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.pl`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      return { cmd: 'perl', args: [tmpFile], tmpFile }
    }
    case 'rust':
    case 'rs': {
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.rs`)
      const outFile = path.join(os.tmpdir(), `fern-${Date.now()}${isWin ? '.exe' : '_bin'}`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      // Quote both paths so usernames/dirs with spaces don't break the shell command.
      const cmd = isWin ? 'cmd' : '/bin/bash'
      const args = isWin
        ? ['/c', `rustc "${tmpFile}" -o "${outFile}" && "${outFile}"`]
        : ['-c', `rustc "${tmpFile}" -o "${outFile}" && "${outFile}"; rm -f "${outFile}"`]
      return { cmd, args, tmpFile }
    }
    default: {
      // Unrecognized language tag — fall back to real bash (same as the
      // explicit bash/sh case above) rather than silently substituting
      // PowerShell, which doesn't understand bash syntax.
      const tmpFile = path.join(os.tmpdir(), `fern-${Date.now()}.sh`)
      fs.writeFileSync(tmpFile, code, 'utf8')
      const cmd = isWin ? findWindowsBash() : '/bin/bash'
      return { cmd, args: [tmpFile], tmpFile }
    }
  }
}

ipcMain.handle(
  'run-block',
  (
    _event,
    {
      blockId,
      code,
      runtime,
      cwd,
      env,
    }: {
      blockId: string
      code: string
      runtime: string
      cwd: string
      env: Record<string, string>
    }
  ): Promise<{ exitCode: number | null; duration: number; pid: number }> => {
    return new Promise((resolve) => {
      const start = Date.now()
      const { cmd, args, tmpFile } = getRuntimeArgs(runtime, code)
      const mergedEnv = { ...process.env, ...env } as Record<string, string>

      const child = spawn(cmd, args, { cwd, env: mergedEnv, shell: false })
      const pid = child.pid ?? -1

      if (child.pid) runningProcesses.set(child.pid, child)

      function decodeChunk(data: Buffer): string {
        if (data.length >= 4 && data[1] === 0 && data[3] === 0) {
          return data.toString('utf16le')
        }
        return data.toString('utf8')
      }

      child.stdout.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('block-output', {
          blockId,
          pid,
          chunk: decodeChunk(data),
          stream: 'stdout',
        })
      })

      child.stderr.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('block-output', {
          blockId,
          pid,
          chunk: decodeChunk(data),
          stream: 'stderr',
        })
      })

      let settled = false
      let closeTimeout: NodeJS.Timeout | null = null

      function settle(exitCode: number | null) {
        if (settled) return
        settled = true
        if (closeTimeout) clearTimeout(closeTimeout)
        clearTimeout(hardTimeout)
        if (child.pid) runningProcesses.delete(child.pid)
        if (tmpFile) { try { fs.unlinkSync(tmpFile) } catch {} }
        resolve({ exitCode, duration: Date.now() - start, pid })
      }

      // Absolute safety net: whatever the reason (a genuinely long-running
      // network call, a runtime waiting on stdin it'll never get, an
      // infinite loop in the code itself), a single stuck block must never
      // be able to freeze the rest of Run All forever. 90s comfortably
      // covers everything in this showcase (including a first-time
      // `npx ts-node` fetch) while still guaranteeing forward progress.
      const hardTimeout = setTimeout(() => {
        if (settled) return
        mainWindow?.webContents.send('block-output', {
          blockId,
          pid,
          chunk: '\nTimed out after 90s — the process was still running and has been stopped.\n',
          stream: 'stderr',
        })
        killProcessTree(child.pid)
        settle(1)
      }, 90_000)

      child.on('error', (err: NodeJS.ErrnoException) => {
        const hint = err.code === 'ENOENT'
          ? (INSTALL_HINTS[cmd] ?? `"${cmd}" is not installed or not in PATH`)
          : `Error starting process: ${err.message}`
        mainWindow?.webContents.send('block-output', {
          blockId,
          pid,
          chunk: `${hint}\n`,
          stream: 'stderr',
        })
        settle(1)
      })

      // 'close' fires once stdio is fully flushed, so it's the preferred
      // signal — but some shells (Git Bash/MSYS2 on Windows in particular)
      // can leave a subprocess holding the stdout/stderr pipes open even
      // after the main process has already exited, so 'close' never fires
      // and the block hangs forever, freezing the rest of Run All behind
      // it. 'exit' fires as soon as the process itself terminates; give
      // 'close' a brief grace period after that to capture any trailing
      // output, then resolve anyway using the exit code we already have.
      child.on('exit', (exitCode) => {
        closeTimeout = setTimeout(() => settle(exitCode), 1500)
      })

      child.on('close', (exitCode) => {
        settle(exitCode)
      })
    })
  }
)

// Kill the process and all its children (shell wrappers don't propagate SIGTERM).
function killProcessTree(pid: number | undefined) {
  if (!pid) return
  if (process.platform === 'win32') {
    try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }) } catch {}
  } else {
    // Send to the entire process group if we can; fall back to direct kill.
    try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch {} }
  }
}

ipcMain.handle('stop-block', (_event, pid: number) => {
  const child = runningProcesses.get(pid)
  if (child) {
    killProcessTree(child.pid)
    runningProcesses.delete(pid)
  }
})

// ─── Git (simple-git) ─────────────────────────────────────────────────────────

ipcMain.handle('get-git-branch', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return null
    const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
    return branch.trim() || null
  } catch {
    return null
  }
})

ipcMain.handle('git-status', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return { isRepo: false, files: [], branch: null, ahead: 0, behind: 0 }
    const [status, gitRoot] = await Promise.all([
      git.status(),
      git.revparse(['--show-toplevel']).catch(() => cwd),
    ])
    const files = status.files.map((f) => ({
      path: f.path,
      index: f.index,
      working_dir: f.working_dir,
    }))
    let ahead = 0
    let behind = 0
    try {
      ahead = status.ahead
      behind = status.behind
    } catch {}
    return { isRepo: true, files, branch: status.current, ahead, behind, gitRoot: gitRoot.trim() }
  } catch (e) {
    return { isRepo: false, files: [], branch: null, ahead: 0, behind: 0, error: String(e) }
  }
})

ipcMain.handle('git-commit', async (_event, cwd: string, message: string) => {
  try {
    const git = simpleGit(cwd)
    await git.add('-A')
    const result = await git.commit(message)
    return { success: true, result }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('git-push', async (_event, cwd: string, setUpstream: boolean) => {
  try {
    const git = simpleGit(cwd)
    if (setUpstream) {
      const status = await git.status()
      const branch = status.current ?? 'main'
      await git.push(['--set-upstream', 'origin', branch])
    } else {
      await git.push()
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('git-pull', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    await git.pull()
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('git-init', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    await git.init()
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('git-diff-file', async (_event, cwd: string, filePath: string) => {
  try {
    const git = simpleGit(cwd)
    // Get the relative path from workspace root
    const relPath = path.relative(cwd, filePath).replace(/\\/g, '/')
    // Get HEAD version
    let headContent = ''
    try {
      headContent = await git.show([`HEAD:${relPath}`])
    } catch {
      // File is new (untracked) — HEAD content is empty
      headContent = ''
    }
    const currentContent = fs.readFileSync(filePath, 'utf8')
    // Compute diff
    const hunks = diffLib.diffLines(headContent, currentContent)
    return { success: true, hunks, headContent, currentContent }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('git-get-remotes', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    const remotes = await git.getRemotes(true)
    return remotes
  } catch {
    return []
  }
})

ipcMain.handle('git-has-upstream', async (_event, cwd: string) => {
  try {
    const git = simpleGit(cwd)
    const status = await git.status()
    return { hasUpstream: !!status.tracking }
  } catch {
    return { hasUpstream: false }
  }
})

ipcMain.handle('git-log', async (_event, cwd: string) => {
  if (!cwd) return { success: false, error: 'No workspace path', commits: [] }
  try {
    const git = simpleGit(cwd)
    const log = await git.log({ maxCount: 50 })
    return {
      success: true,
      commits: log.all.map((c) => ({
        hash: c.hash,
        shortHash: c.hash.slice(0, 7),
        message: c.message,
        author: c.author_name,
        date: c.date,
      })),
    }
  } catch (e) {
    return { success: false, error: String(e), commits: [] }
  }
})

ipcMain.handle('git-show', async (_event, cwd: string, hash: string) => {
  if (!cwd || !hash) return { success: false, error: 'Missing args', diff: '' }
  try {
    const git = simpleGit(cwd)
    const diff = await git.show([hash])
    return { success: true, diff }
  } catch (e) {
    return { success: false, error: String(e), diff: '' }
  }
})

ipcMain.handle('copy-file', async (_event, src: string, dest: string) => {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.copyFile(src, dest)
})

// ─── File Embeds ─────────────────────────────────────────────────────────────

ipcMain.handle('read-workspace-file', (_event, workspacePath: string, relPath: string) => {
  try {
    const fullPath = path.resolve(workspacePath, relPath.trim())
    // Reject path traversal attempts
    if (!isUnderBase(fullPath, workspacePath)) {
      return { success: false, error: 'Access denied: path is outside the workspace' }
    }
    if (!fs.existsSync(fullPath)) return { success: false, error: `File not found: ${relPath}` }
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n').length
    return { success: true, content, lines, ext: path.extname(fullPath).toLowerCase() }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── API Embeds ──────────────────────────────────────────────────────────────

// In-memory cache: url -> { data, ts, status } — capped to avoid unbounded growth
const API_EMBED_CACHE_MAX = 100
const apiEmbedCache = new Map<string, { data: unknown; ts: number; status: number }>()

// Block private/loopback addresses from api-embed-fetch to prevent SSRF.
function isPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true
    const h = u.hostname.toLowerCase()
    return (
      h === 'localhost' ||
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('172.') ||
      h === '::1' ||
      h === '0.0.0.0' ||
      h.endsWith('.local') ||
      h === '169.254.169.254' // cloud metadata
    )
  } catch { return true }
}

ipcMain.handle('api-embed-fetch', async (_event, method: string, url: string, cacheDuration: number) => {
  if (isPrivateUrl(url)) {
    return { success: false, error: 'Requests to private/internal addresses are not allowed' }
  }
  const now = Date.now()
  const cached = apiEmbedCache.get(url)
  if (cached && cacheDuration > 0 && (now - cached.ts) < cacheDuration * 1000) {
    return { success: true, data: cached.data, status: cached.status, fromCache: true }
  }
  try {
    // Use dynamic import of node-fetch or built-in fetch (Electron 22+ has fetch)
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
    })
    let data: unknown
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      data = await res.json()
    } else {
      data = await res.text()
    }
    if (apiEmbedCache.size >= API_EMBED_CACHE_MAX) {
      // Evict oldest entry
      apiEmbedCache.delete(apiEmbedCache.keys().next().value!)
    }
    apiEmbedCache.set(url, { data, ts: now, status: res.status })
    return { success: true, data, status: res.status, fromCache: false }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('api-embed-invalidate', (_event, url: string) => {
  apiEmbedCache.delete(url)
})

// ─── API Embed Trust ─────────────────────────────────────────────────────────

ipcMain.handle('get-api-trust', (_event, workspacePath: string) => {
  const trust = (store.get('apiEmbedTrust') ?? {}) as Record<string, boolean>
  return trust[workspacePath] ?? null
})

ipcMain.handle('set-api-trust', (_event, workspacePath: string, trusted: boolean) => {
  const trust = (store.get('apiEmbedTrust') ?? {}) as Record<string, boolean>
  trust[workspacePath] = trusted
  store.set('apiEmbedTrust', trust)
})

// ─── GitHub Integration ──────────────────────────────────────────────────────

ipcMain.handle('get-github-token', () => store.get('githubToken') ?? null)

ipcMain.handle('set-github-token', (_event, token: string | null) => {
  if (token) store.set('githubToken', token)
  else store.delete('githubToken')
})

ipcMain.handle('github-whoami', async () => {
  const token = store.get('githubToken')
  if (!token) return { success: false, error: 'No token' }
  try {
    const { Octokit } = await import('@octokit/rest')
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.users.getAuthenticated()
    return { success: true, login: data.login, name: data.name, avatar: data.avatar_url }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// Parse GitHub remote URL to owner/repo
function parseGitHubOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  // ssh: git@github.com:owner/repo.git or https: https://github.com/owner/repo.git
  const sshMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }
  return null
}

// Cache for github issues: key -> { data, ts } — capped to avoid unbounded growth
const ISSUES_CACHE_MAX = 50
const issuesCache = new Map<string, { data: unknown[]; ts: number }>()

ipcMain.handle('github-list-issues', async (_event, cwd: string, filter: string, cacheDuration: number) => {
  const token = store.get('githubToken')
  if (!token) return { success: false, error: 'No GitHub token — connect in Settings' }

  // Get remote URL
  let ownerRepo: { owner: string; repo: string } | null = null
  try {
    const git = simpleGit(cwd)
    const remotes = await git.getRemotes(true)
    const origin = remotes.find((r) => r.name === 'origin')
    if (origin?.refs?.fetch) {
      ownerRepo = parseGitHubOwnerRepo(origin.refs.fetch)
    }
  } catch {}

  if (!ownerRepo) return { success: false, error: 'No GitHub repository detected for this workspace' }

  const cacheKey = `${ownerRepo.owner}/${ownerRepo.repo}:${filter}`
  const now = Date.now()
  const cached = issuesCache.get(cacheKey)
  if (cached && cacheDuration > 0 && (now - cached.ts) < cacheDuration * 1000) {
    return { success: true, issues: cached.data, fromCache: true, ...ownerRepo }
  }

  try {
    const { Octokit } = await import('@octokit/rest')
    const octokit = new Octokit({ auth: token })

    // Parse filter: "open label:bug assignee:lewis"
    const parts = filter.trim().split(/\s+/)
    const state = (parts[0] === 'closed' ? 'closed' : 'open') as 'open' | 'closed'
    let labels: string | undefined
    let assignee: string | undefined
    for (const part of parts.slice(1)) {
      if (part.startsWith('label:')) labels = part.slice(6)
      if (part.startsWith('assignee:')) assignee = part.slice(9)
    }

    const { data } = await octokit.issues.listForRepo({
      owner: ownerRepo.owner,
      repo: ownerRepo.repo,
      state,
      labels,
      assignee,
      per_page: 20,
    })

    const issues = data.map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      state: i.state,
    }))

    if (issuesCache.size >= ISSUES_CACHE_MAX) {
      issuesCache.delete(issuesCache.keys().next().value!)
    }
    issuesCache.set(cacheKey, { data: issues, ts: now })
    return { success: true, issues, fromCache: false, ...ownerRepo }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── .env Reading ────────────────────────────────────────────────────────────

ipcMain.handle('read-env-file', (_event, workspacePath: string) => {
  const envPath = path.join(workspacePath, '.env')
  if (!fs.existsSync(envPath)) return {}
  try {
    const raw = fs.readFileSync(envPath, 'utf8')
    // Simple dotenv parser (no exec, no eval)
    const result: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      result[key] = val
    }
    return result
  } catch {
    return {}
  }
})

// ─── Runtime versions ─────────────────────────────────────────────────────────

function tryVersion(cmd: string, args: string[], stripRe?: RegExp): string | null {
  try {
    const out = execSync(`${cmd} ${args.join(' ')}`, {
      encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (!out) return null
    const line = out.split('\n')[0]
    if (stripRe) return line.replace(stripRe, '').trim() || null
    return line
  } catch {
    return null
  }
}

ipcMain.handle('get-runtime-versions', () => {
  const isWin = process.platform === 'win32'

  const node    = tryVersion('node', ['-v'], /^v/)
  const python  = isWin
    ? tryVersion('python', ['--version'], /^Python\s*/i)
    : tryVersion('python3', ['--version'], /^Python\s*/i)
  const ruby    = tryVersion('ruby', ['--version'], /^ruby\s*/i)?.split(' ')[0] ?? null
  const go      = tryVersion('go', ['version'])?.replace(/^go version go/, '').split(' ')[0] ?? null
  const rust    = tryVersion('cargo', ['--version'], /^cargo\s*/i)?.split(' ')[0] ?? null
  const php     = tryVersion('php', ['--version'])?.split('\n')[0]?.replace(/^PHP\s*/i, '').split(' ')[0] ?? null
  const deno    = tryVersion('deno', ['--version'])?.split('\n')[0]?.replace(/^deno\s*/i, '').trim() ?? null
  const bun     = tryVersion('bun', ['--version'])

  return { node, python, ruby, go, rust, php, deno, bun }
})

// ─── Config ───────────────────────────────────────────────────────────────────

ipcMain.handle('get-last-folder', () => store.get('lastFolder') ?? null)

ipcMain.handle('set-last-folder', (_event, folderPath: string) => {
  store.set('lastFolder', folderPath)
  if (mainWindow && folderPath && folderPath !== watchedFolder) {
    startWatcher(folderPath, mainWindow)
  }
})

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: FernSettings = {
  vimMode: false,
  fontSize: 15,
  lineHeight: 1.7,
  autosaveDelay: 800,
  showWordCount: true,
  showOutline: true,
  embedCacheDuration: 30,
  theme: 'system',
  spellCheck: true,
}

ipcMain.handle('get-settings', () => ({ ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}) }))

ipcMain.handle('set-settings', (_event, patch: Partial<FernSettings>) => {
  const current = { ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}) }
  const updated = { ...current, ...patch }
  store.set('settings', updated)
  return updated
})

// ─── Pinned Files ─────────────────────────────────────────────────────────────

ipcMain.handle('get-pinned-files', () => store.get('pinnedFiles') ?? [])

ipcMain.handle('set-pinned-files', (_event, paths: string[]) => {
  store.set('pinnedFiles', paths)
})

// ─── Revision History ─────────────────────────────────────────────────────────

const MAX_REVISIONS = 50

ipcMain.handle('get-revisions', (_event, filePath: string) => {
  const all = (store.get('revisions') ?? {}) as Record<string, Array<{ ts: number; content: string }>>
  return all[filePath] ?? []
})

ipcMain.handle('save-revision', (_event, filePath: string, content: string) => {
  const all = (store.get('revisions') ?? {}) as Record<string, Array<{ ts: number; content: string }>>
  const list = all[filePath] ?? []
  list.unshift({ ts: Date.now(), content })
  all[filePath] = list.slice(0, MAX_REVISIONS)
  store.set('revisions', all)
})

ipcMain.handle('delete-revisions', (_event, filePath: string) => {
  const all = (store.get('revisions') ?? {}) as Record<string, Array<{ ts: number; content: string }>>
  delete all[filePath]
  store.set('revisions', all)
})

// ─── Pinned Output Snapshots ──────────────────────────────────────────────────

function snapshotsPath(workspacePath: string) {
  ensureFernDir(workspacePath)
  return path.join(workspacePath, '.fern', 'snapshots.json')
}

function readSnapshots(workspacePath: string): Record<string, Record<string, { output: string; pinnedAt: number }>> {
  const p = snapshotsPath(workspacePath)
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {}
  return {}
}

function writeSnapshots(workspacePath: string, data: Record<string, Record<string, { output: string; pinnedAt: number }>>) {
  fs.writeFileSync(snapshotsPath(workspacePath), JSON.stringify(data, null, 2), 'utf8')
}

ipcMain.handle('get-snapshots', (_event, workspacePath: string) => readSnapshots(workspacePath))

ipcMain.handle('set-snapshot', (_event, workspacePath: string, docPath: string, blockKey: string, output: string, pinnedAt: number) => {
  const data = readSnapshots(workspacePath)
  if (!data[docPath]) data[docPath] = {}
  data[docPath][blockKey] = { output, pinnedAt }
  writeSnapshots(workspacePath, data)
})

ipcMain.handle('clear-snapshot', (_event, workspacePath: string, docPath: string, blockKey: string) => {
  const data = readSnapshots(workspacePath)
  if (data[docPath]) {
    delete data[docPath][blockKey]
    if (Object.keys(data[docPath]).length === 0) delete data[docPath]
  }
  writeSnapshots(workspacePath, data)
})

// ─── Terminal (node-pty) ──────────────────────────────────────────────────────

ipcMain.handle('create-terminal', (_event, cwd: string, env: Record<string, string>) => {
  if (!nodePty) {
    return { success: false, error: 'node-pty not available — run: npx electron-rebuild -f -w node-pty' }
  }
  try {
    if (ptyProcess) { try { ptyProcess.kill() } catch {} }
    const shellExe = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
    ptyProcess = nodePty.spawn(shellExe, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, ...env },
    })
    ptyProcess.onData((data: string) => {
      mainWindow?.webContents.send('terminal:output', data)
    })
    ptyProcess.onExit(() => {
      ptyProcess = null
      mainWindow?.webContents.send('terminal:output', '\r\n[Process exited]\r\n')
    })
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
})

ipcMain.handle('terminal-input', (_event, data: string) => {
  ptyProcess?.write(data)
})

ipcMain.handle('terminal-resize', (_event, cols: number, rows: number) => {
  try { ptyProcess?.resize(cols, rows) } catch {}
})

ipcMain.handle('terminal-close', () => {
  try { ptyProcess?.kill() } catch {}
  ptyProcess = null
})

// Open external URL in default browser — only allow http/https to prevent
// file:, ms-msdt:, smb:, and other dangerous protocol-handler exploits.
ipcMain.handle('open-external', (_event, url: string) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    log.warn('[open-external] blocked non-http URL:', url)
    return
  }
  shell.openExternal(url)
})
