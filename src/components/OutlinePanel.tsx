import React, { useMemo, useState, useEffect } from 'react'

interface Heading {
  level: number
  text: string
  line: number
}

interface OutlinePanelProps {
  content: string
  onJumpToLine?: (line: number) => void
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

function parseHeadings(content: string): Heading[] {
  const lines = content.split('\n')
  const result: Heading[] = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) result.push({ level: m[1].length, text: m[2].trim(), line: i + 1 })
  }
  return result
}

export function OutlinePanel({ content, onJumpToLine }: OutlinePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [visibleLine, setVisibleLine] = useState(0)
  const headings = useMemo(() => parseHeadings(content), [content])

  useEffect(() => {
    const handler = (e: Event) => {
      setVisibleLine((e as CustomEvent<{ line: number }>).detail.line)
    }
    window.addEventListener('fern:visible-line', handler)
    return () => window.removeEventListener('fern:visible-line', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      const idx = headings.findIndex((h) => stripInlineMarkdown(h.text) === text)
      if (idx !== -1) setVisibleLine(headings[idx].line)
    }
    window.addEventListener('fern:visible-heading', handler)
    return () => window.removeEventListener('fern:visible-heading', handler)
  }, [headings])

  const activeIdx = useMemo(() => {
    if (visibleLine === 0 || headings.length === 0) return -1
    let result = -1
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].line <= visibleLine) result = i
      else break
    }
    return result
  }, [headings, visibleLine])

  if (headings.length === 0) return null

  return (
    <div className="outline-panel">
      <div className="outline-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="outline-chevron">{collapsed ? '▸' : '▾'}</span>
        <span className="outline-title">Outline</span>
      </div>
      {!collapsed && (
        <div className="outline-list">
          {headings.map((h, i) => (
            <button
              key={i}
              className={`outline-item level-${h.level} ${i === activeIdx ? 'active' : ''}`}
              onClick={() => onJumpToLine?.(h.line)}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .outline-panel {
          border-top: 1px solid var(--border);
          padding: 4px 0;
        }
        .outline-header {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          cursor: pointer;
          user-select: none;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .outline-header:hover { color: var(--text-primary); }
        .outline-chevron { font-size: 10px; }
        .outline-title { flex: 1; }
        .outline-list {
          display: flex;
          flex-direction: column;
          padding: 2px 0 8px;
        }
        .outline-item {
          display: block;
          text-align: left;
          font-size: 12px;
          color: var(--text-secondary);
          background: transparent;
          padding: 3px 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 0;
          transition: background 0.1s, color 0.1s;
          border-left: 2px solid transparent;
        }
        .outline-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .outline-item.active {
          color: var(--accent);
          border-left-color: var(--accent);
          background: var(--accent-bg);
          font-weight: 700;
        }
        .outline-item.level-1 { font-weight: 600; color: var(--text-primary); }
        .outline-item.level-1.active { font-weight: 700; color: var(--accent); }
        .outline-item.level-2 { padding-left: 20px; }
        .outline-item.level-3 { padding-left: 30px; font-size: 11px; }
      `}</style>
    </div>
  )
}
