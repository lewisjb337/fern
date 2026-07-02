import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { BlockState } from '../hooks/useExecutor'
import { JsonTree } from './JsonTree'
import { CsvTable } from './CsvTable'

type OutputMode = 'auto' | 'json' | 'csv' | 'raw'

interface PinnedOutput {
  output: string
  pinnedAt: number
}

interface OutputPanelProps {
  state: BlockState
  onClear?: () => void
  pinnedOutput?: PinnedOutput | null
  onPin?: (output: string) => void
  onUnpin?: () => void
  isRunAllPaused?: boolean
  onResolveRunAll?: (action: 'continue' | 'stop') => void
}

function tryParseJSON(text: string) {
  try { return JSON.parse(text.trim()) } catch { return null }
}

function looksLikeCSV(text: string): boolean {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return false
  const cols = lines[0].split(',').length
  return cols > 1 && lines.every((l) => l.split(',').length === cols)
}

function formatPinnedTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function OutputPanel({
  state,
  onClear,
  pinnedOutput,
  onPin,
  onUnpin,
  isRunAllPaused,
  onResolveRunAll,
}: OutputPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [outputMode, setOutputMode] = useState<OutputMode>('auto')
  const [activeTab, setActiveTab] = useState<'live' | 'pinned'>('live')
  const [showModeMenu, setShowModeMenu] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.output])

  // Switch to live tab on new run
  useEffect(() => {
    if (state.status === 'running') setActiveTab('live')
  }, [state.status])

  const fullText = useMemo(() => state.output.map((l) => l.text).join(''), [state.output])

  const parsedJSON = useMemo(() => {
    if (state.status !== 'success') return null
    return tryParseJSON(fullText)
  }, [fullText, state.status])

  const isCSV = useMemo(() => {
    if (state.status !== 'success') return false
    return looksLikeCSV(fullText)
  }, [fullText, state.status])

  const handleCopyOutput = useCallback(async () => {
    await navigator.clipboard.writeText(fullText)
    setCopiedOutput(true)
    setTimeout(() => setCopiedOutput(false), 1500)
  }, [fullText])

  const handlePin = useCallback(() => {
    if (onPin) onPin(fullText)
    setActiveTab('pinned')
  }, [onPin, fullText])

  const handleCopyJSON = useCallback(async () => {
    await navigator.clipboard.writeText(fullText)
    setCopiedOutput(true)
    setTimeout(() => setCopiedOutput(false), 1500)
  }, [fullText])

  if (state.status === 'idle' && !pinnedOutput) return null

  const isSuccess = state.status === 'success'
  const exitLabel = state.exitCode === null ? null
    : state.exitCode === 0 ? '✓ exit 0'
    : `✗ exit ${state.exitCode}`

  const effectiveMode: OutputMode = outputMode === 'auto'
    ? (parsedJSON !== null ? 'json' : isCSV ? 'csv' : 'raw')
    : outputMode

  const hasRichOutput = parsedJSON !== null || isCSV
  const modeLabel = effectiveMode === 'json' ? 'JSON ▾' : effectiveMode === 'csv' ? 'CSV ▾' : 'Raw ▾'

  return (
    <div className="output-panel">
      <div className="output-header">
        <span className={`output-dot ${state.status}`} />
        <span className="output-label">Output</span>

        {/* Live / Pinned tabs */}
        {pinnedOutput && (
          <div className="output-tabs">
            <button className={`output-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live</button>
            <button className={`output-tab ${activeTab === 'pinned' ? 'active' : ''}`} onClick={() => setActiveTab('pinned')}>Pinned</button>
          </div>
        )}

        {state.duration !== null && activeTab === 'live' && (
          <span className="output-duration">{(state.duration / 1000).toFixed(2)}s</span>
        )}
        {exitLabel && activeTab === 'live' && (
          <span className={`output-exit-inline ${state.exitCode === 0 ? 'success' : 'error'}`}>{exitLabel}</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Output mode selector (when rich output detected) */}
        {hasRichOutput && activeTab === 'live' && state.status === 'success' && (
          <div className="output-mode-wrap">
            <button className="output-mode-btn" onClick={() => setShowModeMenu((s) => !s)}>{modeLabel}</button>
            {showModeMenu && (
              <div className="output-mode-menu" onMouseLeave={() => setShowModeMenu(false)}>
                {(['auto', 'json', 'csv', 'raw'] as OutputMode[]).map((m) => (
                  <button key={m} className={`output-mode-item ${outputMode === m ? 'active' : ''}`}
                    onClick={() => { setOutputMode(m); setShowModeMenu(false) }}>
                    {m === 'auto' ? 'Auto' : m === 'json' ? 'JSON tree' : m === 'csv' ? 'CSV table' : 'Raw text'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pin output button */}
        {isSuccess && onPin && activeTab === 'live' && (
          <button className="output-action-btn output-pin-btn" onClick={handlePin}>Pin output</button>
        )}

        {/* Copy JSON button */}
        {effectiveMode === 'json' && activeTab === 'live' && (
          <button className="output-action-btn" title="Copy JSON" onClick={handleCopyJSON}>
            {copiedOutput ? '✓' : 'Copy JSON'}
          </button>
        )}

        {/* Copy output button */}
        {state.output.length > 0 && effectiveMode !== 'json' && activeTab === 'live' && (
          <button className="output-action-btn" title="Copy output" onClick={handleCopyOutput}>
            {copiedOutput ? '✓' : '⎘'}
          </button>
        )}

        {onClear && state.status !== 'running' && activeTab === 'live' && (
          <button className="output-action-btn" title="Clear output" onClick={onClear}>✕</button>
        )}

        {activeTab === 'pinned' && onUnpin && (
          <button className="output-action-btn output-unpin-btn" onClick={onUnpin}>Unpin</button>
        )}
      </div>

      {/* Run-all error prompt */}
      {isRunAllPaused && state.status === 'error' && (
        <div className="output-pause-bar">
          <span className="output-pause-msg">✗ Exited with code {state.exitCode}</span>
          <button className="output-pause-btn continue" onClick={() => onResolveRunAll?.('continue')}>Continue anyway</button>
          <button className="output-pause-btn stop" onClick={() => onResolveRunAll?.('stop')}>Stop here</button>
        </div>
      )}

      {/* Live output */}
      {activeTab === 'live' && (
        <div className="output-body" ref={scrollRef}>
          {effectiveMode === 'json' && parsedJSON !== null ? (
            <JsonTree json={parsedJSON} />
          ) : effectiveMode === 'csv' && isCSV ? (
            <CsvTable csv={fullText} />
          ) : (
            <>
              {state.output.map((line, i) => (
                <span key={i} className={`output-line ${line.stream === 'stderr' ? 'stderr' : ''}`}>
                  {line.text.replace(/\x1b\[[0-9;]*[mGKHFABCDJsSu]/g, '')}
                </span>
              ))}
              {state.output.length === 0 && state.status !== 'running' && (
                <span className="output-empty">(no output)</span>
              )}
              {state.status === 'running' && state.output.length === 0 && (
                <span className="output-running">Running…</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Pinned output */}
      {activeTab === 'pinned' && pinnedOutput && (
        <div className="output-body pinned">
          <div className="pinned-timestamp">Pinned {formatPinnedTime(pinnedOutput.pinnedAt)}</div>
          <div className="pinned-text">{pinnedOutput.output}</div>
        </div>
      )}

      <style>{`
        .output-panel {
          background: var(--bg-sidebar);
          border-top: 1px solid var(--border);
          overflow: hidden;
          position: relative;
        }
        .output-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .output-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--border-strong);
        }
        .output-dot.running  { background: var(--color-amber); }
        .output-dot.success  { background: var(--accent); }
        .output-dot.error    { background: var(--color-red); }
        .output-label {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .output-tabs {
          display: flex;
          gap: 1px;
          background: var(--border);
          border-radius: 4px;
          padding: 1px;
        }
        .output-tab {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 3px;
          color: var(--text-muted);
          background: transparent;
          transition: background 0.1s, color 0.1s;
        }
        .output-tab.active { background: var(--bg-app); color: var(--text-primary); }
        .output-duration {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }
        .output-exit-inline {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 3px;
        }
        .output-exit-inline.success { color: var(--accent); background: var(--accent-bg); }
        .output-exit-inline.error   { color: var(--color-red); background: var(--color-red-bg); }
        .output-mode-wrap { position: relative; }
        .output-mode-btn {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
          background: var(--bg-hover);
          padding: 2px 6px;
          border-radius: 3px;
        }
        .output-mode-btn:hover { background: var(--bg-selected); }
        .output-mode-menu {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: 100;
          background: var(--bg-app);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(15,15,15,0.10);
          padding: 3px;
          min-width: 110px;
        }
        .output-mode-item {
          display: block;
          width: 100%;
          text-align: left;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-primary);
          padding: 4px 8px;
          border-radius: 4px;
        }
        .output-mode-item:hover { background: var(--bg-hover); }
        .output-mode-item.active { color: var(--accent); font-weight: 600; }
        .output-action-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-disabled);
          background: transparent;
          padding: 1px 5px;
          border-radius: 3px;
          transition: color 0.1s;
        }
        .output-action-btn:hover { color: var(--text-primary); }
        .output-pin-btn { color: var(--accent) !important; border: 1px solid rgba(47,124,95,0.25); }
        .output-pin-btn:hover { background: var(--accent-bg) !important; }
        .output-unpin-btn { color: var(--text-muted) !important; }
        /* Run-all pause bar */
        .output-pause-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          background: var(--color-red-bg);
          border-bottom: 1px solid rgba(224,62,62,0.2);
        }
        .output-pause-msg {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-red);
          flex: 1;
        }
        .output-pause-btn {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 4px;
        }
        .output-pause-btn.continue { background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(47,124,95,0.2); }
        .output-pause-btn.continue:hover { background: #daeee6; }
        .output-pause-btn.stop { background: var(--color-red-bg); color: var(--color-red); border: 1px solid rgba(224,62,62,0.2); }
        .output-pause-btn.stop:hover { background: #f5cccc; }
        /* Output body */
        .output-body {
          padding: 10px 12px;
          max-height: 260px;
          overflow-y: auto;
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-all;
          background: var(--bg-app);
        }
        .output-body.pinned { color: var(--accent); }
        .pinned-timestamp {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .pinned-text { color: var(--accent); }
        .output-line.stderr { color: var(--color-red); }
        .output-empty   { color: var(--text-disabled); font-style: italic; }
        .output-running { color: var(--color-amber); font-style: italic; }
      `}</style>
    </div>
  )
}
