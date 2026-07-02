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

export interface RuntimeVersions {
  node: string | null
  python: string | null
  ruby: string | null
  go: string | null
  rust: string | null
  php: string | null
  deno: string | null
  bun: string | null
}

export interface PinnedOutput {
  output: string
  pinnedAt: number
}

// { docRelPath: { blockKey: PinnedOutput } }
export type SnapshotStore = Record<string, Record<string, PinnedOutput>>

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
  getRuntimeVersions: () => Promise<RuntimeVersions>
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
  // Pinned output snapshots
  getSnapshots: (workspacePath: string) => Promise<SnapshotStore>
  setSnapshot: (workspacePath: string, docPath: string, blockKey: string, output: string, pinnedAt: number) => Promise<void>
  clearSnapshot: (workspacePath: string, docPath: string, blockKey: string) => Promise<void>
  // Terminal
  createTerminal: (cwd: string, env: Record<string, string>) => Promise<{ success: boolean; error?: string }>
  terminalInput: (data: string) => Promise<void>
  terminalResize: (cols: number, rows: number) => Promise<void>
  closeTerminal: () => Promise<void>
  onTerminalOutput: (callback: (data: string) => void) => () => void
  // Git
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

declare global {
  interface Window {
    fern: FernAPI
  }
}
