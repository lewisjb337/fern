import { contextBridge, ipcRenderer } from 'electron'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

export interface FernSettings {
  vimMode: boolean
  fontSize: number
  lineHeight: number
  autosaveDelay: number
  showWordCount: boolean
  showOutline: boolean
  embedCacheDuration: number
  theme: 'light' | 'dark' | 'system'
  spellCheck: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
}

export interface FernRevision {
  ts: number
  content: string
}

export interface GitFile {
  path: string
  index: string
  working_dir: string
}

export interface GitStatus {
  isRepo: boolean
  files: GitFile[]
  branch: string | null
  ahead: number
  behind: number
  error?: string
}

export interface DiffHunk {
  value: string
  added?: boolean
  removed?: boolean
}

export interface GitHubIssue {
  number: number
  title: string
  url: string
  state: string
}

export interface FernAPI {
  openFolder: () => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<void>
  listFiles: (folderPath: string) => Promise<FileNode[]>
  createFile: (folderPath: string, fileName: string, content: string) => Promise<string>
  createFolder: (folderPath: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<{ newPath: string; colors: Record<string, string> }>
  deleteFile: (filePath: string) => Promise<void>
  moveFile: (srcPath: string, dstPath: string) => Promise<string>
  showInFolder: (filePath: string) => Promise<void>
  getFileColors: () => Promise<Record<string, string>>
  setFileColor: (filePath: string, color: string | null) => Promise<void>
  runBlock: (
    blockId: string,
    code: string,
    runtime: string,
    cwd: string,
    env: Record<string, string>
  ) => Promise<{ exitCode: number | null; duration: number; pid: number }>
  stopBlock: (pid: number) => Promise<void>
  onOutput: (
    callback: (data: {
      blockId: string
      pid: number
      chunk: string
      stream: 'stdout' | 'stderr'
    }) => void
  ) => () => void
  getGitBranch: (cwd: string) => Promise<string | null>
  getRuntimeVersions: () => Promise<Record<string, string | null>>
  getLastFolder: () => Promise<string | null>
  setLastFolder: (folderPath: string) => Promise<void>
  // Settings
  getSettings: () => Promise<FernSettings>
  setSettings: (patch: Partial<FernSettings>) => Promise<FernSettings>
  // Pinned files
  getPinnedFiles: () => Promise<string[]>
  setPinnedFiles: (paths: string[]) => Promise<void>
  // Revision history
  getRevisions: (filePath: string) => Promise<FernRevision[]>
  saveRevision: (filePath: string, content: string) => Promise<void>
  deleteRevisions: (filePath: string) => Promise<void>
  // Snapshots
  getSnapshots: (workspacePath: string) => Promise<Record<string, Record<string, { output: string; pinnedAt: number }>>>
  setSnapshot: (workspacePath: string, docPath: string, blockKey: string, output: string, pinnedAt: number) => Promise<void>
  clearSnapshot: (workspacePath: string, docPath: string, blockKey: string) => Promise<void>
  // Terminal
  createTerminal: (cwd: string, env: Record<string, string>) => Promise<{ success: boolean; error?: string }>
  terminalInput: (data: string) => Promise<void>
  terminalResize: (cols: number, rows: number) => Promise<void>
  closeTerminal: () => Promise<void>
  onTerminalOutput: (callback: (data: string) => void) => () => void
  // Git (simple-git)
  gitStatus: (cwd: string) => Promise<GitStatus>
  gitCommit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>
  gitPush: (cwd: string, setUpstream: boolean) => Promise<{ success: boolean; error?: string }>
  gitPull: (cwd: string) => Promise<{ success: boolean; error?: string }>
  gitInit: (cwd: string) => Promise<{ success: boolean; error?: string }>
  gitDiffFile: (cwd: string, filePath: string) => Promise<{ success: boolean; hunks?: DiffHunk[]; headContent?: string; currentContent?: string; error?: string }>
  gitGetRemotes: (cwd: string) => Promise<Array<{ name: string; refs: { fetch: string; push: string } }>>
  gitHasUpstream: (cwd: string) => Promise<{ hasUpstream: boolean }>
  gitLog: (cwd: string) => Promise<GitCommit[]>
  gitShow: (cwd: string, hash: string) => Promise<string>
  copyFile: (src: string, dest: string) => Promise<void>
  // File embeds
  readWorkspaceFile: (workspacePath: string, relPath: string) => Promise<{ success: boolean; content?: string; lines?: number; ext?: string; error?: string }>
  // API embeds
  apiEmbedFetch: (method: string, url: string, cacheDuration: number) => Promise<{ success: boolean; data?: unknown; status?: number; fromCache?: boolean; error?: string }>
  apiEmbedInvalidate: (url: string) => Promise<void>
  getApiTrust: (workspacePath: string) => Promise<boolean | null>
  setApiTrust: (workspacePath: string, trusted: boolean) => Promise<void>
  // GitHub
  getGithubToken: () => Promise<string | null>
  setGithubToken: (token: string | null) => Promise<void>
  githubWhoami: () => Promise<{ success: boolean; login?: string; name?: string; avatar?: string; error?: string }>
  githubListIssues: (cwd: string, filter: string, cacheDuration: number) => Promise<{ success: boolean; issues?: GitHubIssue[]; fromCache?: boolean; owner?: string; repo?: string; error?: string }>
  // .env
  readEnvFile: (workspacePath: string) => Promise<Record<string, string>>
  checkEnvGitignore: (workspacePath: string) => Promise<{ envExists: boolean; inGitignore: boolean }>
  addEnvToGitignore: (workspacePath: string) => Promise<boolean>
  // Shell
  openExternal: (url: string) => Promise<void>
  // File watching
  onFileChangedExternally: (cb: (path: string) => void) => () => void
  onFileAdded: (cb: (path: string) => void) => () => void
  onFileRemoved: (cb: (path: string) => void) => () => void
  onFolderRemoved: (cb: (path: string) => void) => () => void
  // Workspace search
  workspaceSearch: (
    folderPath: string,
    query: string,
    opts: { caseSensitive: boolean; regex: boolean }
  ) => Promise<WorkspaceSearchMatch[]>
  // Auto-update
  onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void
  installUpdate: () => Promise<void>
  // Window controls (Windows frameless)
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void
}

export interface WorkspaceSearchMatch {
  filePath: string
  fileName: string
  relativePath: string
  lineNumber: number
  lineContent: string
}

const fernAPI: FernAPI = {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listFiles: (folderPath) => ipcRenderer.invoke('list-files', folderPath),
  createFile: (folderPath, fileName, content) =>
    ipcRenderer.invoke('create-file', folderPath, fileName, content),
  createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  moveFile: (srcPath, dstPath) => ipcRenderer.invoke('move-file', srcPath, dstPath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  getFileColors: () => ipcRenderer.invoke('get-file-colors'),
  setFileColor: (filePath, color) => ipcRenderer.invoke('set-file-color', filePath, color),
  runBlock: (blockId, code, runtime, cwd, env) =>
    ipcRenderer.invoke('run-block', { blockId, code, runtime, cwd, env }),
  stopBlock: (pid) => ipcRenderer.invoke('stop-block', pid),
  onOutput: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: Parameters<typeof callback>[0]) =>
      callback(data)
    ipcRenderer.on('block-output', handler)
    return () => ipcRenderer.removeListener('block-output', handler)
  },
  getGitBranch: (cwd) => ipcRenderer.invoke('get-git-branch', cwd),
  getRuntimeVersions: () => ipcRenderer.invoke('get-runtime-versions'),
  getLastFolder: () => ipcRenderer.invoke('get-last-folder'),
  setLastFolder: (folderPath) => ipcRenderer.invoke('set-last-folder', folderPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
  getPinnedFiles: () => ipcRenderer.invoke('get-pinned-files'),
  setPinnedFiles: (paths) => ipcRenderer.invoke('set-pinned-files', paths),
  getRevisions: (filePath) => ipcRenderer.invoke('get-revisions', filePath),
  saveRevision: (filePath, content) => ipcRenderer.invoke('save-revision', filePath, content),
  deleteRevisions: (filePath) => ipcRenderer.invoke('delete-revisions', filePath),
  getSnapshots: (workspacePath) => ipcRenderer.invoke('get-snapshots', workspacePath),
  setSnapshot: (workspacePath, docPath, blockKey, output, pinnedAt) =>
    ipcRenderer.invoke('set-snapshot', workspacePath, docPath, blockKey, output, pinnedAt),
  clearSnapshot: (workspacePath, docPath, blockKey) =>
    ipcRenderer.invoke('clear-snapshot', workspacePath, docPath, blockKey),
  createTerminal: (cwd, env) => ipcRenderer.invoke('create-terminal', cwd, env),
  terminalInput: (data) => ipcRenderer.invoke('terminal-input', data),
  terminalResize: (cols, rows) => ipcRenderer.invoke('terminal-resize', cols, rows),
  closeTerminal: () => ipcRenderer.invoke('terminal-close'),
  onTerminalOutput: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on('terminal:output', handler)
    return () => ipcRenderer.removeListener('terminal:output', handler)
  },
  // Git
  gitStatus: (cwd) => ipcRenderer.invoke('git-status', cwd),
  gitCommit: (cwd, message) => ipcRenderer.invoke('git-commit', cwd, message),
  gitPush: (cwd, setUpstream) => ipcRenderer.invoke('git-push', cwd, setUpstream),
  gitPull: (cwd) => ipcRenderer.invoke('git-pull', cwd),
  gitInit: (cwd) => ipcRenderer.invoke('git-init', cwd),
  gitDiffFile: (cwd, filePath) => ipcRenderer.invoke('git-diff-file', cwd, filePath),
  gitGetRemotes: (cwd) => ipcRenderer.invoke('git-get-remotes', cwd),
  gitHasUpstream: (cwd) => ipcRenderer.invoke('git-has-upstream', cwd),
  gitLog: (cwd) => ipcRenderer.invoke('git-log', cwd),
  gitShow: (cwd, hash) => ipcRenderer.invoke('git-show', cwd, hash),
  copyFile: (src, dest) => ipcRenderer.invoke('copy-file', src, dest),
  // File embeds
  readWorkspaceFile: (workspacePath, relPath) => ipcRenderer.invoke('read-workspace-file', workspacePath, relPath),
  // API embeds
  apiEmbedFetch: (method, url, cacheDuration) => ipcRenderer.invoke('api-embed-fetch', method, url, cacheDuration),
  apiEmbedInvalidate: (url) => ipcRenderer.invoke('api-embed-invalidate', url),
  getApiTrust: (workspacePath) => ipcRenderer.invoke('get-api-trust', workspacePath),
  setApiTrust: (workspacePath, trusted) => ipcRenderer.invoke('set-api-trust', workspacePath, trusted),
  // GitHub
  getGithubToken: () => ipcRenderer.invoke('get-github-token'),
  setGithubToken: (token) => ipcRenderer.invoke('set-github-token', token),
  githubWhoami: () => ipcRenderer.invoke('github-whoami'),
  githubListIssues: (cwd, filter, cacheDuration) => ipcRenderer.invoke('github-list-issues', cwd, filter, cacheDuration),
  // .env
  readEnvFile: (workspacePath) => ipcRenderer.invoke('read-env-file', workspacePath),
  checkEnvGitignore: (workspacePath) => ipcRenderer.invoke('check-env-gitignore', workspacePath),
  addEnvToGitignore: (workspacePath) => ipcRenderer.invoke('add-env-to-gitignore', workspacePath),
  // Shell
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // File watching
  onFileChangedExternally: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('file-changed-externally', handler)
    return () => ipcRenderer.removeListener('file-changed-externally', handler)
  },
  onFileAdded: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('file-added', handler)
    return () => ipcRenderer.removeListener('file-added', handler)
  },
  onFileRemoved: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('file-removed', handler)
    return () => ipcRenderer.removeListener('file-removed', handler)
  },
  onFolderRemoved: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('folder-removed', handler)
    return () => ipcRenderer.removeListener('folder-removed', handler)
  },
  // Workspace search
  workspaceSearch: (folderPath, query, opts) =>
    ipcRenderer.invoke('workspace-search', folderPath, query, opts),
  // Auto-update
  onUpdateAvailable: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, info: { version: string }) => cb(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloaded: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, info: { version: string }) => cb(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  // Window controls (Windows frameless)
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onMaximizeChange: (cb: (maximized: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, v: boolean) => cb(v)
    ipcRenderer.on('maximize-change', handler)
    return () => ipcRenderer.removeListener('maximize-change', handler)
  },
}

contextBridge.exposeInMainWorld('fern', fernAPI)
