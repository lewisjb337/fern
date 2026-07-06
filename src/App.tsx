import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { LoadingScreen } from './components/LoadingScreen'
import { PreviewPane } from './components/PreviewPane'
import { WelcomeScreen } from './components/WelcomeScreen'
import { StatusBar } from './components/StatusBar'
import { QuickOpen } from './components/QuickOpen'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { SettingsPanel } from './components/SettingsPanel'
import { RevisionHistory } from './components/RevisionHistory'
import { GitPanel } from './components/GitPanel'
import { DiffView } from './components/DiffView'
import { useFileSystem } from './hooks/useFileSystem'
import { useSettings } from './hooks/useSettings'
import { shortcut } from './utils/platform'
import { useExecutor } from './hooks/useExecutor'
import { usePinnedOutputs } from './hooks/usePinnedOutputs'
import { parseAllBlocks, type CodeBlock as CodeBlockData } from './utils/parseBlocks'
import { Terminal } from './components/Terminal'
import { TopBar } from './components/TopBar'
import type { AppPage, ViewMode } from './components/TopBar'
import { TabBar, type OpenTab } from './components/TabBar'
import { WorkspaceSearch } from './components/WorkspaceSearch'
import { OverviewPage } from './components/OverviewPage'
import { marked } from 'marked'
import type { RuntimeVersions } from './types/fern'

const EMPTY_TEMPLATE = `# Project setup\n\n> Run each block below in order.\n\n## 1. Install dependencies\n\n\`\`\`bash run\nnpm install\n\`\`\`\n\n## 2. Verify setup\n\n\`\`\`bash run\nnode --version\necho "✓ Ready"\n\`\`\`\n\n---\n\nTip: add \`run\` after any fenced code block language to make it executable. Blocks share a session — use **Run all** to execute top to bottom.\n`
const RECENT_FOLDERS_KEY = 'fern-recent-folders'
const MAX_RECENT = 5

function getRecentFolders(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_FOLDERS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentFolder(folderPath: string): string[] {
  const current = getRecentFolders().filter((f) => f !== folderPath)
  const updated = [folderPath, ...current].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated))
  return updated
}

export default function App() {
  const {
    folderPath,
    files,
    fileColors,
    writeError,
    openFolder: fsOpenFolder,
    loadFolder,
    readFile,
    writeFile,
    createFile,
    createFolder,
    renameFile,
    deleteFile,
    moveFile,
    showInFolder,
    setFileColor,
    uniqueFileName,
    uniqueFolderName,
  } = useFileSystem()

  const { settings, updateSetting } = useSettings()
  const { blockStates, runBlock, stopBlock, runAllBlocks, resetBlocks, clearBlock, getSessionEnv, runAllPausedAt, resolveRunAll } = useExecutor(folderPath)

  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const openTabsRef = useRef<OpenTab[]>([])
  openTabsRef.current = openTabs
  // Files changed on disk while dirty in the editor — show reload prompt
  const [externalChanges, setExternalChanges] = useState<Set<string>>(new Set())
  const { pinOutput, unpinOutput, getPinned } = usePinnedOutputs(folderPath, activeFile)
  const [content, setContent] = useState<string>('')
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [runtimeVersions, setRuntimeVersions] = useState<Partial<RuntimeVersions>>({})
  const [showTerminal, setShowTerminal] = useState(false)
  const [recentFolders, setRecentFolders] = useState<string[]>(getRecentFolders)
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [appReady, setAppReady] = useState(false)

  // UI overlay states
  const [distractionFree, setDistractionFree] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [activePage, setActivePage] = useState<AppPage>('editor')
  const [diffFilePath, setDiffFilePath] = useState<string | null>(null)
  const [apiTrusted, setApiTrusted] = useState<boolean | null>(null)
  const [envWarningDismissed, setEnvWarningDismissed] = useState(false)
  const [showEnvWarning, setShowEnvWarning] = useState(false)

  // Pin files
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Auto-update
  const [updateReady, setUpdateReady] = useState<{ version: string } | null>(null)
  useEffect(() => {
    const off = window.fern.onUpdateDownloaded((info) => setUpdateReady(info))
    return off
  }, [])

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveDelay = settings.autosaveDelay
  const contentRef = useRef(content)
  contentRef.current = content
  const activeFileRef = useRef(activeFile)
  activeFileRef.current = activeFile
  const dirtyFilesRef = useRef(dirtyFiles)
  dirtyFilesRef.current = dirtyFiles

  // Distraction-free inactivity fade
  const dfMouseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dfHintVisible, setDfHintVisible] = useState(true)
  useEffect(() => {
    if (!distractionFree) { setDfHintVisible(true); return }
    const resetTimer = () => {
      setDfHintVisible(true)
      if (dfMouseTimer.current) clearTimeout(dfMouseTimer.current)
      dfMouseTimer.current = setTimeout(() => setDfHintVisible(false), 2500)
    }
    window.addEventListener('mousemove', resetTimer)
    resetTimer()
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      if (dfMouseTimer.current) clearTimeout(dfMouseTimer.current)
    }
  }, [distractionFree])

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

  // Startup
  useEffect(() => {
    async function init() {
      await Promise.all([
        window.fern.getRuntimeVersions().then(setRuntimeVersions),
        window.fern.getPinnedFiles().then(setPinnedFiles),
        window.fern.getLastFolder().then(async (lastFolder) => {
          if (lastFolder) { try { await loadFolder(lastFolder) } catch {} }
        }),
      ])
      setTimeout(() => setAppReady(true), 600)
    }
    init()
  }, [loadFolder])

  // Apply theme
  const resolvedDark = settings.theme === 'dark' ||
    (settings.theme !== 'light' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const theme = settings.theme ?? 'system'
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [settings.theme])

  // Load API trust for current workspace
  useEffect(() => {
    if (!folderPath) return
    window.fern.getApiTrust(folderPath).then(setApiTrusted)
  }, [folderPath])

  // Check .env in gitignore when workspace opens
  useEffect(() => {
    if (!folderPath || envWarningDismissed) return
    window.fern.checkEnvGitignore(folderPath).then(({ envExists, inGitignore }) => {
      setShowEnvWarning(envExists && !inGitignore)
    })
  }, [folderPath, envWarningDismissed])

  // React to external file changes reported by the main-process watcher
  useEffect(() => {
    const norm = (p: string) => p.replace(/\//g, '\\')
    const offChanged = window.fern.onFileChangedExternally(async (rawPath) => {
      const p = norm(rawPath)
      const af = activeFileRef.current
      if (!af || norm(af) !== p) return
      try {
        const diskContent = await readFile(af)
        // If disk matches memory it was our own write — just clear the dirty flag
        if (diskContent === contentRef.current) {
          setDirtyFiles((prev) => { const n = new Set(prev); n.delete(af); return n })
          return
        }
        if (dirtyFilesRef.current.has(af)) {
          // Content differs AND we have unsaved edits — real external conflict
          setExternalChanges((prev) => new Set(prev).add(af))
        } else {
          // Not dirty — silently reload
          setContent(diskContent)
        }
      } catch {}
    })
    const offAdded = window.fern.onFileAdded(() => { void refreshFolder() })

    const closeAffectedTabs = (isAffected: (p: string) => boolean) => {
      const tabs = openTabsRef.current
      const affectedSet = new Set(tabs.filter((t) => isAffected(norm(t.path))).map((t) => t.path))
      if (affectedSet.size === 0) return
      const activeFile = activeFileRef.current
      if (activeFile && affectedSet.has(activeFile)) {
        const surviving = tabs.filter((t) => !affectedSet.has(t.path))
        const neighbour = surviving[0] ?? null
        if (neighbour) {
          void openFile(neighbour.path)
        } else {
          setActiveFile(null)
          setContent('')
          setActiveTabPath(null)
          resetBlocks([])
          setIsRunningAll(false)
        }
      }
      setOpenTabs((prev) => prev.filter((t) => !affectedSet.has(t.path)))
      setExternalChanges((prev) => {
        const n = new Set(prev)
        affectedSet.forEach((p) => n.delete(p))
        return n
      })
    }

    const offRemoved = window.fern.onFileRemoved((rawPath) => {
      const p = norm(rawPath)
      closeAffectedTabs((tp) => tp === p)
      void refreshFolder()
    })
    const offFolderRemoved = window.fern.onFolderRemoved((rawPath) => {
      const p = norm(rawPath)
      closeAffectedTabs((tp) => tp === p || tp.startsWith(p + '/'))
      void refreshFolder()
    })
    return () => { offChanged(); offAdded(); offRemoved(); offFolderRemoved() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readFile])

  const refreshFolder = useCallback(async () => {
    if (folderPath) { try { await loadFolder(folderPath) } catch {} }
  }, [folderPath, loadFolder])

  // Reload the active file from disk, discarding in-memory edits
  const reloadExternalFile = useCallback(async (filePath: string) => {
    try {
      const text = await readFile(filePath)
      if (activeFileRef.current === filePath) setContent(text)
      setDirtyFiles((prev) => { const n = new Set(prev); n.delete(filePath); return n })
    } catch {}
    setExternalChanges((prev) => { const n = new Set(prev); n.delete(filePath); return n })
  }, [readFile])

  const openFolder = useCallback(async () => { await fsOpenFolder() }, [fsOpenFolder])

  useEffect(() => {
    if (!folderPath) return
    const updated = addRecentFolder(folderPath)
    setRecentFolders(updated)
  }, [folderPath])

  const openRecent = useCallback(async (fp: string) => {
    try {
      await loadFolder(fp)
      const updated = addRecentFolder(fp)
      setRecentFolders(updated)
      setActiveFile(null)
      setContent('')
    } catch {
      const updated = getRecentFolders().filter((f) => f !== fp)
      localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated))
      setRecentFolders(updated)
    }
  }, [loadFolder])

  const flushAutosave = useCallback(async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
      const af = activeFileRef.current
      if (af) {
        await writeFile(af, contentRef.current)
        setDirtyFiles((prev) => { const n = new Set(prev); n.delete(af); return n })
      }
    }
  }, [writeFile])

  const openFile = useCallback(async (filePath: string) => {
    await flushAutosave()
    let text: string
    try {
      text = await readFile(filePath)
    } catch (e) {
      showToast(`Could not open file: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    setActiveFile(filePath)
    setContent(text)
    resetBlocks([])
    setIsRunningAll(false)
    setActivePage('editor')
    setActiveTabPath(filePath)
    setExternalChanges((prev) => { const n = new Set(prev); n.delete(filePath); return n })
    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === filePath)) return prev
      const name = filePath.split(/[\\/]/).pop() ?? filePath
      return [...prev, { path: filePath, name, isDirty: false }]
    })
  }, [flushAutosave, readFile, resetBlocks])

  const closeFile = useCallback(async (filePath?: string) => {
    await flushAutosave()
    setActiveFile(null)
    setContent('')
    resetBlocks([])
    setIsRunningAll(false)
    setActiveTabPath(null)
    if (filePath) {
      setOpenTabs((prev) => prev.filter((t) => t.path !== filePath))
      setExternalChanges((prev) => { const n = new Set(prev); n.delete(filePath); return n })
    }
  }, [flushAutosave, resetBlocks])

  // Close a single tab; activate a neighbouring tab if the active one closed
  const closeTab = useCallback(async (tabPath: string) => {
    const wasActive = activeFileRef.current === tabPath
    if (wasActive) await flushAutosave()
    setExternalChanges((prev) => { const n = new Set(prev); n.delete(tabPath); return n })
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === tabPath)
      if (idx === -1) return prev
      const next = prev.filter((t) => t.path !== tabPath)
      if (wasActive) {
        const neighbour = next[idx] ?? next[idx - 1] ?? null
        if (neighbour) {
          // Load neighbour tab
          void openFile(neighbour.path)
        } else {
          setActiveFile(null)
          setContent('')
          setActiveTabPath(null)
          resetBlocks([])
          setIsRunningAll(false)
        }
      }
      return next
    })
  }, [flushAutosave, openFile, resetBlocks])

  // Keep tab dirty indicators in sync with dirtyFiles
  useEffect(() => {
    setOpenTabs((prev) => {
      let changed = false
      const next = prev.map((t) => {
        const isDirty = dirtyFiles.has(t.path)
        if (isDirty !== t.isDirty) { changed = true; return { ...t, isDirty } }
        return t
      })
      return changed ? next : prev
    })
  }, [dirtyFiles])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    const af = activeFileRef.current
    if (!af) return
    setDirtyFiles((prev) => new Set(prev).add(af))
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      await writeFile(af, newContent)
      // Save revision on each autosave
      await window.fern.saveRevision(af, newContent)
      setDirtyFiles((prev) => { const n = new Set(prev); n.delete(af); return n })
    }, autosaveDelay)
  }, [writeFile, autosaveDelay])

  const handleBlockChange = useCallback((block: CodeBlockData, newCode: string) => {
    const normalised = content.replace(/\r\n/g, '\n')
    const runtime = block.runtime || 'http'
    const runFlag = block.runnable ? ' run' : ''
    const newFence = '```' + runtime + runFlag + '\n' + newCode + '\n```'
    const newContent = normalised.slice(0, block.startIndex) + newFence + normalised.slice(block.endIndex)
    handleContentChange(newContent)
  }, [content, handleContentChange])

  const handleMakeRunnable = useCallback((block: CodeBlockData) => {
    const normalised = content.replace(/\r\n/g, '\n')
    const lineStart = block.startIndex
    const lineEnd = normalised.indexOf('\n', lineStart)
    if (lineEnd === -1) return
    const currentFence = normalised.slice(lineStart, lineEnd)
    const runtime = block.runtime || 'bash'
    const newFence = '```' + runtime + ' run'
    if (currentFence === newFence) return
    const newContent = normalised.slice(0, lineStart) + newFence + normalised.slice(lineEnd)
    handleContentChange(newContent)
  }, [content, handleContentChange])

  const handleCreateFile = useCallback(async (parentPath?: string) => {
    if (!folderPath) return
    const name = uniqueFileName('untitled', parentPath)
    const filePath = await createFile(name, '', parentPath)
    if (!filePath) return
    await openFile(filePath)
    setRenamingFile(filePath)
  }, [folderPath, uniqueFileName, createFile, openFile])

  const handleCreateFolder = useCallback(async (parentPath?: string) => {
    if (!folderPath) return
    const name = uniqueFolderName('new-folder', parentPath)
    const newPath = await createFolder(name, parentPath)
    if (newPath) setRenamingFile(newPath)
  }, [folderPath, uniqueFolderName, createFolder])

  const handleRenameFile = useCallback(async (oldPath: string, newName: string) => {
    setRenamingFile(null)
    const currentBase = oldPath.split(/[\\/]/).pop() ?? ''
    if (!newName || newName === currentBase) return
    const newPath = await renameFile(oldPath, newName)
    if (newPath) {
      const newBase = newPath.split(/[\\/]/).pop() ?? newName
      setOpenTabs((prev) => prev.map((t) =>
        t.path === oldPath ? { ...t, path: newPath, name: newBase } : t
      ))
      setActiveTabPath((p) => (p === oldPath ? newPath : p))
      if (activeFile === oldPath) {
        setActiveFile(newPath)
        setDirtyFiles((prev) => {
          const n = new Set(prev)
          if (n.has(oldPath)) { n.delete(oldPath); n.add(newPath) }
          return n
        })
      } else if (activeFile && (activeFile.startsWith(oldPath + '\\') || activeFile.startsWith(oldPath + '/'))) {
        setActiveFile(activeFile.replace(oldPath, newPath))
      }
    }
  }, [renameFile, activeFile])

  const handleMoveFile = useCallback(async (srcPath: string, dstFolderPath: string) => {
    const sep = srcPath.includes('\\') ? '\\' : '/'
    const fileName = srcPath.split(/[\\/]/).pop() ?? ''
    const dstPath = `${dstFolderPath.replace(/[\\/]+$/, '')}${sep}${fileName}`
    try {
      await moveFile(srcPath, dstFolderPath)
    } catch (e) {
      showToast(`Move failed: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    setOpenTabs((prev) => prev.map((t) => (t.path === srcPath ? { ...t, path: dstPath } : t)))
    setActiveTabPath((p) => (p === srcPath ? dstPath : p))
    if (activeFile === srcPath) setActiveFile(dstPath)
  }, [moveFile, activeFile])

  const handleDeleteFile = useCallback(async (filePath: string) => {
    await closeTab(filePath)
    try {
      await deleteFile(filePath)
    } catch (e) {
      showToast(`Delete failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [closeTab, deleteFile])

  const handleTogglePin = useCallback(async (filePath: string) => {
    const updated = pinnedFiles.includes(filePath)
      ? pinnedFiles.filter((p) => p !== filePath)
      : [...pinnedFiles, filePath]
    setPinnedFiles(updated)
    await window.fern.setPinnedFiles(updated)
  }, [pinnedFiles])

  const handleCopyMarkdown = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    showToast('Copied as Markdown')
  }, [content])

  const handleCopyHTML = useCallback(async () => {
    const html = marked.parse(content) as string
    await navigator.clipboard.writeText(html)
    showToast('Copied as HTML')
  }, [content])

  const handleRestoreRevision = useCallback((restoredContent: string) => {
    handleContentChange(restoredContent)
  }, [handleContentChange])

  const handleJumpToLine = useCallback((line: number) => {
    const headingText = (() => {
      const match = (content.replace(/\r\n/g, '\n').split('\n')[line - 1] ?? '').match(/^#{1,3}\s+(.+)/)
      if (!match) return null
      return match[1].trim()
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\r$/, '')
    })()

    const dispatchEvents = () => {
      if (viewMode !== 'preview') {
        window.dispatchEvent(new CustomEvent('fern:jump-to-line', { detail: { line } }))
      }
      if (viewMode !== 'edit' && headingText) {
        window.dispatchEvent(new CustomEvent('fern:jump-to-heading', { detail: { text: headingText } }))
        window.dispatchEvent(new CustomEvent('fern:visible-heading', { detail: { text: headingText } }))
      }
    }

    if (activePage !== 'editor') {
      setActivePage('editor')
      setTimeout(dispatchEvents, 80)
      return
    }

    dispatchEvents()
  }, [activePage, viewMode, content, setActivePage])

  const allBlocks = useMemo(() => parseAllBlocks(content.replace(/\r\n/g, '\n')), [content])
  const runBlocks = useMemo(
    () => allBlocks.filter((b) => b.runnable && b.runtime !== 'http' && b.runtime !== 'https'),
    [allBlocks]
  )

  const handleRunAll = useCallback(async () => {
    if (isRunningAll || !folderPath) return
    setIsRunningAll(true)
    await runAllBlocks(runBlocks.map((b) => ({ id: b.id, code: b.code, runtime: b.runtime, namedId: b.blockId })))
    setIsRunningAll(false)
  }, [isRunningAll, folderPath, runBlocks, runAllBlocks])

  // Command palette actions
  const paletteActions = useMemo<PaletteAction[]>(() => [
    { id: 'new-file', label: 'New File', description: 'Create a new markdown file', shortcut: shortcut('N'), run: () => handleCreateFile() },
    { id: 'open-folder', label: 'Open Folder', description: 'Open a workspace folder', shortcut: shortcut('O'), run: openFolder },
    { id: 'view-edit', label: 'Edit Mode', description: 'Switch to editor-only view', shortcut: shortcut('1'), run: () => setViewMode('edit') },
    { id: 'view-split', label: 'Split Mode', description: 'Show editor and preview side by side', shortcut: shortcut('2'), run: () => setViewMode('split') },
    { id: 'view-preview', label: 'Preview Mode', description: 'Show preview only', shortcut: shortcut('3'), run: () => setViewMode('preview') },
    { id: 'distraction-free', label: 'Distraction Free Mode', description: 'Hide all chrome, focus on writing', shortcut: shortcut('D', true), run: () => setDistractionFree((d) => !d) },
    { id: 'run-all', label: 'Run All Blocks', description: 'Execute all runnable code blocks', shortcut: shortcut('Enter', true), run: handleRunAll },
    { id: 'find-in-doc', label: 'Find in Document', description: 'Search within the current document', shortcut: shortcut('F'), run: () => { setActivePage('editor'); setTimeout(() => window.dispatchEvent(new CustomEvent('fern:open-search')), 60) } },
    { id: 'copy-md', label: 'Copy as Markdown', description: 'Copy document source to clipboard', run: handleCopyMarkdown },
    { id: 'copy-html', label: 'Copy as HTML', description: 'Copy rendered HTML to clipboard', run: handleCopyHTML },
    { id: 'revisions', label: 'Revision History', description: 'Browse and restore past versions', shortcut: shortcut('H', true), run: () => { if (activeFile) setActivePage('revisions') } },
    { id: 'git', label: 'Git Panel', description: 'Commit, push, pull changes', shortcut: shortcut('G', true), run: () => setActivePage('git') },
    { id: 'workspace-search', label: 'Search Workspace', description: 'Search across all files in the workspace', shortcut: shortcut('F', true), run: () => setActivePage('search') },
    { id: 'settings', label: 'Settings', description: 'Configure editor preferences', shortcut: shortcut(','), run: () => setActivePage('settings') },
  ], [handleCreateFile, openFolder, handleRunAll, handleCopyMarkdown, handleCopyHTML])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      // Block shortcuts when an input/textarea has focus (except known global ones)
      if (mod && !e.shiftKey && e.key === 'o') { e.preventDefault(); openFolder() }
      if (mod && !e.shiftKey && e.key === 'n') { e.preventDefault(); handleCreateFile() }
      if (mod && !e.shiftKey && e.key === 'p') { e.preventDefault(); setShowQuickOpen(true) }
      if (mod && e.shiftKey && e.key === 'P') { e.preventDefault(); setShowCommandPalette(true) }
      if (mod && e.shiftKey && e.key === 'D') { e.preventDefault(); setDistractionFree((d) => !d) }
      if (mod && e.shiftKey && e.key === 'H') { e.preventDefault(); if (activeFile) setActivePage('revisions') }
      if (mod && e.key === ',') { e.preventDefault(); setActivePage((p) => p === 'settings' ? 'editor' : 'settings') }
      if (mod && e.key === '1') { e.preventDefault(); setViewMode('edit') }
      if (mod && e.key === '2') { e.preventDefault(); setViewMode('split') }
      if (mod && e.key === '3') { e.preventDefault(); setViewMode('preview') }
      if (mod && e.shiftKey && (e.key === 'Enter' || e.key === 'Return')) {
        e.preventDefault()
        if (!isRunningAll) handleRunAll()
      }
      if (mod && e.key === '`') { e.preventDefault(); setShowTerminal((t) => !t) }
      if (mod && !e.shiftKey && e.key === 't') { e.preventDefault(); setShowTerminal((t) => !t) }
      if (mod && e.shiftKey && e.key === 'G') { e.preventDefault(); setActivePage((p) => p === 'git' ? 'editor' : 'git') }
      if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); setActivePage((p) => p === 'search' ? 'editor' : 'search') }
      // Tab management
      if (mod && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        const at = activeFileRef.current
        if (at) closeTab(at)
      }
      if (mod && e.shiftKey && (e.key === '{' || e.code === 'BracketLeft')) {
        e.preventDefault()
        const tabs = openTabsRef.current
        const cur = tabs.findIndex((t) => t.path === activeFileRef.current)
        if (tabs.length > 1 && cur !== -1) {
          const prev = tabs[(cur - 1 + tabs.length) % tabs.length]
          if (prev) openFile(prev.path)
        }
      }
      if (mod && e.shiftKey && (e.key === '}' || e.code === 'BracketRight')) {
        e.preventDefault()
        const tabs = openTabsRef.current
        const cur = tabs.findIndex((t) => t.path === activeFileRef.current)
        if (tabs.length > 1 && cur !== -1) {
          const next = tabs[(cur + 1) % tabs.length]
          if (next) openFile(next.path)
        }
      }
      if (e.key === 'Escape') {
        if (diffFilePath) { setDiffFilePath(null); return }
        if (showQuickOpen) { setShowQuickOpen(false); return }
        if (showCommandPalette) { setShowCommandPalette(false); return }
        if (activePage !== 'editor') { setActivePage('editor'); return }
        if (distractionFree) { setDistractionFree(false); return }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    openFolder, handleCreateFile, isRunningAll, activeFile, handleRunAll,
    showQuickOpen, showCommandPalette, activePage, distractionFree,
    diffFilePath, closeTab, openFile,
  ])

  const fileName = activeFile ? activeFile.split(/[\\/]/).pop() ?? null : null
  const showWelcome = !activeFile
  const showEditor = !!activeFile && (viewMode === 'edit' || viewMode === 'split')
  const showPreview = !!activeFile && (viewMode === 'preview' || viewMode === 'split')

  if (!appReady) return <LoadingScreen />

  return (
    <div className={`app ${distractionFree ? 'distraction-free' : ''}`}>
      {!distractionFree && (
        <TopBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRunAll={handleRunAll}
          isRunningAll={isRunningAll}
          isRunAllPaused={runAllPausedAt != null}
          hasFile={!!activeFile}
          fileName={fileName}
          activePage={activePage}
        />
      )}
      <div className="app-body">
        {!distractionFree && (
          <Sidebar
            folderPath={folderPath}
            files={files}
            fileColors={fileColors}
            activeFile={activeFile}
            dirtyFiles={dirtyFiles}
            recentFolders={recentFolders}
            renamingFile={renamingFile}
            pinnedFiles={pinnedFiles}
            showOutline={settings.showOutline}
            outlineContent={content}
            onSelectFile={openFile}
            onCloseFile={closeFile}
            onOpenFolder={openFolder}
            onOpenRecent={openRecent}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onMoveFile={handleMoveFile}
            onShowInFolder={showInFolder}
            onStartRename={(fp) => setRenamingFile(fp)}
            onSetFileColor={setFileColor}
            onTogglePin={handleTogglePin}
            onJumpToLine={handleJumpToLine}
            activePage={activePage}
            onSetPage={setActivePage}
            onOpenTerminal={() => setShowTerminal((t) => !t)}
            onOpenSearch={() => setActivePage('search')}
            onOpenRevisions={() => { if (activeFile) setActivePage('revisions'); else setActivePage('git') }}
          />
        )}

        <main className="app-main">
          {!distractionFree && openTabs.length > 0 && activePage === 'editor' && (
            <TabBar
              tabs={openTabs}
              activeTabPath={activeTabPath}
              onSelect={(p) => { if (p !== activeFile) openFile(p) }}
              onClose={closeTab}
            />
          )}
          {activePage === 'editor' && activeFile && externalChanges.has(activeFile) && (
            <div className="external-change-bar">
              <span>This file changed on disk and has unsaved edits here.</span>
              <button
                className="ext-reload-btn"
                onClick={() => reloadExternalFile(activeFile)}
              >
                Reload from disk
              </button>
              <button
                className="ext-keep-btn"
                onClick={() => setExternalChanges((prev) => { const n = new Set(prev); n.delete(activeFile); return n })}
              >
                Keep mine
              </button>
            </div>
          )}
          {activePage === 'search' && folderPath ? (
            <WorkspaceSearch
              folderPath={folderPath}
              onOpenFile={(p, line) => {
                openFile(p)
                setActivePage('editor')
                setTimeout(() => window.dispatchEvent(new CustomEvent('fern:jump-to-line', { detail: { line } })), 80)
              }}
            />
          ) : activePage === 'overview' && folderPath ? (
            <OverviewPage
              folderPath={folderPath}
              files={files}
              activeFile={activeFile}
              onSelectFile={(fp) => { openFile(fp); setActivePage('editor') }}
              onCreateFile={handleCreateFile}
              onOpenGit={() => setActivePage('git')}
              onOpenSettings={() => setActivePage('settings')}
            />
          ) : activePage === 'git' ? (
            <GitPanel
              workspacePath={folderPath}
              onOpenFile={openFile}
              onClose={() => setActivePage('editor')}
              onOpenDiff={(fp) => { setDiffFilePath(fp); setActivePage('editor') }}
              pageMode
            />
          ) : activePage === 'revisions' && activeFile ? (
            <RevisionHistory
              filePath={activeFile}
              currentContent={content}
              onRestore={(c) => { handleRestoreRevision(c); setActivePage('editor') }}
              onClose={() => setActivePage('editor')}
            />
          ) : activePage === 'settings' ? (
            <SettingsPanel
              settings={settings}
              onUpdate={updateSetting}
              onClose={() => setActivePage('editor')}
              workspacePath={folderPath}
              apiTrusted={apiTrusted}
              onSetApiTrust={(trusted) => {
                if (folderPath) window.fern.setApiTrust(folderPath, trusted).then(() => setApiTrusted(trusted))
              }}
              pageMode
            />
          ) : showWelcome ? (
            <WelcomeScreen
              recentFolders={recentFolders}
              onOpenFolder={openFolder}
              onOpenRecent={openRecent}
              onCreateFile={handleCreateFile}
            />
          ) : (
            <div className={`app-editor-area ${viewMode === 'split' ? 'split' : ''} ${distractionFree ? 'df-mode' : ''}`}>
              {showEditor && (
                <Editor
                  content={content}
                  onChange={handleContentChange}
                  vimMode={settings.vimMode}
                  fontSize={settings.fontSize}
                  lineHeight={settings.lineHeight}
                  spellCheck={settings.spellCheck ?? true}
                  folderPath={folderPath}
                  isDark={resolvedDark}
                />
              )}
              {showPreview && (
                <PreviewPane
                  content={content}
                  folderPath={folderPath}
                  onMakeRunnable={handleMakeRunnable}
                  onBlockChange={handleBlockChange}
                  runAllPausedAt={runAllPausedAt}
                  onResolveRunAll={resolveRunAll}
                  getPinned={getPinned}
                  onPin={pinOutput}
                  onUnpin={unpinOutput}
                  embedCacheDuration={settings.embedCacheDuration ?? 30}
                  blockStates={blockStates}
                  runBlock={runBlock}
                  stopBlock={stopBlock}
                  clearBlock={clearBlock}
                />
              )}

              {/* Distraction-free exit hint */}
              {distractionFree && (
                <div className={`df-hint ${dfHintVisible ? 'visible' : ''}`}>
                  Press Esc to exit focus mode
                </div>
              )}
            </div>
          )}
          {showTerminal && folderPath && (
            <Terminal
              workspacePath={folderPath}
              sessionEnv={getSessionEnv()}
              onClose={() => setShowTerminal(false)}
            />
          )}
        </main>
      </div>

      {!distractionFree && (
        <StatusBar
          fileName={fileName}
          blockStates={blockStates}
          totalBlocks={runBlocks.length}
          runtimeVersions={runtimeVersions}
          content={content}
          showWordCount={settings.showWordCount}
          vimMode={settings.vimMode}
        />
      )}

      {/* Modals and overlays */}
      {showQuickOpen && (
        <QuickOpen
          files={files}
          onSelect={(fp) => { openFile(fp); setShowQuickOpen(false) }}
          onClose={() => setShowQuickOpen(false)}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          actions={paletteActions}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {diffFilePath && folderPath && (
        <DiffView
          workspacePath={folderPath}
          filePath={diffFilePath}
          onClose={() => setDiffFilePath(null)}
        />
      )}

      {/* .env warning banner */}
      {showEnvWarning && !envWarningDismissed && (
        <div className="env-warning-banner">
          <span>⚠ Your .env file is not in .gitignore. Add it now to avoid committing secrets?</span>
          <button
            className="env-warning-add"
            onClick={async () => {
              if (folderPath) await window.fern.addEnvToGitignore(folderPath)
              setShowEnvWarning(false)
              setEnvWarningDismissed(true)
            }}
          >
            Add to .gitignore
          </button>
          <button
            className="env-warning-dismiss"
            onClick={() => { setShowEnvWarning(false); setEnvWarningDismissed(true) }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Auto-update ready bar */}
      {updateReady && (
        <div className="update-bar">
          <span>Fern {updateReady.version} is ready to install.</span>
          <button className="update-install-btn" onClick={() => window.fern.installUpdate()}>
            Restart & Update
          </button>
          <button className="update-dismiss-btn" onClick={() => setUpdateReady(null)}>
            Later
          </button>
        </div>
      )}

      {/* Toast */}
      {(writeError || toast) && (
        <div className={`toast ${writeError ? 'toast-error' : 'toast-info'}`}>
          {writeError ? `Could not save ${writeError}` : toast}
        </div>
      )}

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-app);
        }
        .app-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .external-change-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: var(--color-amber-bg, rgba(200,140,40,0.12));
          border-bottom: 1px solid var(--border);
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--color-amber, #A07030);
          flex-shrink: 0;
        }
        .external-change-bar span { flex: 1; }
        .update-bar {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 500;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 20px;
          background: var(--accent);
          color: #FFFFFF;
          font-family: var(--font-sans);
          font-size: 13px;
        }
        .update-bar span { flex: 1; }
        .update-install-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: 5px;
          cursor: pointer;
          background: #FFFFFF;
          color: var(--accent);
          border: none;
        }
        .update-install-btn:hover { background: rgba(255,255,255,0.9); }
        .update-dismiss-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 5px;
          cursor: pointer;
          background: transparent;
          color: #FFFFFF;
          border: 1px solid rgba(255,255,255,0.5);
        }
        .update-dismiss-btn:hover { background: rgba(255,255,255,0.15); }
        .ext-reload-btn, .ext-keep-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          border: 1px solid var(--border-strong);
          background: var(--bg-app);
          color: var(--text-primary);
        }
        .ext-reload-btn:hover, .ext-keep-btn:hover { background: var(--bg-hover); }
        .app-editor-area {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
          position: relative;
        }
        .app-editor-area.split .editor-wrapper,
        .app-editor-area.split .preview-scroll {
          flex: 1;
          min-width: 0;
        }
        .app-editor-area.split .editor-wrapper {
          border-right: 1px solid var(--border);
        }
        /* Distraction-free narrows the editor */
        .app-editor-area.df-mode .editor-wrapper .editor-column {
          max-width: 680px;
        }
        /* Distraction-free hint */
        .df-hint {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-sans);
          font-size: 12px;
          color: rgba(55,53,47,0.45);
          background: rgba(251,251,250,0.7);
          padding: 5px 14px;
          border-radius: 20px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s ease;
          white-space: nowrap;
        }
        .df-hint.visible { opacity: 1; }
        /* Toasts */
        .toast {
          position: fixed;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 8px 16px;
          border-radius: 6px;
          z-index: 1000;
          animation: toast-in 0.15s ease;
        }
        .toast-error {
          background: var(--color-red);
          color: #FFFFFF;
          border: none;
        }
        .toast-info {
          background: var(--bg-selected);
          color: var(--text-primary);
          border: 1px solid var(--border-strong);
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        /* .env warning banner */
        .env-warning-banner {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: var(--color-amber-bg);
          border-bottom: 1px solid var(--border);
          padding: 10px 16px;
          display: flex; align-items: center; gap: 12px;
          font-family: var(--font-sans); font-size: 12px;
          color: var(--color-amber); z-index: 900;
        }
        .env-warning-banner span { flex: 1; }
        .env-warning-add {
          background: var(--color-amber); color: white;
          font-size: 11px; font-weight: 500;
          padding: 5px 10px; border-radius: 5px;
          flex-shrink: 0;
        }
        .env-warning-add:hover { opacity: 0.85; }
        .env-warning-dismiss {
          background: transparent; color: var(--color-amber);
          font-size: 11px; padding: 5px 8px;
          border: 1px solid var(--border-strong); border-radius: 5px;
          flex-shrink: 0;
        }
        .env-warning-dismiss:hover { background: var(--bg-hover); }
      `}</style>
    </div>
  )
}
