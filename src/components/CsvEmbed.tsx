import React, { useEffect, useState } from 'react'
import { CsvTable } from './CsvTable'

interface CsvEmbedProps {
  workspacePath: string
  relPath: string
}

export function CsvEmbed({ workspacePath, relPath }: CsvEmbedProps) {
  const [csv, setCsv] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.fern.readWorkspaceFile(workspacePath, relPath).then((r) => {
      if (!r.success) {
        setError(r.error ?? 'Unknown error')
      } else {
        setCsv(r.content!)
        setError(null)
      }
    })
  }, [workspacePath, relPath])

  if (error) {
    return (
      <div className="csv-embed-error">
        ⚠ Could not load CSV: {relPath}
      </div>
    )
  }

  if (csv === null) return <div className="csv-embed-loading">Loading {relPath}…</div>

  return (
    <div className="csv-embed-wrap">
      <div className="csv-embed-header">
        <span>📊</span>
        <span>{relPath}</span>
      </div>
      <CsvTable csv={csv} />
      <style>{`
        .csv-embed-wrap {
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          margin: 12px 0;
        }
        .csv-embed-header {
          background: var(--bg-code);
          padding: 8px 14px;
          display: flex; align-items: center; gap: 8px;
          font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .csv-embed-error {
          padding: 8px 12px;
          background: var(--color-red-bg); border-radius: 6px;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--color-red); margin: 8px 0;
        }
        .csv-embed-loading {
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); padding: 8px 0;
        }
      `}</style>
    </div>
  )
}
