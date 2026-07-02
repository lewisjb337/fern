import React, { useEffect, useState, useCallback } from 'react'
import type { FernRevision } from '../types/fern.d'

interface RevisionHistoryProps {
  filePath: string
  currentContent: string
  onRestore: (content: string) => void
  onClose: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function simpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: string[] = []
  const max = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < Math.min(max, 60); i++) {
    const o = oldLines[i] ?? ''
    const n = newLines[i] ?? ''
    if (o !== n) {
      if (o) result.push(`- ${o}`)
      if (n) result.push(`+ ${n}`)
    }
  }
  return result.length ? result.join('\n') : '(no differences)'
}

export function RevisionHistory({ filePath, currentContent, onRestore, onClose }: RevisionHistoryProps) {
  const [revisions, setRevisions] = useState<FernRevision[]>([])
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    window.fern.getRevisions(filePath).then(setRevisions)
  }, [filePath])

  const handleRestore = useCallback(() => {
    if (selected === null) return
    const rev = revisions[selected]
    if (rev) onRestore(rev.content)
    onClose()
  }, [selected, revisions, onRestore, onClose])

  const diff = selected !== null && revisions[selected]
    ? simpleDiff(revisions[selected].content, currentContent)
    : null

  return (
    <div className="rh-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rh-panel">
        <div className="rh-header">
          <span className="rh-title">Revision History</span>
          <button className="rh-close" onClick={onClose}>✕</button>
        </div>
        <div className="rh-body">
          <div className="rh-list">
            {revisions.length === 0 && <div className="rh-empty">No revisions saved yet.<br/>Revisions are saved automatically on each save.</div>}
            {revisions.map((rev, i) => (
              <div
                key={rev.ts}
                className={`rh-item ${selected === i ? 'selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="rh-time">{formatTime(rev.ts)}</span>
                <span className="rh-wc">{wordCount(rev.content)} words</span>
              </div>
            ))}
          </div>
          <div className="rh-preview">
            {diff !== null ? (
              <>
                <div className="rh-preview-label">Changes vs. current</div>
                <pre className="rh-diff">
                  {diff.split('\n').map((line, i) => (
                    <span key={i} className={line.startsWith('+') ? 'rh-diff-line-add' : line.startsWith('-') ? 'rh-diff-line-del' : ''}>
                      {line}{'\n'}
                    </span>
                  ))}
                </pre>
                <button className="rh-restore-btn" onClick={handleRestore}>Restore this version</button>
              </>
            ) : (
              <div className="rh-select-hint">Select a revision to preview</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rh-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.45);
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rh-panel {
          width: 720px;
          max-height: 520px;
          background: var(--bg-app);
          border-radius: 8px;
          border: 1px solid var(--border-strong);
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .rh-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .rh-title {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .rh-close {
          font-size: 12px;
          color: var(--text-muted);
          background: transparent;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .rh-close:hover { color: var(--text-primary); background: var(--bg-hover); }
        .rh-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .rh-list {
          width: 180px;
          border-right: 1px solid var(--border);
          overflow-y: auto;
          flex-shrink: 0;
        }
        .rh-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rh-item:hover { background: var(--bg-hover); }
        .rh-item.selected { background: var(--bg-selected); }
        .rh-time { font-size: 12px; color: var(--text-primary); }
        .rh-wc { font-size: 10px; color: var(--text-muted); }
        .rh-preview {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .rh-preview-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .rh-diff {
          flex: 1;
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          background: var(--bg-code);
          padding: 12px;
          border-radius: 6px;
          overflow-y: auto;
          color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .rh-diff-line-add { color: var(--accent-light); }
        .rh-diff-line-del { color: var(--color-red); }
        .rh-restore-btn {
          align-self: flex-start;
          background: var(--accent);
          color: white;
          font-size: 13px;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 500;
        }
        .rh-restore-btn:hover { background: var(--accent-hover); }
        .rh-select-hint {
          color: var(--text-muted);
          font-size: 13px;
          margin: auto;
        }
        .rh-empty {
          padding: 20px 12px;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.6;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
