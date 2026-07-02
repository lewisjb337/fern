import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { WorkspaceSearchMatch } from '../types/fern'

interface WorkspaceSearchProps {
  folderPath: string | null
  onOpenFile: (path: string, line: number) => void
}

interface FileGroup {
  filePath: string
  fileName: string
  relativePath: string
  matches: WorkspaceSearchMatch[]
}

// Escape a string for safe use as literal regex
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightLine(line: string, query: string, caseSensitive: boolean, regex: boolean): React.ReactNode {
  if (!query) return line
  let re: RegExp
  try {
    re = new RegExp(regex ? query : escapeRegExp(query), caseSensitive ? 'g' : 'gi')
  } catch {
    return line
  }
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = re.exec(line)) !== null && guard < 500) {
    guard++
    if (m.index > last) parts.push(line.slice(last, m.index))
    parts.push(
      <span key={`${m.index}-${guard}`} className="ws-hl">{m[0]}</span>
    )
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++ // avoid infinite loop on empty match
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

export function WorkspaceSearch({ folderPath, onOpenFile }: WorkspaceSearchProps) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [results, setResults] = useState<WorkspaceSearchMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(async (q: string, cs: boolean, rx: boolean) => {
    if (!folderPath || !q.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }
    setSearching(true)
    try {
      const res = await window.fern.workspaceSearch(folderPath, q, { caseSensitive: cs, regex: rx })
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
      setHasSearched(true)
    }
  }, [folderPath])

  // Debounced search on query/option change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(query, caseSensitive, regex), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, caseSensitive, regex, runSearch])

  const groups = useMemo<FileGroup[]>(() => {
    const map = new Map<string, FileGroup>()
    for (const r of results) {
      let g = map.get(r.filePath)
      if (!g) {
        g = { filePath: r.filePath, fileName: r.fileName, relativePath: r.relativePath, matches: [] }
        map.set(r.filePath, g)
      }
      g.matches.push(r)
    }
    return Array.from(map.values())
  }, [results])

  const toggleCollapse = (filePath: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(filePath)) n.delete(filePath); else n.add(filePath)
      return n
    })
  }

  return (
    <div className="ws-page">
      <div className="ws-header">
        <div className="ws-input-row">
          <input
            ref={inputRef}
            className="ws-input"
            type="text"
            placeholder="Search across all files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          <button
            className={`ws-toggle ${caseSensitive ? 'ws-toggle--on' : ''}`}
            title="Match case"
            onClick={() => setCaseSensitive((v) => !v)}
          >Aa</button>
          <button
            className={`ws-toggle ${regex ? 'ws-toggle--on' : ''}`}
            title="Use regular expression"
            onClick={() => setRegex((v) => !v)}
          >.*</button>
        </div>
        {hasSearched && (
          <div className="ws-summary">
            {results.length === 0
              ? 'No results'
              : `${results.length} result${results.length === 1 ? '' : 's'} in ${groups.length} file${groups.length === 1 ? '' : 's'}`}
            {searching && ' · searching…'}
          </div>
        )}
      </div>

      <div className="ws-results">
        {!folderPath ? (
          <div className="ws-empty">Open a workspace to search.</div>
        ) : !query.trim() ? (
          <div className="ws-empty">Type to search across every markdown file in the workspace.</div>
        ) : hasSearched && results.length === 0 && !searching ? (
          <div className="ws-empty">No matches for “{query}”.</div>
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed.has(g.filePath)
            return (
              <div key={g.filePath} className="ws-group">
                <div className="ws-group-header" onClick={() => toggleCollapse(g.filePath)}>
                  <span className={`ws-chevron ${isCollapsed ? 'ws-chevron--collapsed' : ''}`}>▾</span>
                  <span className="ws-file-name">{g.fileName}</span>
                  <span className="ws-file-path">{g.relativePath}</span>
                  <span className="ws-file-count">{g.matches.length}</span>
                </div>
                {!isCollapsed && (
                  <div className="ws-matches">
                    {g.matches.map((mtc, i) => (
                      <div
                        key={`${mtc.lineNumber}-${i}`}
                        className="ws-match"
                        onClick={() => onOpenFile(mtc.filePath, mtc.lineNumber)}
                      >
                        <span className="ws-line-num">{mtc.lineNumber}</span>
                        <span className="ws-line-content">
                          {highlightLine(mtc.lineContent, query, caseSensitive, regex)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .ws-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-app);
          font-family: var(--font-sans);
        }
        .ws-header {
          padding: 16px 24px 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .ws-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ws-input {
          flex: 1;
          background: var(--bg-sidebar);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 7px 12px;
          font-size: 14px;
          color: var(--text-primary);
          font-family: var(--font-sans);
          outline: none;
        }
        .ws-input:focus { border-color: var(--accent); }
        .ws-toggle {
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 6px 9px;
          border-radius: 6px;
          border: 1px solid var(--border-strong);
          background: var(--bg-sidebar);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .ws-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ws-toggle--on {
          background: var(--accent-bg);
          color: var(--accent);
          border-color: rgba(47,124,95,0.35);
        }
        .ws-summary {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .ws-results {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0 40px;
        }
        .ws-empty {
          padding: 48px 24px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .ws-group { margin-bottom: 2px; }
        .ws-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 24px;
          cursor: pointer;
          user-select: none;
        }
        .ws-group-header:hover { background: var(--bg-hover); }
        .ws-chevron {
          font-size: 10px;
          color: var(--text-muted);
          transition: transform 0.1s;
          width: 10px;
        }
        .ws-chevron--collapsed { transform: rotate(-90deg); }
        .ws-file-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .ws-file-path {
          font-size: 11px;
          color: var(--text-muted);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ws-file-count {
          font-size: 11px;
          color: var(--text-muted);
          background: var(--bg-hover);
          border-radius: 10px;
          padding: 1px 8px;
        }
        .ws-matches { padding: 2px 0; }
        .ws-match {
          display: flex;
          gap: 12px;
          padding: 3px 24px 3px 42px;
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.5;
        }
        .ws-match:hover { background: var(--bg-hover); }
        .ws-line-num {
          color: var(--text-disabled);
          min-width: 32px;
          text-align: right;
          flex-shrink: 0;
          user-select: none;
        }
        .ws-line-content {
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          overflow: hidden;
        }
        .ws-hl {
          color: var(--accent);
          font-weight: 600;
          background: var(--accent-bg);
          border-radius: 2px;
        }
      `}</style>
    </div>
  )
}
