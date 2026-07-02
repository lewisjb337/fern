import React, { useState, useEffect } from 'react'
import type { DiffHunk } from '../types/fern.d'

interface DiffViewProps {
  workspacePath: string
  filePath: string
  onClose: () => void
}

interface DiffLine {
  lineNum: string
  marker: string
  text: string
  type: 'added' | 'removed' | 'unchanged'
}

function buildLines(hunks: DiffHunk[]): DiffLine[] {
  const lines: DiffLine[] = []
  let leftLine = 1
  let rightLine = 1

  for (const hunk of hunks) {
    const hunkLines = hunk.value.replace(/\n$/, '').split('\n')
    for (const text of hunkLines) {
      if (hunk.added) {
        lines.push({ lineNum: String(rightLine++), marker: '+', text, type: 'added' })
      } else if (hunk.removed) {
        lines.push({ lineNum: String(leftLine++), marker: '-', text, type: 'removed' })
      } else {
        lines.push({ lineNum: String(rightLine++), marker: ' ', text, type: 'unchanged' })
        leftLine++
      }
    }
  }
  return lines
}

export function DiffView({ workspacePath, filePath, onClose }: DiffViewProps) {
  const [hunks, setHunks] = useState<DiffHunk[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const result = await window.fern.gitDiffFile(workspacePath, filePath)
      if (!result.success) {
        setError(result.error ?? 'Failed to load diff')
      } else {
        setHunks(result.hunks ?? [])
      }
      setLoading(false)
    }
    load()
  }, [workspacePath, filePath])

  const lines = hunks ? buildLines(hunks) : []

  return (
    <div className="dv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dv-modal">
        <div className="dv-header">
          <span className="dv-title">{fileName} — Diff vs HEAD</span>
          <button className="dv-close" onClick={onClose}>✕</button>
        </div>

        <div className="dv-body">
          {loading && <div className="dv-loading">Loading diff…</div>}
          {error && <div className="dv-error">⚠ {error}</div>}
          {!loading && !error && lines.length === 0 && (
            <div className="dv-empty">No changes (file is new or identical to HEAD)</div>
          )}
          {!loading && !error && lines.length > 0 && (
            <div className="dv-lines">
              {lines.map((line, i) => (
                <div key={i} className={`dv-line dv-line-${line.type}`}>
                  <span className="dv-line-num">{line.lineNum}</span>
                  <span className="dv-line-marker">{line.marker}</span>
                  <span className="dv-line-text">{line.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dv-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.45);
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dv-modal {
          width: 800px;
          height: 70vh;
          background: var(--bg-app);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: dv-in 0.15s ease;
        }
        @keyframes dv-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .dv-header {
          display: flex; align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .dv-title {
          flex: 1;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-secondary); font-weight: 500;
        }
        .dv-close {
          background: transparent; color: var(--text-muted); font-size: 13px;
          padding: 2px 6px; border-radius: 4px;
        }
        .dv-close:hover { color: var(--text-primary); background: var(--bg-hover); }
        .dv-body {
          flex: 1; overflow-y: auto; background: var(--bg-code);
        }
        .dv-loading, .dv-error, .dv-empty {
          padding: 24px;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); text-align: center;
        }
        .dv-error { color: var(--color-red); }
        .dv-lines { display: flex; flex-direction: column; }
        .dv-line {
          display: flex; align-items: baseline;
          padding: 1px 0;
          font-family: var(--font-mono); font-size: 13px; line-height: 1.6;
          white-space: pre;
        }
        .dv-line-added { background: var(--diff-added-bg); }
        .dv-line-removed { background: var(--diff-removed-bg); }
        .dv-line-unchanged { background: var(--bg-code); }
        .dv-line-num {
          color: var(--text-muted);
          font-size: 11px;
          width: 40px;
          text-align: right;
          padding: 0 10px 0 8px;
          user-select: none;
          flex-shrink: 0;
        }
        .dv-line-marker {
          width: 16px; flex-shrink: 0;
          color: var(--text-muted);
        }
        .dv-line-added .dv-line-num { color: var(--diff-added-text); }
        .dv-line-added .dv-line-marker { color: var(--diff-added-text); }
        .dv-line-added .dv-line-text { color: var(--diff-added-text); }
        .dv-line-removed .dv-line-num { color: var(--diff-removed-text); }
        .dv-line-removed .dv-line-marker { color: var(--diff-removed-text); }
        .dv-line-removed .dv-line-text { color: var(--diff-removed-text); }
        .dv-line-unchanged .dv-line-text { color: var(--text-secondary); }
        .dv-line-text { flex: 1; padding-right: 16px; }
      `}</style>
    </div>
  )
}
