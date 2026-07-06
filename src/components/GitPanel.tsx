import React, { useState, useEffect, useCallback } from 'react'
import type { GitFile, GitStatus, DiffHunk, GitCommit } from '../types/fern.d'

function buildDiffLines(hunks: DiffHunk[]) {
  const lines: { lineNum: string; marker: string; text: string; type: 'added' | 'removed' | 'unchanged' }[] = []
  let left = 1, right = 1
  for (const hunk of hunks) {
    for (const text of hunk.value.replace(/\n$/, '').split('\n')) {
      if (hunk.added)   { lines.push({ lineNum: String(right++), marker: '+', text, type: 'added' }); }
      else if (hunk.removed) { lines.push({ lineNum: String(left++), marker: '-', text, type: 'removed' }); }
      else              { lines.push({ lineNum: String(right++), marker: ' ', text, type: 'unchanged' }); left++; }
    }
  }
  return lines
}

interface GitPanelProps {
  workspacePath: string | null
  onOpenFile?: (filePath: string) => void
  onClose: () => void
  onOpenDiff?: (filePath: string) => void
  pageMode?: boolean
}

function statusInfo(file: GitFile): { char: string; label: string; cls: string } {
  const s = file.index !== ' ' && file.index !== '?' ? file.index : file.working_dir
  switch (s) {
    case 'M': return { char: 'M', label: 'Modified', cls: 'gp-badge--modified' }
    case 'A': return { char: 'A', label: 'Added',    cls: 'gp-badge--added' }
    case 'D': return { char: 'D', label: 'Deleted',  cls: 'gp-badge--deleted' }
    case 'R': return { char: 'R', label: 'Renamed',  cls: 'gp-badge--renamed' }
    case '?': return { char: 'U', label: 'Untracked',cls: 'gp-badge--added' }
    default:  return { char: s || '?', label: s,     cls: 'gp-badge--default' }
  }
}

function isStaged(file: GitFile): boolean {
  return file.index !== ' ' && file.index !== '?' && file.index !== undefined
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function parseShowDiff(raw: string): { header: string; lines: { marker: string; text: string; type: 'added' | 'removed' | 'context' | 'header' }[] } {
  const allLines = raw.split('\n')
  const headerLines: string[] = []
  const diffLines: { marker: string; text: string; type: 'added' | 'removed' | 'context' | 'header' }[] = []
  let inDiff = false
  for (const line of allLines) {
    if (!inDiff && (line.startsWith('diff --git') || line.startsWith('@@'))) inDiff = true
    if (!inDiff) { headerLines.push(line); continue }
    if (line.startsWith('+') && !line.startsWith('+++')) diffLines.push({ marker: '+', text: line.slice(1), type: 'added' })
    else if (line.startsWith('-') && !line.startsWith('---')) diffLines.push({ marker: '-', text: line.slice(1), type: 'removed' })
    else if (line.startsWith('@@')) diffLines.push({ marker: '', text: line, type: 'header' })
    else diffLines.push({ marker: ' ', text: line.slice(1), type: 'context' })
  }
  return { header: headerLines.slice(0, 4).join('\n'), lines: diffLines }
}

export function GitPanel({ workspacePath, onOpenFile, onClose, onOpenDiff, pageMode }: GitPanelProps) {
  const [gitTab, setGitTab] = useState<'changes' | 'history'>('changes')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [opInProgress, setOpInProgress] = useState<string | null>(null)
  const [noUpstreamPrompt, setNoUpstreamPrompt] = useState(false)
  const [diffFile, setDiffFile] = useState<string | null>(null)
  const [diffHunks, setDiffHunks] = useState<DiffHunk[] | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  // History tab state
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
  const [commitDiff, setCommitDiff] = useState<string | null>(null)
  const [commitDiffLoading, setCommitDiffLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!workspacePath) return
    setCommitsLoading(true)
    try {
      const result = await window.fern.gitLog(workspacePath)
      if (result.success) {
        setCommits(result.commits)
      } else {
        setError(result.error ?? 'Failed to load history')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCommitsLoading(false)
    }
  }, [workspacePath])

  useEffect(() => {
    if (gitTab === 'history') loadHistory()
  }, [gitTab, loadHistory])

  const handleCommitClick = async (commit: GitCommit) => {
    if (!workspacePath) return
    setSelectedCommit(commit)
    setCommitDiffLoading(true)
    setCommitDiff(null)
    try {
      const result = await window.fern.gitShow(workspacePath, commit.hash)
      if (result.success) {
        setCommitDiff(result.diff)
      } else {
        setError(result.error ?? 'Failed to load commit diff')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCommitDiffLoading(false)
    }
  }

  const refresh = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    try {
      const s = await window.fern.gitStatus(workspacePath)
      setStatus(s)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  useEffect(() => { refresh() }, [refresh])

  const handleCommit = async () => {
    if (!workspacePath || !message.trim()) return
    setOpInProgress('Committing…')
    setError(null)
    const result = await window.fern.gitCommit(workspacePath, message.trim())
    setOpInProgress(null)
    if (!result.success) {
      setError(result.error ?? 'Commit failed')
    } else {
      setMessage('')
      await refresh()
    }
  }

  const handlePush = async (setUpstream = false) => {
    if (!workspacePath) return
    setNoUpstreamPrompt(false)
    setOpInProgress('Pushing…')
    setError(null)
    const result = await window.fern.gitPush(workspacePath, setUpstream)
    setOpInProgress(null)
    if (!result.success) {
      const errMsg = result.error ?? ''
      if (errMsg.includes('no upstream') || errMsg.includes('set-upstream') || errMsg.includes('tracking')) {
        setNoUpstreamPrompt(true)
      } else {
        setError(errMsg || 'Push failed')
      }
    } else {
      await refresh()
    }
  }

  const handlePull = async () => {
    if (!workspacePath) return
    setOpInProgress('Pulling…')
    setError(null)
    const result = await window.fern.gitPull(workspacePath)
    setOpInProgress(null)
    if (!result.success) {
      setError(result.error ?? 'Pull failed')
    } else {
      await refresh()
    }
  }

  const handleInit = async () => {
    if (!workspacePath) return
    setOpInProgress('Initializing…')
    setError(null)
    const result = await window.fern.gitInit(workspacePath)
    setOpInProgress(null)
    if (!result.success) {
      setError(result.error ?? 'Init failed')
    } else {
      await refresh()
    }
  }

  const handleFileClick = async (file: GitFile) => {
    if (!workspacePath) return
    const base = (status?.gitRoot ?? workspacePath).replace(/[\\/]+$/, '')
    const fullPath = base + '/' + file.path.replace(/\\/g, '/')
    if (pageMode) {
      setDiffFile(file.path)
      setDiffHunks(null)
      setDiffError(null)
      setDiffLoading(true)
      const result = await window.fern.gitDiffFile(workspacePath, fullPath)
      setDiffLoading(false)
      if (!result.success) { setDiffError(result.error ?? 'Failed to load diff') }
      else { setDiffHunks(result.hunks ?? []) }
    } else {
      onOpenDiff?.(fullPath)
    }
  }

  const canCommit = message.trim().length > 0 && (status?.files?.length ?? 0) > 0

  const stagedFiles = status?.files.filter(isStaged) ?? []
  const unstagedFiles = status?.files.filter((f) => !isStaged(f)) ?? []

  const diffLines = diffHunks ? buildDiffLines(diffHunks) : []

  const historyPane = (
    <div className="gp-history-list">
      {commitsLoading && <div className="gp-loading">Loading history…</div>}
      {!commitsLoading && commits.length === 0 && (
        <div className="gp-no-changes">No commits yet</div>
      )}
      {commits.map((c) => (
        <div
          key={c.hash}
          className={`gp-commit-row ${selectedCommit?.hash === c.hash ? 'active' : ''}`}
          onClick={() => handleCommitClick(c)}
        >
          <div className="gp-commit-msg">{c.message}</div>
          <div className="gp-commit-meta">
            <span className="gp-commit-hash">{c.shortHash}</span>
            <span className="gp-commit-author">{c.author}</span>
            <span className="gp-commit-date">{relativeTime(c.date)}</span>
          </div>
        </div>
      ))}
    </div>
  )

  const fileList = (
    <div className={pageMode ? 'gp-page' : 'gp-panel'}>
        <div className="gp-header">
          <svg className="gp-header-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="11" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 4.5v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M4 4.5C4 4.5 4 6 6.5 6H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="gp-title">Source Control</span>
          <button className="gp-icon-btn" onClick={gitTab === 'changes' ? refresh : loadHistory} title="Refresh">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11 6.5A4.5 4.5 0 112.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M2.5 1.5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="gp-icon-btn" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="gp-tabs">
          <button className={`gp-tab ${gitTab === 'changes' ? 'active' : ''}`} onClick={() => setGitTab('changes')}>Changes</button>
          <button className={`gp-tab ${gitTab === 'history' ? 'active' : ''}`} onClick={() => setGitTab('history')}>History</button>
        </div>

        {gitTab === 'history' && historyPane}

        {gitTab === 'changes' && <>
        {/* Error banner */}
        {error && (
          <div className="gp-error-banner">
            <span>✗ {error}</span>
            <button className="gp-error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Op in progress */}
        {opInProgress && (
          <div className="gp-op-progress">{opInProgress}</div>
        )}

        {status === null && loading && (
          <div className="gp-loading">Loading…</div>
        )}

        {status !== null && !status.isRepo && (
          <div className="gp-no-repo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
              <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="8" cy="26" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="24" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M8 9v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M8 9C8 9 8 14 14 14H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <p>Not a git repository</p>
            <button className="gp-init-btn" onClick={handleInit}>Initialize repository</button>
          </div>
        )}

        {status !== null && status.isRepo && (
          <>
            {/* Branch card */}
            <div className="gp-branch-card">
              <div className="gp-branch-row">
                <span className="gp-branch-icon">⎇</span>
                <span className="gp-branch-name">{status.branch ?? 'unknown'}</span>
              </div>
              <div className="gp-sync-row">
                {status.ahead > 0 && (
                  <span className="gp-sync-pill gp-sync-pill--ahead">↑ {status.ahead} to push</span>
                )}
                {status.behind > 0 && (
                  <span className="gp-sync-pill gp-sync-pill--behind">↓ {status.behind} to pull</span>
                )}
                {status.ahead === 0 && status.behind === 0 && (
                  <span className="gp-sync-pill gp-sync-pill--ok">✓ Up to date</span>
                )}
              </div>
            </div>

            {/* Files */}
            <div className="gp-files-scroll">
              {status.files.length === 0 ? (
                <div className="gp-no-changes">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.35, marginBottom: 6 }}>
                    <path d="M10 3.5v7M10 13.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  No changes
                </div>
              ) : (
                <>
                  {stagedFiles.length > 0 && (
                    <div className="gp-file-group">
                      <div className="gp-file-group-label">Staged</div>
                      {stagedFiles.map((file) => {
                        const info = statusInfo(file)
                        return (
                          <div key={file.path} className="gp-file" onClick={() => handleFileClick(file)}>
                            <span className={`gp-badge ${info.cls}`}>{info.char}</span>
                            <span className="gp-file-name" title={file.path}>{file.path}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {unstagedFiles.length > 0 && (
                    <div className="gp-file-group">
                      <div className="gp-file-group-label">Changes</div>
                      {unstagedFiles.map((file) => {
                        const info = statusInfo(file)
                        return (
                          <div key={file.path} className="gp-file" onClick={() => handleFileClick(file)}>
                            <span className={`gp-badge ${info.cls}`}>{info.char}</span>
                            <span className="gp-file-name" title={file.path}>{file.path}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Commit */}
            <div className="gp-commit-area">
              <textarea
                className="gp-commit-input"
                placeholder="Summary (required)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    if (canCommit) handleCommit()
                  }
                }}
              />
              <button className="gp-commit-btn" onClick={handleCommit} disabled={!canCommit}>
                Commit all changes
              </button>
            </div>

            {/* No upstream prompt */}
            {noUpstreamPrompt && (
              <div className="gp-upstream-prompt">
                <span>No upstream branch set.</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="gp-confirm-btn" onClick={() => handlePush(true)}>Push & set upstream</button>
                  <button className="gp-cancel-btn" onClick={() => setNoUpstreamPrompt(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Push / Pull */}
            <div className="gp-actions">
              <button className="gp-action-btn gp-action-btn--push" onClick={() => handlePush(false)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 9V2M4 4.5L6.5 2 9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Push
              </button>
              <button className="gp-action-btn" onClick={handlePull}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 4v7M4 8.5L6.5 11 9 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5 2h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Pull
              </button>
            </div>
          </>
        )}
        </>}
    </div>
  )

  const sharedCss = `
        .gp-header {
          display: flex;
          align-items: center;
          padding: 0 12px;
          height: 44px;
          border-bottom: 1px solid var(--border);
          gap: 8px;
          flex-shrink: 0;
        }
        .gp-header-icon { color: var(--text-muted); flex-shrink: 0; }
        .gp-title {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .gp-icon-btn {
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 5px; background: transparent;
          color: var(--text-muted); transition: background 0.1s, color 0.1s;
          flex-shrink: 0;
        }
        .gp-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .gp-error-banner {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 8px 14px;
          background: var(--color-red-bg);
          border-bottom: 1px solid rgba(224,62,62,0.15);
          font-size: 11px; color: var(--color-red); flex-shrink: 0;
        }
        .gp-error-banner span { flex: 1; line-height: 1.4; }
        .gp-error-dismiss { background: transparent; color: var(--color-red); font-size: 11px; padding: 0 2px; flex-shrink: 0; }
        .gp-op-progress {
          padding: 7px 14px;
          font-size: 11px; color: var(--accent);
          background: var(--accent-bg);
          border-bottom: 1px solid rgba(47,124,95,0.12);
          flex-shrink: 0;
        }
        .gp-loading {
          padding: 24px 16px; font-size: 13px; color: var(--text-muted); text-align: center;
        }
        .gp-no-repo {
          flex: 1;
          padding: 0 24px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          font-size: 13px; color: var(--text-secondary); text-align: center;
        }
        .gp-init-btn {
          background: var(--accent); color: white; font-size: 12px;
          padding: 7px 16px; border-radius: 6px; font-weight: 500;
          margin-top: 4px;
        }
        .gp-init-btn:hover { background: var(--accent-hover); }

        /* Branch card */
        .gp-branch-card {
          padding: 12px 14px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .gp-branch-row {
          display: flex; align-items: center; gap: 7px;
        }
        .gp-branch-icon { color: var(--text-muted); font-size: 14px; }
        .gp-branch-name {
          font-family: var(--font-mono); font-size: 13px;
          color: var(--text-primary); font-weight: 500;
        }
        .gp-sync-row { display: flex; gap: 6px; }
        .gp-sync-pill {
          font-size: 10px; font-weight: 500;
          padding: 2px 7px; border-radius: 20px;
          font-family: var(--font-mono);
        }
        .gp-sync-pill--ahead { background: var(--accent-bg); color: var(--accent); }
        .gp-sync-pill--behind { background: var(--color-amber-bg); color: var(--color-amber); }
        .gp-sync-pill--ok { background: var(--bg-selected); color: var(--text-muted); }

        /* Files */
        .gp-files-scroll { flex: 1; overflow-y: auto; }
        .gp-no-changes {
          padding: 32px 16px;
          display: flex; flex-direction: column; align-items: center;
          font-size: 12px; color: var(--text-muted); text-align: center;
        }
        .gp-file-group { padding: 6px 0 2px; }
        .gp-file-group-label {
          padding: 4px 14px 4px;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.4px; text-transform: uppercase;
          color: var(--text-disabled);
        }
        .gp-file {
          display: flex; align-items: center; gap: 9px;
          padding: 5px 14px; cursor: pointer;
          transition: background 0.08s;
        }
        .gp-file:hover { background: var(--bg-hover); }
        .gp-badge {
          font-family: var(--font-mono); font-size: 9px; font-weight: 700;
          width: 16px; height: 16px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 3px; flex-shrink: 0; letter-spacing: 0;
        }
        .gp-badge--modified  { background: var(--color-amber-bg); color: var(--color-amber); }
        .gp-badge--added     { background: var(--accent-bg); color: var(--accent); }
        .gp-badge--deleted   { background: var(--color-red-bg); color: var(--color-red); }
        .gp-badge--renamed   { background: var(--color-blue-bg); color: var(--color-blue); }
        .gp-badge--default   { background: var(--bg-selected); color: var(--text-muted); }
        .gp-file-name {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          flex: 1;
        }

        /* Commit */
        .gp-commit-area {
          padding: 12px 14px;
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 8px;
          flex-shrink: 0;
        }
        .gp-commit-input {
          width: 100%; box-sizing: border-box;
          background: var(--bg-sidebar); border: 1px solid var(--border);
          border-radius: 6px; padding: 8px 10px;
          font-family: var(--font-sans); font-size: 12px;
          color: var(--text-primary); resize: none; outline: none;
          transition: border-color 0.15s; line-height: 1.5;
        }
        .gp-commit-input:focus { border-color: var(--border-strong); background: var(--bg-app); }
        .gp-commit-input::placeholder { color: var(--text-disabled); }
        .gp-commit-btn {
          background: var(--accent); color: white;
          font-size: 12px; font-weight: 500;
          padding: 8px 14px; border-radius: 6px;
          width: 100%;
          transition: opacity 0.15s, background 0.15s;
        }
        .gp-commit-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .gp-commit-btn:not(:disabled):hover { background: var(--accent-hover); }

        /* Upstream prompt */
        .gp-upstream-prompt {
          padding: 10px 14px;
          background: var(--color-amber-bg);
          border-top: 1px solid rgba(217,115,13,0.15);
          font-size: 11px; color: var(--color-amber);
          flex-shrink: 0; line-height: 1.4;
        }
        .gp-confirm-btn {
          background: var(--accent); color: white;
          font-size: 11px; padding: 5px 10px; border-radius: 5px; font-weight: 500;
        }
        .gp-confirm-btn:hover { background: var(--accent-hover); }
        .gp-cancel-btn {
          background: transparent; color: var(--text-secondary);
          font-size: 11px; padding: 5px 10px; border-radius: 5px;
          border: 1px solid var(--border-strong);
        }
        .gp-cancel-btn:hover { background: var(--bg-hover); }

        /* Push / Pull */
        .gp-actions {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .gp-action-btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 5px;
          background: var(--bg-sidebar); border: 1px solid var(--border);
          font-size: 12px; font-weight: 500; color: var(--text-primary);
          padding: 7px 12px; border-radius: 6px;
          transition: background 0.1s, border-color 0.1s;
        }
        .gp-action-btn:hover { background: var(--bg-hover); border-color: var(--border-strong); }
        .gp-action-btn--push { }
        .gp-page {
          width: 300px; flex-shrink: 0;
          display: flex; flex-direction: column;
          background: var(--bg-app); overflow: hidden;
          border-right: 1px solid var(--border);
        }
        .gp-panel {
          width: 300px; height: 100%;
          background: var(--bg-app);
          border-left: 1px solid var(--border);
          box-shadow: -8px 0 24px rgba(15,15,15,0.07);
          display: flex; flex-direction: column;
          animation: gp-slide-in 0.18s ease; overflow: hidden;
        }
        @keyframes gp-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        /* Inline diff */
        .gp-diff-pane {
          flex: 1; display: flex; flex-direction: column; overflow: hidden;
          background: var(--bg-app);
        }
        .gp-diff-header {
          display: flex; align-items: center; gap: 8px;
          padding: 0 16px; height: 44px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .gp-diff-filename {
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-secondary); flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gp-diff-close {
          background: transparent; color: var(--text-muted); font-size: 13px;
          padding: 2px 6px; border-radius: 4px;
        }
        .gp-diff-close:hover { color: var(--text-primary); background: var(--bg-hover); }
        .gp-diff-body { flex: 1; overflow-y: auto; background: var(--bg-code); }
        .gp-diff-placeholder {
          flex: 1; display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 8px;
          color: var(--text-muted); font-size: 13px;
          background: var(--bg-sidebar);
        }
        .gp-diff-loading, .gp-diff-error, .gp-diff-empty {
          padding: 24px; font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); text-align: center;
        }
        .gp-diff-error { color: var(--color-red); }
        .gp-diff-lines { display: flex; flex-direction: column; }
        .gp-diff-line {
          display: flex; align-items: baseline; padding: 1px 0;
          font-family: var(--font-mono); font-size: 12px; line-height: 1.6; white-space: pre;
        }
        .gp-diff-line-added { background: var(--diff-added-bg); }
        .gp-diff-line-removed { background: var(--diff-removed-bg); }
        .gp-diff-line-unchanged { background: var(--bg-code); }
        .gp-diff-lnum { color: var(--text-muted); font-size: 11px; width: 40px; text-align: right; padding: 0 10px 0 8px; user-select: none; flex-shrink: 0; }
        .gp-diff-marker { width: 16px; flex-shrink: 0; color: var(--text-muted); }
        .gp-diff-line-added .gp-diff-lnum, .gp-diff-line-added .gp-diff-marker, .gp-diff-line-added .gp-diff-text { color: var(--diff-added-text); }
        .gp-diff-line-removed .gp-diff-lnum, .gp-diff-line-removed .gp-diff-marker, .gp-diff-line-removed .gp-diff-text { color: var(--diff-removed-text); }
        .gp-diff-line-unchanged .gp-diff-text { color: var(--text-secondary); }
        .gp-diff-text { flex: 1; padding-right: 16px; }
        .gp-diff-line-hunk { background: var(--bg-hover); }
        .gp-diff-line-hunk .gp-diff-text { color: var(--text-muted); font-style: italic; }

        /* Tabs */
        .gp-tabs {
          display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .gp-tab {
          flex: 1; padding: 8px 0;
          font-size: 12px; font-weight: 500; color: var(--text-muted);
          background: transparent; border-bottom: 2px solid transparent;
          transition: color 0.1s, border-color 0.1s;
        }
        .gp-tab:hover { color: var(--text-secondary); }
        .gp-tab.active { color: var(--text-primary); border-bottom-color: var(--accent); }

        /* History list */
        .gp-history-list { flex: 1; overflow-y: auto; }
        .gp-commit-row {
          padding: 9px 14px; cursor: pointer; border-bottom: 1px solid var(--border);
          transition: background 0.08s;
        }
        .gp-commit-row:hover { background: var(--bg-hover); }
        .gp-commit-row.active { background: var(--accent-bg); }
        .gp-commit-msg {
          font-size: 12px; color: var(--text-primary); line-height: 1.4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        .gp-commit-meta { display: flex; gap: 8px; align-items: center; }
        .gp-commit-hash { font-family: var(--font-mono); font-size: 10px; color: var(--accent); }
        .gp-commit-author { font-size: 11px; color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gp-commit-date { font-size: 11px; color: var(--text-disabled); flex-shrink: 0; }
  `

  if (pageMode) {
    const activeDiff = gitTab === 'changes' ? diffFile : selectedCommit?.hash ?? null
    const parsedCommitDiff = commitDiff ? parseShowDiff(commitDiff) : null

    return (
      <div className="gp-page-wrapper">
        <style>{sharedCss}</style>
        <style>{`.gp-page-wrapper { flex: 1; display: flex; overflow: hidden; background: var(--bg-app); }`}</style>
        {fileList}
        {activeDiff ? (
          <div className="gp-diff-pane">
            <div className="gp-diff-header">
              {gitTab === 'changes' ? (
                <>
                  <span className="gp-diff-filename">{diffFile} — diff vs HEAD</span>
                  <button className="gp-diff-close" onClick={() => setDiffFile(null)}>✕</button>
                </>
              ) : selectedCommit ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <span className="gp-diff-filename" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedCommit.message}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {selectedCommit.shortHash} · {selectedCommit.author} · {relativeTime(selectedCommit.date)}
                    </span>
                  </div>
                  <button className="gp-diff-close" onClick={() => setSelectedCommit(null)}>✕</button>
                </>
              ) : null}
            </div>
            <div className="gp-diff-body">
              {(diffLoading || commitDiffLoading) && <div className="gp-diff-loading">Loading…</div>}
              {diffError && <div className="gp-diff-error">⚠ {diffError}</div>}
              {/* Changes tab diff */}
              {gitTab === 'changes' && !diffLoading && !diffError && diffLines.length === 0 && (
                <div className="gp-diff-empty">No changes (new file or identical to HEAD)</div>
              )}
              {gitTab === 'changes' && !diffLoading && !diffError && diffLines.length > 0 && (
                <div className="gp-diff-lines">
                  {diffLines.map((line, i) => (
                    <div key={i} className={`gp-diff-line gp-diff-line-${line.type}`}>
                      <span className="gp-diff-lnum">{line.lineNum}</span>
                      <span className="gp-diff-marker">{line.marker}</span>
                      <span className="gp-diff-text">{line.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* History tab diff */}
              {gitTab === 'history' && !commitDiffLoading && parsedCommitDiff && (
                <div className="gp-diff-lines">
                  {parsedCommitDiff.lines.map((line, i) => (
                    <div key={i} className={`gp-diff-line ${line.type === 'added' ? 'gp-diff-line-added' : line.type === 'removed' ? 'gp-diff-line-removed' : line.type === 'header' ? 'gp-diff-line-hunk' : 'gp-diff-line-unchanged'}`}>
                      <span className="gp-diff-marker">{line.marker}</span>
                      <span className="gp-diff-text">{line.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="gp-diff-placeholder">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.25 }}>
              <path d="M6 4h11l7 7v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M17 4v7h7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span>{gitTab === 'changes' ? 'Select a file to see changes' : 'Select a commit to see diff'}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="gp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <style>{sharedCss}</style>
      <style>{`.gp-overlay { position: fixed; inset: 0; background: rgba(15,15,15,0.3); z-index: 400; display: flex; justify-content: flex-end; }`}</style>
      {fileList}
    </div>
  )
}
