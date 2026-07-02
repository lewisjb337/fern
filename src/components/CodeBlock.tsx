import React, { useState, useCallback } from 'react'
import { OutputPanel } from './OutputPanel'
import type { BlockState } from '../hooks/useExecutor'
import type { PinnedOutput } from '../hooks/usePinnedOutputs'

interface CodeBlockProps {
  id: string
  runtime: string
  code: string
  runnable: boolean
  hidden?: boolean
  blockId?: string | null
  state: BlockState
  onRun: () => void
  onStop: () => void
  onClearOutput?: () => void
  onMakeRunnable?: () => void
  pinnedOutput?: PinnedOutput | null
  onPin?: (output: string) => void
  onUnpin?: () => void
  isRunAllPaused?: boolean
  onResolveRunAll?: (action: 'continue' | 'stop') => void
}

const RUNTIME_LABELS: Record<string, string> = {
  bash: 'Bash', sh: 'Shell', powershell: 'PowerShell', pwsh: 'PowerShell',
  node: 'Node.js', javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  python3: 'Python', python: 'Python',
  ruby: 'Ruby', rb: 'Ruby',
  go: 'Go',
  deno: 'Deno',
  php: 'PHP',
  perl: 'Perl',
  rust: 'Rust', rs: 'Rust',
}

const RUNTIME_COLORS: Record<string, string> = {
  bash: '#4EAA25', sh: '#4EAA25', powershell: '#2671BE', pwsh: '#2671BE',
  node: '#68A063', javascript: '#F7DF1E', js: '#F7DF1E',
  typescript: '#3178C6', ts: '#3178C6',
  python3: '#3776AB', python: '#3776AB',
  ruby: '#CC342D', rb: '#CC342D',
  go: '#00ADD8',
  deno: '#70FFAF',
  php: '#777BB4',
  perl: '#39457E',
  rust: '#CE4121', rs: '#CE4121',
}

export function CodeBlock({
  id, runtime, code, runnable, hidden, blockId, state,
  onRun, onStop, onClearOutput, onMakeRunnable,
  pinnedOutput, onPin, onUnpin, isRunAllPaused, onResolveRunAll,
}: CodeBlockProps) {
  const { status } = state
  const [copied, setCopied] = useState(false)
  const [showLines, setShowLines] = useState(false)

  const lines = code.trimEnd().split('\n')
  const rtKey = runtime.toLowerCase()
  const label = RUNTIME_LABELS[rtKey] ?? (runtime || 'Plain text')
  const accentColor = RUNTIME_COLORS[rtKey] ?? '#5A9E6F'

  const handleCopyCode = useCallback(async () => {
    await navigator.clipboard.writeText(code.trimEnd())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [code])

  function getRunLabel() {
    switch (status) {
      case 'running': return '■ Stop'
      case 'success': return '✓ Ran'
      case 'error':   return '✗ Error'
      default:        return '▶ Run'
    }
  }

  function handleRunClick() {
    if (status === 'running') onStop()
    else onRun()
  }

  return (
    <div className={`code-block-wrapper cb--${runnable ? status : 'static'}${hidden ? ' cb--hidden' : ''}`}>
      {/* Header */}
      <div className="code-block-header">
        <span className="cb-lang-dot" style={{ background: accentColor }} />
        <span className="cb-runtime">{label}</span>
        {runnable && <span className="cb-run-pill">run</span>}
        {blockId && <span className="cb-id-pill">id: {blockId}</span>}
        {hidden && <span className="cb-hidden-pill">hidden</span>}
        <span className="cb-line-count">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>

        <div className="cb-header-gap" />

        <button
          className="cb-icon-btn"
          title={showLines ? 'Hide line numbers' : 'Show line numbers'}
          onClick={() => setShowLines((v) => !v)}
        >
          {showLines ? '#̶' : '#'}
        </button>
        <button
          className="cb-icon-btn"
          title="Copy code"
          onClick={handleCopyCode}
        >
          {copied ? '✓' : '⎘'}
        </button>

        {runnable ? (
          <button
            className={`cb-run-btn cb-run-btn--${status}`}
            onClick={handleRunClick}
          >
            {getRunLabel()}
          </button>
        ) : (
          <button
            className="cb-make-runnable-btn"
            title="Add run annotation to make this block executable"
            onClick={onMakeRunnable}
          >
            ▶ Make runnable
          </button>
        )}
      </div>

      {/* Code body */}
      <pre className="cb-body">
        {showLines
          ? lines.map((line, i) => (
              <div key={i} className="cb-line">
                <span className="cb-line-num">{i + 1}</span>
                <span className="cb-line-text">{line}</span>
              </div>
            ))
          : <code>{code.trimEnd()}</code>
        }
      </pre>

      <OutputPanel
        state={state}
        onClear={onClearOutput}
        pinnedOutput={pinnedOutput}
        onPin={onPin}
        onUnpin={onUnpin}
        isRunAllPaused={isRunAllPaused}
        onResolveRunAll={onResolveRunAll}
      />

      <style>{`
        .code-block-wrapper {
          margin: 20px 0;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .code-block-wrapper.cb--hidden {
          border-style: dashed;
          border-color: var(--border-strong);
          opacity: 0.75;
        }
        .code-block-header {
          background: var(--bg-code);
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          border-bottom: 1px solid var(--border);
        }
        .cb-lang-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          opacity: 0.7;
        }
        .cb-runtime {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
        }
        .cb-run-pill {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--accent);
          background: var(--accent-bg);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .cb-id-pill {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--color-amber);
          background: var(--color-amber-bg);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .cb-hidden-pill {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--text-muted);
          background: transparent;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px dashed var(--border-strong);
        }
        .cb-line-count {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-disabled);
        }
        .cb-header-gap { flex: 1; }
        .cb-icon-btn {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          background: transparent;
          padding: 2px 5px;
          border-radius: 4px;
          line-height: 1;
          transition: color 0.1s, background 0.1s;
        }
        .cb-icon-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
        .cb-run-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 5px;
          transition: background 0.1s, color 0.1s;
          letter-spacing: 0.01em;
          flex-shrink: 0;
        }
        .cb-run-btn--idle    { background: var(--accent); color: #FFFFFF; border: 1px solid transparent; }
        .cb-run-btn--idle:hover { background: var(--accent-hover); }
        .cb-run-btn--running { background: var(--color-red); color: #FFFFFF; border: 1px solid transparent; }
        .cb-run-btn--success { background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(47,124,95,0.2); }
        .cb-run-btn--error   { background: var(--color-red-bg); color: var(--color-red); border: 1px solid rgba(224,62,62,0.2); }
        .cb-make-runnable-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 5px;
          background: transparent;
          color: var(--text-disabled);
          border: 1px dashed var(--border-strong);
          transition: background 0.1s, color 0.1s, border-color 0.1s;
          flex-shrink: 0;
        }
        .cb-make-runnable-btn:hover {
          background: var(--accent-bg);
          color: var(--accent);
          border-color: rgba(47,124,95,0.3);
        }

        /* Code body */
        .cb-body {
          background: var(--bg-code);
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-primary);
          overflow-x: auto;
          white-space: pre;
          margin: 0;
          border-top: none;
        }
        .cb-body code {
          font-family: inherit;
          background: none;
          padding: 0;
          color: inherit;
        }
        .cb-line {
          display: flex;
          gap: 0;
          white-space: pre;
        }
        .cb-line-num {
          color: var(--text-disabled);
          text-align: right;
          min-width: 32px;
          padding-right: 16px;
          user-select: none;
          flex-shrink: 0;
        }
        .cb-line-text { flex: 1; }
      `}</style>
    </div>
  )
}
