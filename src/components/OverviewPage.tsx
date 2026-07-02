import React, { useState, useEffect, useMemo } from 'react'
import type { FileNode } from '../types/fern.d'
import type { GitStatus } from '../types/fern.d'
import { FernLogo } from './FernLogo'
import { shortcut } from '../utils/platform'

interface OverviewPageProps {
  folderPath: string
  files: FileNode[]
  activeFile: string | null
  onSelectFile: (path: string) => void
  onCreateFile: () => void
  onOpenGit?: () => void
  onOpenSettings?: () => void
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const n of nodes) {
    if (n.type === 'file') result.push(n)
    if (n.children) result.push(...flattenFiles(n.children))
  }
  return result
}

function baseName(path: string) {
  return path.split(/[\\/]/).pop() ?? path
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

function statusLabel(file: { index: string; working_dir: string }): { char: string; cls: string } {
  const s = file.index !== ' ' && file.index !== '?' ? file.index : file.working_dir
  switch (s) {
    case 'M': return { char: 'M', cls: 'ov-badge--modified' }
    case 'A': return { char: 'A', cls: 'ov-badge--added' }
    case 'D': return { char: 'D', cls: 'ov-badge--deleted' }
    case '?': return { char: 'U', cls: 'ov-badge--added' }
    default:  return { char: s || '?', cls: 'ov-badge--default' }
  }
}

function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length
}

export function OverviewPage({ folderPath, files, activeFile, onSelectFile, onCreateFile, onOpenGit, onOpenSettings }: OverviewPageProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    window.fern.gitStatus(folderPath).then(setGitStatus).catch(() => {})
  }, [folderPath])

  const allFiles = useMemo(() => flattenFiles(files), [files])

  // Load word counts for all files
  useEffect(() => {
    let cancelled = false
    Promise.all(
      allFiles.map(async (f) => {
        try {
          const content = await window.fern.readFile(f.path)
          return [f.path, countWords(content)] as const
        } catch {
          return [f.path, 0] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      setWordCounts(Object.fromEntries(pairs))
    })
    return () => { cancelled = true }
  }, [allFiles])

  const totalWords = useMemo(() => Object.values(wordCounts).reduce((a, b) => a + b, 0), [wordCounts])

  const folderName = folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath

  return (
    <div className="ov-page">
      {/* Hero */}
      <div className="ov-hero">
        <div className="ov-hero-icon">
          <FernLogo size={40} />
        </div>
        <div className="ov-hero-info">
          <h1 className="ov-workspace-name">{folderName}</h1>
          <p className="ov-workspace-path">{folderPath}</p>
        </div>
        <div className="ov-hero-stats">
          <div className="ov-stat">
            <span className="ov-stat-value">{allFiles.length}</span>
            <span className="ov-stat-label">files</span>
          </div>
          {totalWords > 0 && (
            <div className="ov-stat">
              <span className="ov-stat-value">{totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}</span>
              <span className="ov-stat-label">words</span>
            </div>
          )}
          {gitStatus?.branch && (
            <div className="ov-stat">
              <span className="ov-stat-value">⎇ {gitStatus.branch}</span>
              <span className="ov-stat-label">branch</span>
            </div>
          )}
          {(gitStatus?.files?.length ?? 0) > 0 && (
            <div className="ov-stat">
              <span className="ov-stat-value ov-stat-value--changed">{gitStatus!.files.length}</span>
              <span className="ov-stat-label">changed</span>
            </div>
          )}
          {gitStatus?.ahead !== undefined && gitStatus.ahead > 0 && (
            <div className="ov-stat">
              <span className="ov-stat-value ov-stat-value--ahead">↑{gitStatus.ahead}</span>
              <span className="ov-stat-label">to push</span>
            </div>
          )}
        </div>
      </div>

      <div className="ov-content">
        {/* Quick actions */}
        <section className="ov-section">
          <div className="ov-section-header">
            <h2 className="ov-section-title">Quick actions</h2>
          </div>
          <div className="ov-actions-grid">
            <button className="ov-action-card" onClick={onCreateFile}>
              <span className="ov-action-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="ov-action-label">New file</span>
              <span className="ov-action-shortcut">{shortcut('N')}</span>
            </button>
            {onOpenGit && (
              <button className="ov-action-card" onClick={onOpenGit}>
                <span className="ov-action-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="13" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="5" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M13 6c0 3-8 4-8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className="ov-action-label">Git panel</span>
                <span className="ov-action-shortcut">{shortcut('G', true)}</span>
              </button>
            )}
            {onOpenSettings && (
              <button className="ov-action-card" onClick={onOpenSettings}>
                <span className="ov-action-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className="ov-action-label">Settings</span>
                <span className="ov-action-shortcut">{shortcut(',')}</span>
              </button>
            )}
          </div>
        </section>

        {/* Files */}
        <section className="ov-section">
          <div className="ov-section-header">
            <h2 className="ov-section-title">Files</h2>
            <button className="ov-new-btn" onClick={onCreateFile}>+ New file</button>
          </div>
          {allFiles.length === 0 ? (
            <div className="ov-empty">
              <p>No markdown files yet.</p>
              <button className="ov-empty-btn" onClick={onCreateFile}>Create your first file →</button>
            </div>
          ) : (
            <div className="ov-files-grid">
              {allFiles.map((f) => {
                const name = baseName(f.path)
                const title = stripExt(name)
                const isActive = f.path === activeFile
                const changed = gitStatus?.files.find(gf => f.path.endsWith(gf.path.replace(/\//g, '\\')))
                  || gitStatus?.files.find(gf => f.path.endsWith(gf.path))
                const wc = wordCounts[f.path] ?? 0
                return (
                  <button
                    key={f.path}
                    className={`ov-file-card ${isActive ? 'ov-file-card--active' : ''}`}
                    onClick={() => onSelectFile(f.path)}
                    title={f.path}
                  >
                    <div className="ov-file-card-icon">
                      <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                        <path d="M2 2.5A1.5 1.5 0 013.5 1H11l5 5v11.5A1.5 1.5 0 0114.5 19h-11A1.5 1.5 0 012 17.5V2.5z"
                          fill={isActive ? 'var(--accent)' : 'var(--text-muted)'} fillOpacity={isActive ? 0.2 : 0.12}
                          stroke={isActive ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth="1.2" strokeLinejoin="round"/>
                        <path d="M11 1v5h5" stroke={isActive ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth="1.2" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="ov-file-card-name">{title}</span>
                    {wc > 0 && <span className="ov-file-card-wc">{wc >= 1000 ? `${(wc / 1000).toFixed(1)}k` : wc}w</span>}
                    {changed && <span className={`ov-badge ${statusLabel(changed).cls}`}>{statusLabel(changed).char}</span>}
                    {isActive && <span className="ov-file-card-active-dot" />}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Uncommitted changes */}
        {(gitStatus?.files?.length ?? 0) > 0 && (
          <section className="ov-section">
            <div className="ov-section-header">
              <h2 className="ov-section-title">Uncommitted changes</h2>
              {gitStatus!.ahead > 0 && (
                <span className="ov-push-pill">↑ {gitStatus!.ahead} to push</span>
              )}
            </div>
            <div className="ov-changes-list">
              {gitStatus!.files.map((file) => {
                const info = statusLabel(file)
                return (
                  <div key={file.path} className="ov-change-row">
                    <span className={`ov-badge ${info.cls}`}>{info.char}</span>
                    <span className="ov-change-path">{file.path}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .ov-page {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-sidebar);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .ov-hero {
          background: var(--bg-app);
          border-bottom: 1px solid var(--border);
          padding: 28px 40px 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          flex-shrink: 0;
        }
        .ov-hero-icon {
          width: 48px; height: 48px;
          border-radius: 10px;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ov-hero-info { flex: 1; min-width: 0; }
        .ov-workspace-name {
          font-size: 20px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.02em;
          margin: 0 0 4px;
        }
        .ov-workspace-path {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--text-muted); margin: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ov-hero-stats {
          display: flex; gap: 20px; align-items: center; flex-shrink: 0;
          padding-top: 4px;
        }
        .ov-stat {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          text-align: center;
        }
        .ov-stat-value {
          font-size: 16px; font-weight: 700; color: var(--text-primary);
          font-family: var(--font-mono);
        }
        .ov-stat-value--changed { color: var(--color-amber); }
        .ov-stat-value--ahead { color: var(--accent); }
        .ov-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }

        .ov-content {
          padding: 28px 40px;
          display: flex; flex-direction: column; gap: 32px;
          max-width: 900px; width: 100%;
        }
        .ov-section {}
        .ov-section-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
        }
        .ov-section-title {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.4px; margin: 0; flex: 1;
        }
        .ov-new-btn {
          font-size: 12px; font-weight: 500; color: var(--accent);
          background: var(--accent-bg); border: 1px solid transparent;
          padding: 4px 10px; border-radius: 5px;
          transition: background 0.1s;
        }
        .ov-new-btn:hover { background: var(--bg-selected); }
        .ov-push-pill {
          font-size: 11px; font-family: var(--font-mono);
          color: var(--accent); background: var(--accent-bg);
          padding: 2px 8px; border-radius: 20px;
        }

        /* Quick actions */
        .ov-actions-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ov-action-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s;
          text-align: left;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
        }
        .ov-action-card:hover {
          border-color: var(--accent);
          box-shadow: 0 2px 8px rgba(26,92,67,0.08);
        }
        .ov-action-icon {
          color: var(--accent);
          display: flex; align-items: center;
          flex-shrink: 0;
        }
        .ov-action-label { flex: 1; }
        .ov-action-shortcut {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 5px;
        }

        /* Files grid */
        .ov-files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .ov-file-card {
          display: flex; flex-direction: column; align-items: center;
          gap: 6px; padding: 16px 12px 10px;
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s;
          text-align: center; position: relative;
        }
        .ov-file-card:hover {
          border-color: var(--border-strong);
          box-shadow: 0 2px 8px rgba(15,15,15,0.06);
        }
        .ov-file-card--active {
          border-color: var(--accent);
          background: var(--accent-bg);
        }
        .ov-file-card-icon { flex-shrink: 0; }
        .ov-file-card-name {
          font-size: 12px; font-weight: 500;
          color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          width: 100%;
        }
        .ov-file-card-wc {
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .ov-file-card-active-dot {
          position: absolute; top: 8px; right: 8px;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
        }

        /* Changes list */
        .ov-changes-list {
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: 8px; overflow: hidden;
        }
        .ov-change-row {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 14px;
          border-bottom: 1px solid var(--border);
        }
        .ov-change-row:last-child { border-bottom: none; }
        .ov-change-path {
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-primary);
        }

        /* Badges */
        .ov-badge {
          font-family: var(--font-mono); font-size: 9px; font-weight: 700;
          width: 16px; height: 16px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 3px; flex-shrink: 0;
        }
        .ov-badge--modified  { background: var(--color-amber-bg); color: var(--color-amber); }
        .ov-badge--added     { background: var(--accent-bg); color: var(--accent); }
        .ov-badge--deleted   { background: var(--color-red-bg); color: var(--color-red); }
        .ov-badge--default   { background: var(--bg-selected); color: var(--text-muted); }

        /* Empty state */
        .ov-empty {
          background: var(--bg-app); border: 1px solid var(--border);
          border-radius: 8px; padding: 32px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          color: var(--text-muted); font-size: 13px; text-align: center;
        }
        .ov-empty-btn {
          color: var(--accent); font-size: 13px; background: transparent;
          text-decoration: underline; text-underline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
