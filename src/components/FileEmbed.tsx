import React, { useEffect, useState } from 'react'

interface FileEmbedProps {
  workspacePath: string
  relPath: string
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.css': 'css',
  '.md': 'markdown',
  '.sh': 'bash', '.bash': 'bash',
  '.html': 'html',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.go': 'go',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.php': 'php',
}

export function FileEmbed({ workspacePath, relPath }: FileEmbedProps) {
  const [result, setResult] = useState<{ content: string; lines: number; ext: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.fern.readWorkspaceFile(workspacePath, relPath).then((r) => {
      if (!r.success) {
        setError(r.error ?? 'Unknown error')
      } else {
        setResult({ content: r.content!, lines: r.lines!, ext: r.ext! })
        setError(null)
      }
    })
  }, [workspacePath, relPath])

  if (error) {
    return (
      <div className="fe-error">
        ⚠ File not found: {relPath}
      </div>
    )
  }

  if (!result) return <div className="fe-loading">Loading {relPath}…</div>

  const lang = EXT_TO_LANG[result.ext] ?? 'plaintext'

  return (
    <div className="fe-wrap">
      <div className="fe-header">
        <span className="fe-icon">📄</span>
        <span className="fe-path">{relPath}</span>
        <span className="fe-lines">({result.lines} ln)</span>
      </div>
      <pre className="fe-pre"><code className={`language-${lang}`}>{result.content}</code></pre>
      <style>{`
        .fe-wrap {
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          margin: 12px 0;
          font-family: var(--font-mono);
        }
        .fe-header {
          background: var(--bg-code);
          padding: 8px 14px;
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .fe-icon { font-size: 13px; }
        .fe-path { flex: 1; color: var(--text-secondary); }
        .fe-lines { color: var(--text-muted); }
        .fe-pre {
          background: var(--bg-code);
          margin: 0; padding: 14px 16px;
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 13px; line-height: 1.6;
          color: var(--text-primary);
        }
        .fe-pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
        .fe-error {
          display: flex; align-items: center;
          padding: 8px 12px;
          background: var(--color-red-bg); border-radius: 6px;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--color-red); margin: 8px 0;
        }
        .fe-loading {
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); padding: 8px 0;
        }
      `}</style>
    </div>
  )
}
