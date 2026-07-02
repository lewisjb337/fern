import React, { useState, useEffect, useRef, useMemo } from 'react'

export interface PaletteAction {
  id: string
  label: string
  description?: string
  shortcut?: string
  run: () => void
}

interface CommandPaletteProps {
  actions: PaletteAction[]
  onClose: () => void
}

function matches(action: PaletteAction, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return action.label.toLowerCase().includes(q) || (action.description?.toLowerCase().includes(q) ?? false)
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => actions.filter((a) => matches(a, query)),
    [actions, query]
  )

  useEffect(() => { setSelectedIndex(0) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const action = filtered[selectedIndex]
      if (action) { action.run(); onClose() }
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="cp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cp-panel">
        <input
          ref={inputRef}
          className="cp-input"
          placeholder="Run a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="cp-list" ref={listRef}>
          {filtered.length === 0 && <div className="cp-empty">No commands match</div>}
          {filtered.map((a, i) => (
            <div
              key={a.id}
              className={`cp-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseDown={() => { a.run(); onClose() }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="cp-item-main">
                <span className="cp-item-label">{a.label}</span>
                {a.description && <span className="cp-item-desc">{a.description}</span>}
              </div>
              {a.shortcut && <span className="cp-item-shortcut">{a.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .cp-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.45);
          z-index: 500;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 120px;
        }
        .cp-panel {
          width: 560px;
          background: var(--bg-app);
          border-radius: 8px;
          border: 1px solid var(--border-strong);
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          overflow: hidden;
        }
        .cp-input {
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
        .cp-input::placeholder { color: var(--text-disabled); }
        .cp-list {
          max-height: 400px;
          overflow-y: auto;
        }
        .cp-item {
          display: flex;
          align-items: center;
          padding: 9px 16px;
          cursor: pointer;
          gap: 8px;
        }
        .cp-item.selected { background: var(--bg-selected); }
        .cp-item:hover:not(.selected) { background: var(--bg-hover); }
        .cp-item-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .cp-item-label {
          font-size: 14px;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        .cp-item-desc {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-sans);
        }
        .cp-item-shortcut {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          background: var(--bg-hover);
          padding: 1px 6px;
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .cp-empty {
          padding: 20px 16px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
