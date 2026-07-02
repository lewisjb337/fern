import React, { useEffect, useState, useCallback, useRef } from 'react'
import { JsonTree } from './JsonTree'

interface ApiEmbedProps {
  method: string
  url: string
  workspacePath: string | null
  cacheDuration: number
  trusted: boolean | null
  onTrust: () => void
  onDeny: () => void
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'var(--accent)'
  if (code >= 300 && code < 400) return 'var(--color-amber)'
  return 'var(--color-red)'
}

function urlHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

export function ApiEmbed({ method, url, workspacePath, cacheDuration, trusted, onTrust, onDeny }: ApiEmbedProps) {
  const [result, setResult] = useState<{ data: unknown; status: number; fromCache: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const hasFetchedRef = useRef(false)

  const doFetch = useCallback(async (bypass = false) => {
    setLoading(true)
    setError(null)
    const duration = bypass ? 0 : cacheDuration
    const r = await window.fern.apiEmbedFetch(method, url, duration)
    if (!r.success) {
      setError(r.error ?? 'Fetch failed')
    } else {
      setResult({ data: r.data!, status: r.status!, fromCache: r.fromCache! })
    }
    setLoading(false)
  }, [method, url, cacheDuration])

  useEffect(() => {
    if (trusted !== true) return
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    doFetch()
  }, [trusted, doFetch])

  // Trust prompt
  if (trusted === null || trusted === false) {
    if (trusted === false) {
      return (
        <div className="ae-blocked">
          🌐 API embed blocked — enable in Settings
        </div>
      )
    }
    return (
      <div className="ae-trust-prompt">
        <div className="ae-trust-header">🌐 Network request</div>
        <p className="ae-trust-body">
          This document makes a network request to <strong>{urlHostname(url)}</strong>.
          Only allow this if you trust the source of this document.
        </p>
        <div className="ae-trust-actions">
          <button className="ae-deny-btn" onClick={onDeny}>Don't allow</button>
          <button className="ae-allow-btn" onClick={onTrust}>Allow for this workspace</button>
        </div>
      </div>
    )
  }

  const hostname = urlHostname(url)

  return (
    <div className="ae-wrap">
      <div className="ae-header">
        <span className="ae-icon">🌐</span>
        <span className="ae-method">{method.toUpperCase()}</span>
        <span className="ae-url">{hostname}</span>
        {result && (
          <span className="ae-status" style={{ color: statusColor(result.status) }}>
            {result.status} {result.status >= 200 && result.status < 300 ? '✓' : '✗'}
          </span>
        )}
        {result?.fromCache && <span className="ae-cached">cached</span>}
        <button
          className="ae-refresh-btn"
          title="Refresh (bypass cache)"
          onClick={() => {
            hasFetchedRef.current = false
            window.fern.apiEmbedInvalidate(url).then(() => doFetch(true))
          }}
        >
          ↻
        </button>
      </div>
      <div className="ae-body">
        {loading && <div className="ae-loading">Fetching…</div>}
        {error && <div className="ae-error">⚠ {error}</div>}
        {!loading && !error && result && (
          typeof result.data === 'string'
            ? <pre className="ae-raw">{result.data}</pre>
            : <JsonTree json={result.data as any} />
        )}
      </div>

      <style>{`
        .ae-wrap {
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          margin: 12px 0;
          font-family: var(--font-mono);
        }
        .ae-header {
          background: var(--bg-code);
          padding: 8px 14px;
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .ae-method { font-weight: 700; color: var(--text-primary); }
        .ae-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ae-status { font-weight: 600; flex-shrink: 0; }
        .ae-cached {
          font-size: 9px; color: var(--text-muted);
          background: var(--bg-hover); padding: 1px 5px; border-radius: 3px;
        }
        .ae-refresh-btn {
          background: transparent; color: var(--text-muted); font-size: 14px;
          padding: 0 4px; line-height: 1; flex-shrink: 0;
          transition: color 0.1s;
        }
        .ae-refresh-btn:hover { color: var(--text-primary); }
        .ae-body {
          background: var(--bg-code);
          padding: 10px 14px;
          max-height: 300px; overflow-y: auto;
        }
        .ae-loading { font-size: 12px; color: var(--text-muted); }
        .ae-error { font-size: 12px; color: var(--color-red); }
        .ae-raw { color: var(--text-secondary); font-size: 12px; line-height: 1.6; margin: 0; white-space: pre-wrap; }
        .ae-blocked {
          padding: 10px 14px;
          background: var(--bg-hover); border-radius: 6px;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); margin: 8px 0;
        }
        .ae-trust-prompt {
          border: 1px solid var(--border-strong); border-radius: 6px;
          padding: 16px; margin: 8px 0;
          background: var(--bg-app);
        }
        .ae-trust-header {
          font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;
        }
        .ae-trust-body {
          font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6;
        }
        .ae-trust-body strong { color: var(--text-primary); }
        .ae-trust-actions { display: flex; gap: 8px; }
        .ae-deny-btn {
          background: var(--bg-app); border: 1px solid var(--border-strong);
          font-size: 12px; color: var(--text-primary);
          padding: 6px 12px; border-radius: 6px;
        }
        .ae-deny-btn:hover { background: var(--bg-hover); }
        .ae-allow-btn {
          background: var(--text-primary); color: white;
          font-size: 12px; font-weight: 500;
          padding: 6px 12px; border-radius: 6px;
        }
        .ae-allow-btn:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
