import React, { useMemo } from 'react'
import type { BlockState } from '../hooks/useExecutor'
import type { RuntimeVersions } from '../types/fern'

interface StatusBarProps {
  fileName: string | null
  blockStates: Record<string, BlockState>
  totalBlocks: number
  runtimeVersions: Partial<RuntimeVersions>
  content?: string
  showWordCount?: boolean
  vimMode?: boolean
}

function computeWordCount(text: string): { words: number; readMin: number } {
  // Strip fenced code blocks
  const stripped = text.replace(/^```[\s\S]*?^```/gm, '').trim()
  const words = stripped ? stripped.split(/\s+/).filter(Boolean).length : 0
  const readMin = Math.max(1, Math.round(words / 200))
  return { words, readMin }
}

export function StatusBar({
  fileName,
  blockStates,
  totalBlocks,
  runtimeVersions,
  content = '',
  showWordCount = true,
  vimMode = false,
}: StatusBarProps) {
  const ranCount = Object.values(blockStates).filter(
    (s) => s.status === 'success' || s.status === 'error'
  ).length
  const runningCount = Object.values(blockStates).filter((s) => s.status === 'running').length
  const hasRan = ranCount > 0

  const blockStatusText =
    totalBlocks === 0
      ? '0 blocks'
      : runningCount > 0
      ? `Running ${runningCount}…`
      : `${ranCount} of ${totalBlocks} ran`

  const wc = useMemo(() => computeWordCount(content), [content])

  const RUNTIME_ORDER: (keyof RuntimeVersions)[] = ['node', 'python', 'deno', 'bun', 'ruby', 'go', 'rust', 'php']
  const availableRuntimes = RUNTIME_ORDER
    .map((k) => ({ key: k, version: runtimeVersions[k] ?? null }))
    .filter((r) => r.version !== null)
  const visibleRuntimes = availableRuntimes.slice(0, 3)
  const extraCount = availableRuntimes.length - visibleRuntimes.length

  return (
    <div className="statusbar">
      <span className="statusbar-blocks">
        <span className={`statusbar-dot ${hasRan ? 'active' : ''}`} />
        {blockStatusText}
        {vimMode && <span className="statusbar-vim">VIM</span>}
      </span>
      <span className="statusbar-right">
        {showWordCount && content && (
          <>
            <span className="statusbar-version">{wc.words} words · {wc.readMin} min</span>
            <span className="statusbar-divider">·</span>
          </>
        )}
        {visibleRuntimes.map((r, i) => (
          <React.Fragment key={r.key}>
            {i > 0 && <span className="statusbar-divider">·</span>}
            <span className="statusbar-version">{r.key} {r.version}</span>
          </React.Fragment>
        ))}
        {extraCount > 0 && (
          <>
            <span className="statusbar-divider">·</span>
            <span className="statusbar-version">+{extraCount} more</span>
          </>
        )}
      </span>

      <style>{`
        .statusbar {
          height: 24px;
          background: var(--bg-sidebar);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 14px;
          gap: 16px;
          flex-shrink: 0;
          position: relative;
        }
        .statusbar-blocks {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          flex: 1;
        }
        .statusbar-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--border-strong);
          flex-shrink: 0;
          transition: background 0.3s;
        }
        .statusbar-dot.active {
          background: var(--accent);
        }
        .statusbar-vim {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--accent);
          background: var(--accent-bg);
          padding: 1px 5px;
          border-radius: 3px;
        }
        .statusbar-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
        .statusbar-version { color: var(--text-muted); }
        .statusbar-divider { color: var(--text-disabled); }
      `}</style>
    </div>
  )
}
