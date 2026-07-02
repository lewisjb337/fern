import React, { useEffect, useState, useRef, useCallback } from 'react'
import { shortcut } from '../utils/platform'
import { OutlinePanel } from './OutlinePanel'
import type { FileNode } from '../types/fern.d'
import type { AppPage } from './TopBar'

const DEFAULT_ICON_COLOR = '#A8A39C'

const COLOR_OPTIONS: { value: string | null; label: string }[] = [
  { value: null,      label: 'Default'  },
  { value: '#EF5350', label: 'Red'      },
  { value: '#F06292', label: 'Pink'     },
  { value: '#FF9800', label: 'Orange'   },
  { value: '#FFCA28', label: 'Amber'    },
  { value: '#FDD835', label: 'Yellow'   },
  { value: '#9CCC65', label: 'Lime'     },
  { value: '#66BB6A', label: 'Green'    },
  { value: '#1A5C43', label: 'Forest'   },
  { value: '#26A69A', label: 'Teal'     },
  { value: '#29B6F6', label: 'Cyan'     },
  { value: '#42A5F5', label: 'Blue'     },
  { value: '#5C6BC0', label: 'Indigo'   },
  { value: '#AB47BC', label: 'Purple'   },
  { value: '#78909C', label: 'Slate'    },
]

function FolderIcon({ color = DEFAULT_ICON_COLOR }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1.5 4.5C1.5 3.67 2.17 3 3 3H6.38l1.5 1.5H13a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0113 13.5H3A1.5 1.5 0 011.5 12V4.5z" fill={color} />
    </svg>
  )
}

function FileIcon({ color = DEFAULT_ICON_COLOR }: { color?: string }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 1.5A1.5 1.5 0 013.5 0H9l4 4v10.5A1.5 1.5 0 0111.5 16h-8A1.5 1.5 0 012 14.5V1.5z" fill={color} fillOpacity="0.75" />
      <path d="M9 0l4 4H9.5A.5.5 0 019 3.5V0z" fill={color} fillOpacity="0.4" />
    </svg>
  )
}

interface ContextMenu {
  path: string
  type: 'file' | 'folder'
  x: number
  y: number
}

interface SidebarProps {
  folderPath: string | null
  files: FileNode[]
  fileColors: Record<string, string>
  activeFile: string | null
  dirtyFiles: Set<string>
  recentFolders: string[]
  renamingFile: string | null
  pinnedFiles: string[]
  showOutline: boolean
  outlineContent: string
  onSelectFile: (filePath: string) => void
  onCloseFile: () => void
  onOpenFolder: () => void
  onOpenRecent: (folderPath: string) => void
  onCreateFile: (parentPath?: string) => void
  onCreateFolder: (parentPath?: string) => void
  onRenameFile: (oldPath: string, newName: string) => void
  onDeleteFile: (filePath: string) => void
  onMoveFile: (srcPath: string, dstFolderPath: string) => void
  onShowInFolder: (filePath: string) => void
  onStartRename: (filePath: string) => void
  onSetFileColor: (filePath: string, color: string | null) => void
  onTogglePin: (filePath: string) => void
  onJumpToLine: (line: number) => void
  activePage?: AppPage
  onSetPage?: (page: AppPage) => void
  onOpenTerminal?: () => void
  onOpenSearch?: () => void
  onOpenRevisions?: () => void
}

export function Sidebar({
  folderPath,
  files,
  fileColors,
  activeFile,
  dirtyFiles,
  recentFolders,
  renamingFile,
  pinnedFiles,
  showOutline,
  outlineContent,
  onSelectFile,
  onCloseFile,
  onOpenFolder,
  onOpenRecent,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onMoveFile,
  onShowInFolder,
  onStartRename,
  onSetFileColor,
  onTogglePin,
  onJumpToLine,
  activePage,
  onSetPage,
  onOpenTerminal,
  onOpenSearch,
  onOpenRevisions,
}: SidebarProps) {
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!folderPath) { setGitBranch(null); return }
    window.fern.getGitBranch(folderPath).then(setGitBranch)
  }, [folderPath])

  useEffect(() => {
    if (!renamingFile) return
    // Expand every ancestor folder so the rename input is rendered
    const sep = renamingFile.includes('\\') ? '\\' : '/'
    const parts = renamingFile.split(/[\\/]/)
    parts.pop() // drop filename
    const ancestors: string[] = []
    for (let i = 1; i <= parts.length; i++) {
      ancestors.push(parts.slice(0, i).join(sep))
    }
    if (ancestors.length > 0) {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        ancestors.forEach((p) => next.add(p))
        return next
      })
    }
    // Wait for React to render the expanded tree, then focus + select
    const base = renamingFile.split(/[\\/]/).pop() ?? ''
    setRenameValue(base)
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus()
        renameInputRef.current.scrollIntoView({ block: 'nearest' })
        const dotIdx = base.lastIndexOf('.')
        renameInputRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : base.length)
      }
    }, 30)
  }, [renamingFile])

  useEffect(() => {
    if (!contextMenu) return
    function onDown(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [contextMenu])

  function getFolderName(fp: string) {
    return fp.split(/[\\/]/).filter(Boolean).pop() ?? fp
  }

  function toggleFolder(folderPath: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) next.delete(folderPath)
      else next.add(folderPath)
      return next
    })
  }

  function handleDotsClick(e: React.MouseEvent, node: FileNode) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setContextMenu({ path: node.path, type: node.type, x: rect.right + 4, y: rect.top })
  }

  function handleRenameSubmit(oldPath: string) {
    let name = renameValue.trim()
    if (!name) return
    const isFile = oldPath.endsWith('.md')
    if (isFile && !name.endsWith('.md')) name = `${name}.md`
    onRenameFile(oldPath, name)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent, oldPath: string) {
    if (e.key === 'Enter') { e.preventDefault(); handleRenameSubmit(oldPath) }
    if (e.key === 'Escape') { onRenameFile(oldPath, oldPath.split(/[\\/]/).pop() ?? '') }
  }

  const handleDragStart = useCallback((e: React.DragEvent, node: FileNode) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, folderPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(folderPath)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    setDragOver(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dstFolderPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    const srcPath = e.dataTransfer.getData('text/plain')
    setDragOver(null)
    if (!srcPath || srcPath === dstFolderPath) return
    if (srcPath && dstFolderPath.startsWith(srcPath)) return
    onMoveFile(srcPath, dstFolderPath)
  }, [onMoveFile])

  function renderFileRow(node: FileNode, depth: number, isPinned = false): React.ReactNode {
    const isRenaming = renamingFile === node.path
    const color = fileColors[node.path]
    const indent = depth * 14
    const isActive = activeFile === node.path
    const displayName = node.name.replace(/\.md$/, '')
    const pinned = pinnedFiles.includes(node.path)

    return (
      <div
        key={node.path + (isPinned ? '-pin' : '')}
        className={`sidebar-tree-row file-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: 8 + indent }}
        onClick={() => !isRenaming && onSelectFile(node.path)}
        draggable
        onDragStart={(e) => handleDragStart(e, node)}
      >
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="sidebar-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => handleRenameKeyDown(e, node.path)}
            onBlur={() => handleRenameSubmit(node.path)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="file-icon-spacer" />
            <FileIcon color={color || DEFAULT_ICON_COLOR} />
            <span className="sidebar-item-name">{displayName}</span>
            {pinned && !isPinned && <span className="pin-indicator" title="Pinned">📌</span>}
            {dirtyFiles.has(node.path) && <span className="sidebar-dirty-dot" />}
            <div className="sidebar-item-actions">
              {isActive && (
                <button
                  className="sidebar-close-btn"
                  title="Close"
                  onClick={(e) => { e.stopPropagation(); onCloseFile() }}
                >×</button>
              )}
              <button
                className="sidebar-dots-btn"
                title="More options"
                onClick={(e) => handleDotsClick(e, node)}
              >···</button>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderNode(node: FileNode, depth: number): React.ReactNode {
    const isRenaming = renamingFile === node.path
    const color = fileColors[node.path]
    const indent = depth * 14

    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path)
      const isDropTarget = dragOver === node.path

      return (
        <div key={node.path}>
          <div
            className={`sidebar-tree-row folder-row ${isDropTarget ? 'drop-target' : ''}`}
            style={{ paddingLeft: 8 + indent }}
            onClick={() => !isRenaming && toggleFolder(node.path)}
            onDragOver={(e) => handleDragOver(e, node.path)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node.path)}
            draggable
            onDragStart={(e) => handleDragStart(e, node)}
          >
            {isRenaming ? (
              <input
                ref={renameInputRef}
                className="sidebar-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => handleRenameKeyDown(e, node.path)}
                onBlur={() => handleRenameSubmit(node.path)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="folder-chevron">{isExpanded ? '▾' : '▸'}</span>
                <FolderIcon color={color || DEFAULT_ICON_COLOR} />
                <span className="sidebar-item-name">{node.name}</span>
                <div className="sidebar-item-actions">
                  <button
                    className="sidebar-dots-btn"
                    title="More options"
                    onClick={(e) => handleDotsClick(e, node)}
                  >···</button>
                </div>
              </>
            )}
          </div>
          {isExpanded && (
            <div className="folder-children">
              {(node.children ?? []).length === 0 ? (
                <div className="folder-empty" style={{ paddingLeft: 8 + indent + 20 }}>Empty</div>
              ) : (
                (node.children ?? []).map((child) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      )
    }

    return renderFileRow(node, depth)
  }

  // Find file nodes for pinned paths
  function findFileNode(nodes: FileNode[], filePath: string): FileNode | null {
    for (const n of nodes) {
      if (n.path === filePath && n.type === 'file') return n
      if (n.children) {
        const found = findFileNode(n.children, filePath)
        if (found) return found
      }
    }
    return null
  }

  const pinnedNodes = pinnedFiles
    .map((p) => findFileNode(files, p))
    .filter((n): n is FileNode => n !== null)

  return (
    <aside className="sidebar">
      <div className="sidebar-body">
        {/* Nav rows */}
        <div className="sidebar-nav">
          <button className="sidebar-nav-item" onClick={onOpenSearch}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Search</span>
          </button>
          <button className={`sidebar-nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => onSetPage?.('overview')}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="3.5" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1.5 6.5h10" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span>Overview</span>
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* Workspace / files */}
        {!folderPath ? (
          <div className="sidebar-section">
            <button className="sidebar-open-folder-btn" onClick={onOpenFolder}>
              Open folder…
            </button>
            {recentFolders.length > 0 && (
              <ul className="sidebar-recent-list">
                {recentFolders.slice(0, 5).map((fp) => (
                  <li key={fp}>
                    <button className="sidebar-recent-item" onClick={() => onOpenRecent(fp)}>
                      <span className="sidebar-recent-icon">📁</span>
                      <span className="sidebar-recent-name">{getFolderName(fp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="sidebar-section-label">Project</div>

            {/* Pinned files */}
            {pinnedNodes.length > 0 && (
              <div className="sidebar-section sidebar-section--pinned">
                <div className="sidebar-tree">
                  {pinnedNodes.map((node) => renderFileRow(node, 0, true))}
                </div>
              </div>
            )}

            {/* File tree */}
            <div
              className="sidebar-section sidebar-files-section"
              onDragOver={(e) => handleDragOver(e, folderPath)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folderPath)}
            >
              {files.length === 0 ? (
                <div className="sidebar-empty-files">
                  <span className="sidebar-empty-msg">No markdown files</span>
                  <button className="sidebar-create-link" onClick={() => onCreateFile()}>
                    Create one →
                  </button>
                </div>
              ) : (
                <div className="sidebar-tree">
                  {files.map((node) => renderNode(node, 0))}
                </div>
              )}
            </div>

            {/* Git section */}
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Git</div>
            <div className="sidebar-nav sidebar-nav--git">
              <button className={`sidebar-nav-item ${activePage === 'git' ? 'active' : ''}`} onClick={() => onSetPage?.('git')}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="3.5" cy="2.5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                  <circle cx="3.5" cy="10.5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                  <circle cx="9.5" cy="5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M3.5 3.8v5.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  <path d="M3.5 3.8C3.5 3.8 3.5 5.5 5.8 5.5H8.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                <span>{gitBranch ?? 'main'}</span>
              </button>
              <button className="sidebar-nav-item" onClick={onOpenRevisions}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6.5 3.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>History</span>
              </button>
            </div>
          </>
        )}

        {/* Outline panel */}
        {showOutline && outlineContent && (
          <OutlinePanel content={outlineContent} onJumpToLine={onJumpToLine} />
        )}

        <div className="sidebar-body-spacer" />
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-icons">
          {folderPath && (
            <>
              <button
                className="sidebar-icon-btn"
                title={`New file (${shortcut('N')})`}
                onClick={() => onCreateFile()}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 1.5A1.5 1.5 0 001.5 3v9A1.5 1.5 0 003 13.5h9a1.5 1.5 0 001.5-1.5V5L10 1.5H3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M7.5 7.5v3M6 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className="sidebar-icon-btn"
                title="New folder"
                onClick={() => onCreateFolder()}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1.5 4.5C1.5 3.67 2.17 3 3 3H5.88l1.5 1.5H12a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0112 13.5H3A1.5 1.5 0 011.5 12V4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M7.5 7v3M6 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
            </>
          )}
          <div className="sidebar-footer-spacer" />
          <button
            className="sidebar-icon-btn"
            title="Terminal (Ctrl+`)"
            onClick={onOpenTerminal}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 6l2.5 2L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button className={`sidebar-settings-row ${activePage === 'settings' ? 'active' : ''}`} onClick={() => onSetPage?.('settings')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.1 3.1l.7.7M10.2 10.2l.7.7M3.1 10.9l.7-.7M10.2 3.8l.7-.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="delete-confirm">
          <p className="delete-confirm-msg">
            Delete <strong>{confirmDelete.split(/[\\/]/).pop()}</strong>?
            {!confirmDelete.endsWith('.md') && (
              <span className="delete-confirm-warn"> This will delete the folder and all its contents.</span>
            )}
          </p>
          <div className="delete-confirm-btns">
            <button className="delete-confirm-yes" onClick={() => { onDeleteFile(confirmDelete); setConfirmDelete(null) }}>Delete</button>
            <button className="delete-confirm-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="file-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button onClick={() => { onCreateFile(contextMenu.path); setContextMenu(null) }}>New file here</button>
              <button onClick={() => { onCreateFolder(contextMenu.path); setContextMenu(null) }}>New subfolder</button>
              <div className="file-context-separator" />
            </>
          )}
          <button onClick={() => { onStartRename(contextMenu.path); setContextMenu(null) }}>Rename</button>
          <button onClick={() => { onShowInFolder(contextMenu.path); setContextMenu(null) }}>Show in Folder</button>
          {contextMenu.type === 'file' && (
            <button onClick={() => { onTogglePin(contextMenu.path); setContextMenu(null) }}>
              {pinnedFiles.includes(contextMenu.path) ? 'Unpin' : 'Pin to top'}
            </button>
          )}
          <div className="file-context-separator" />
          <div className="file-context-color-row">
            <span className="file-context-color-label">Color</span>
            <div className="color-swatches">
              {COLOR_OPTIONS.map((opt) => {
                const isSelected = fileColors[contextMenu.path] === opt.value || (!fileColors[contextMenu.path] && !opt.value)
                return (
                  <span
                    key={opt.label}
                    className={`color-swatch ${isSelected ? 'selected' : ''}`}
                    style={{ background: opt.value ?? '#E0DFE0', outline: isSelected ? `2px solid var(--accent)` : 'none', outlineOffset: '2px' }}
                    title={opt.label}
                    role="button"
                    onClick={() => { onSetFileColor(contextMenu.path, opt.value); setContextMenu(null) }}
                  />
                )
              })}
            </div>
          </div>
          <div className="file-context-separator" />
          <button
            className="file-context-danger"
            onClick={() => { setConfirmDelete(contextMenu.path); setContextMenu(null) }}
          >Delete</button>
        </div>
      )}

      <style>{`
        .sidebar {
          width: 240px;
          min-width: 200px;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
        }
        .sidebar-nav {
          padding: 4px 6px 2px;
        }
        .sidebar-nav--git { padding-top: 2px; }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 13px;
          color: var(--text-secondary);
          background: transparent;
          text-align: left;
          transition: background 0.08s, color 0.08s;
          cursor: pointer;
        }
        .sidebar-nav-item svg { flex-shrink: 0; opacity: 0.7; }
        .sidebar-nav-item:hover, .sidebar-nav-item.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-nav-item.active { background: var(--bg-selected); font-weight: 500; }
        .sidebar-nav-item:hover svg, .sidebar-nav-item.active svg { opacity: 1; }
        .sidebar-divider {
          height: 1px;
          background: var(--border);
          margin: 6px 0 2px;
        }
        .sidebar-section-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--text-disabled);
          padding: 6px 14px 2px;
        }
        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0 0;
          display: flex;
          flex-direction: column;
        }
        .sidebar-body-spacer { flex: 1; }
        .sidebar-section {
          padding: 2px 0 2px;
        }
        .sidebar-section--pinned {
          border-top: 1px solid var(--border);
          margin: 4px 0 0;
          padding-top: 6px;
        }
        .sidebar-files-section { flex: 1; }
        .sidebar-workspace-name {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.1s;
          margin: 0 4px;
        }
        .sidebar-workspace-name:hover { background: var(--bg-hover); }
        .sidebar-workspace-name.drop-target { background: var(--accent-bg); }
        .sidebar-workspace-icon { font-size: 12px; flex-shrink: 0; }
        .sidebar-workspace-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar-branch-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
          background: var(--bg-selected);
          padding: 1px 5px;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .sidebar-open-folder-btn {
          background: var(--accent);
          color: white;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px;
          margin: 2px 8px;
          display: block;
          width: calc(100% - 16px);
          text-align: left;
        }
        .sidebar-open-folder-btn:hover { background: var(--accent-hover); }

        /* Tree */
        .sidebar-tree { padding: 2px 4px; }
        .sidebar-tree-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
          font-size: 14px;
          color: var(--text-secondary);
          transition: background 0.08s, color 0.08s;
          position: relative;
          min-height: 27px;
        }
        .sidebar-tree-row:hover:not(.active) { background: var(--bg-hover); color: var(--text-primary); }
        .sidebar-tree-row.active {
          background: var(--bg-selected);
          color: var(--text-primary);
          font-weight: 500;
        }
        .sidebar-tree-row.drop-target { background: var(--accent-bg); outline: 1px dashed var(--accent); }
        .folder-chevron {
          font-size: 9px;
          color: var(--text-muted);
          width: 12px;
          flex-shrink: 0;
          line-height: 1;
        }
        .file-icon-spacer {
          width: 12px;
          flex-shrink: 0;
        }
        .sidebar-item-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .sidebar-dirty-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }
        .pin-indicator {
          font-size: 9px;
          flex-shrink: 0;
          opacity: 0.5;
        }
        .folder-children { }
        .folder-empty {
          font-size: 11px;
          color: var(--text-disabled);
          padding: 3px 0;
          font-style: italic;
        }

        /* Item actions */
        .sidebar-item-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
          margin-left: auto;
          opacity: 0;
          transition: opacity 0.1s;
        }
        .sidebar-tree-row:hover .sidebar-item-actions,
        .sidebar-tree-row.active .sidebar-item-actions { opacity: 1; }
        .sidebar-close-btn, .sidebar-dots-btn {
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          width: 20px; height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          transition: background 0.1s, color 0.1s;
          flex-shrink: 0;
          line-height: 1;
          padding: 0;
        }
        .sidebar-close-btn:hover, .sidebar-dots-btn:hover {
          background: var(--bg-selected);
          color: var(--text-primary);
        }
        .sidebar-dots-btn { font-size: 11px; letter-spacing: 1px; }

        /* Rename input */
        .sidebar-rename-input {
          flex: 1;
          background: var(--bg-app);
          border: 1px solid var(--accent);
          border-radius: 4px;
          padding: 2px 5px;
          font-size: 13px;
          font-family: var(--font-sans);
          color: var(--text-primary);
          outline: none;
          min-width: 0;
        }

        /* Empty state */
        .sidebar-empty-files { padding: 4px 8px; display: flex; flex-direction: column; gap: 4px; }
        .sidebar-empty-msg { font-size: 13px; color: var(--text-muted); }
        .sidebar-create-link { background: transparent; color: var(--accent); font-size: 12px; text-align: left; text-decoration: underline; text-underline-offset: 2px; padding: 0; }

        /* Recent */
        .sidebar-recent-list { list-style: none; padding: 2px 4px; }
        .sidebar-recent-item { display: flex; align-items: center; gap: 6px; background: transparent; color: var(--text-secondary); font-size: 13px; padding: 5px 8px; border-radius: 4px; text-align: left; width: 100%; transition: background 0.1s; }
        .sidebar-recent-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .sidebar-recent-icon { font-size: 12px; }
        .sidebar-recent-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Footer */
        .sidebar-footer {
          border-top: 1px solid var(--border);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
        }
        .sidebar-footer-icons {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 5px 6px 3px;
        }
        .sidebar-footer-spacer { flex: 1; }
        .sidebar-settings-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 14px 9px;
          font-size: 13px;
          color: var(--text-secondary);
          background: transparent;
          text-align: left;
          transition: background 0.08s, color 0.08s;
          cursor: pointer;
          border-top: 1px solid var(--border);
        }
        .sidebar-settings-row svg { opacity: 0.7; flex-shrink: 0; }
        .sidebar-settings-row:hover, .sidebar-settings-row.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-settings-row.active { background: var(--bg-selected); font-weight: 500; }
        .sidebar-settings-row:hover svg, .sidebar-settings-row.active svg { opacity: 1; }
        .sidebar-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: transparent;
          color: var(--text-muted);
          transition: background 0.1s, color 0.1s;
          flex-shrink: 0;
        }
        .sidebar-icon-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-new-btn-unused {
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 8px;
          border-radius: 4px;
          text-align: left;
          flex: 1;
          transition: background 0.1s;
          white-space: nowrap;
        }
        .sidebar-new-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .sidebar-shortcuts { display: flex; flex-direction: column; gap: 5px; }
        .sidebar-shortcut-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted); }
        .sidebar-shortcut-row kbd {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
          background: var(--bg-selected);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-strong);
        }

        /* Delete confirm */
        .delete-confirm {
          position: absolute; bottom: 60px; left: 8px; right: 8px;
          background: var(--bg-app);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          padding: 12px;
          z-index: 500;
        }
        .delete-confirm-msg { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.4; }
        .delete-confirm-msg strong { color: var(--text-primary); }
        .delete-confirm-warn { color: var(--color-red); display: block; margin-top: 4px; }
        .delete-confirm-btns { display: flex; gap: 6px; }
        .delete-confirm-yes { background: var(--color-red); color: white; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 5px; flex: 1; }
        .delete-confirm-yes:hover { background: #c73434; }
        .delete-confirm-no { background: var(--bg-hover); color: var(--text-secondary); font-size: 12px; padding: 5px 12px; border-radius: 5px; flex: 1; }
        .delete-confirm-no:hover { background: var(--bg-selected); }

        /* Context menu */
        .file-context-menu {
          position: fixed;
          background: var(--bg-app);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          padding: 4px;
          z-index: 1000;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .file-context-menu button {
          background: transparent;
          text-align: left;
          font-size: 13px;
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: 4px;
          width: 100%;
          transition: background 0.1s;
        }
        .file-context-menu button:hover { background: var(--bg-hover); }
        .file-context-separator { height: 1px; background: var(--border); margin: 3px 6px; }
        .file-context-danger { color: var(--color-red) !important; }
        .file-context-danger:hover { background: var(--color-red-bg) !important; }

        /* Color picker row */
        .file-context-color-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 6px 10px 8px;
        }
        .file-context-color-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .color-swatches {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          max-width: 180px;
        }
        .color-swatch {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.12s;
          flex-shrink: 0;
        }
        .color-swatch:hover { transform: scale(1.2); }
      `}</style>
    </aside>
  )
}
