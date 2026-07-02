import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { GitHubIssue } from '../types/fern.d'

interface IssuesEmbedProps {
  filter: string
  workspacePath: string | null
  cacheDuration: number
}

export function IssuesEmbed({ filter, workspacePath, cacheDuration }: IssuesEmbedProps) {
  const [issues, setIssues] = useState<GitHubIssue[] | null>(null)
  const [meta, setMeta] = useState<{ owner?: string; repo?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const hasFetchedRef = useRef(false)

  const doFetch = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    setError(null)
    const r = await window.fern.githubListIssues(workspacePath, filter, cacheDuration)
    if (!r.success) {
      setError(r.error ?? 'Failed to load issues')
    } else {
      setIssues(r.issues ?? [])
      setMeta({ owner: r.owner, repo: r.repo })
    }
    setLoading(false)
  }, [workspacePath, filter, cacheDuration])

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    doFetch()
  }, [doFetch])

  const repoLabel = meta?.owner && meta?.repo ? `${meta.owner}/${meta.repo}` : ''
  const filterLabel = filter.trim()

  if (loading) return <div className="ie-loading">🐙 Loading issues…</div>

  if (error) {
    if (error.includes('No GitHub token')) {
      return <div className="ie-no-token">🐙 Connect GitHub in Settings to show issues</div>
    }
    return <div className="ie-error">⚠ Could not load issues: {error}</div>
  }

  if (!issues) return null

  const issueUrl = meta?.owner && meta?.repo
    ? `https://github.com/${meta.owner}/${meta.repo}/issues`
    : null

  return (
    <div className="ie-wrap">
      <div className="ie-header">
        <span className="ie-icon">🐙</span>
        <span className="ie-label">Issues · {filterLabel}</span>
        <span className="ie-count">({issues.length})</span>
        <button className="ie-refresh" title="Refresh" onClick={() => { hasFetchedRef.current = false; doFetch() }}>↻</button>
      </div>
      {issues.length === 0 ? (
        <div className="ie-empty">No issues found</div>
      ) : (
        <div className="ie-list">
          {issues.map((issue) => (
            <div
              key={issue.number}
              className="ie-issue"
              onClick={() => window.fern.openExternal(issue.url)}
            >
              <span className="ie-circle">○</span>
              <span className="ie-num">#{issue.number}</span>
              <span className="ie-title">{issue.title}</span>
            </div>
          ))}
        </div>
      )}
      {issueUrl && (
        <div className="ie-footer" onClick={() => window.fern.openExternal(issueUrl)}>
          View all {issues.length} issues on GitHub →
        </div>
      )}

      <style>{`
        .ie-wrap {
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          margin: 12px 0;
        }
        .ie-header {
          background: var(--bg-code);
          padding: 8px 14px;
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-sans); font-size: 12px; color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .ie-label { flex: 1; font-weight: 500; color: var(--text-primary); }
        .ie-count { color: var(--text-muted); }
        .ie-refresh {
          background: transparent; color: var(--text-muted); font-size: 14px;
          padding: 0 4px; line-height: 1;
        }
        .ie-refresh:hover { color: var(--text-primary); }
        .ie-list {}
        .ie-issue {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.1s;
        }
        .ie-issue:last-child { border-bottom: none; }
        .ie-issue:hover { background: var(--bg-hover); }
        .ie-circle { color: var(--accent); flex-shrink: 0; font-size: 14px; }
        .ie-num {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--text-muted); flex-shrink: 0; width: 36px;
        }
        .ie-title { font-size: 13px; color: var(--text-primary); }
        .ie-footer {
          padding: 8px 14px;
          font-size: 12px; color: var(--accent);
          border-top: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.1s;
        }
        .ie-footer:hover { background: var(--bg-hover); }
        .ie-empty {
          padding: 12px 14px; font-size: 12px; color: var(--text-muted);
        }
        .ie-loading, .ie-no-token, .ie-error {
          padding: 10px 14px;
          font-family: var(--font-sans); font-size: 12px;
          color: var(--text-muted);
        }
        .ie-error { color: var(--color-red); }
      `}</style>
    </div>
  )
}
