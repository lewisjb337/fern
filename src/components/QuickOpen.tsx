import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { FileNode } from '../types/fern.d'

interface QuickOpenProps {
  files: FileNode[]
  onSelect: (filePath: string) => void
  onClose: () => void
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  function walk(nodes: FileNode[]) {
    for (const n of nodes) {
      if (n.type === 'file') result.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) qi++
  }
  return qi === q.length
}

function fuzzyScore(str: string, query: string): number {
  if (!query) return 0
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  // Prefer matches where characters appear consecutively
  let score = 0
  let si = 0
  for (let qi = 0; qi < q.length; qi++) {
    while (si < s.length && s[si] !== q[qi]) { score--; si++ }
    si++
  }
  return score
}

export function QuickOpen({ files, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allFiles = useMemo(() => flattenFiles(files), [files])

  const filtered = useMemo(() => {
    const matches = allFiles.filter((f) => fuzzyMatch(f.name, query) || fuzzyMatch(f.path, query))
    matches.sort((a, b) => fuzzyScore(b.name, query) - fuzzyScore(a.name, query))
    return matches.slice(0, 20)
  }, [allFiles, query])

  useEffect(() => { setSelectedIndex(0) }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIndex]) onSelect(filtered[selectedIndex].path) }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="qo-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="qo-panel">
        <input
          ref={inputRef}
          className="qo-input"
          placeholder="Open file…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="qo-list" ref={listRef}>
          {filtered.length === 0 && <div className="qo-empty">No files match</div>}
          {filtered.map((f, i) => (
            <div
              key={f.path}
              className={`qo-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseDown={() => onSelect(f.path)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="qo-item-name">{f.name.replace(/\.md$/, '')}</span>
              <span className="qo-item-path">{f.path}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .qo-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.45);
          z-index: 500;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 120px;
        }
        .qo-panel {
          width: 520px;
          background: var(--bg-app);
          border-radius: 8px;
          border: 1px solid var(--border-strong);
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          overflow: hidden;
        }
        .qo-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          font-family: var(--font-sans);
          color: var(--text-primary);
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--border);
          outline: none;
          box-sizing: border-box;
        }
        .qo-input::placeholder { color: var(--text-disabled); }
        .qo-list {
          max-height: 360px;
          overflow-y: auto;
        }
        .qo-item {
          display: flex;
          flex-direction: column;
          padding: 9px 16px;
          cursor: pointer;
          gap: 2px;
        }
        .qo-item.selected { background: var(--bg-selected); }
        .qo-item:hover:not(.selected) { background: var(--bg-hover); }
        .qo-item-name {
          font-size: 14px;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        .qo-item-path {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .qo-empty {
          padding: 20px 16px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
