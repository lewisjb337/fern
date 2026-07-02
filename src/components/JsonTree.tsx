import React, { useState } from 'react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

interface NodeProps {
  value: JsonValue
  depth: number
  label?: string
}

function typeColor(v: JsonValue): string {
  if (v === null) return 'var(--text-muted)'
  if (typeof v === 'string') return 'var(--accent)'
  if (typeof v === 'number') return 'var(--color-blue)'
  if (typeof v === 'boolean') return 'var(--color-amber)'
  return 'var(--text-primary)'
}

function JsonNode({ value, depth, label }: NodeProps) {
  const [open, setOpen] = useState(depth < 2)

  const prefix = label !== undefined ? (
    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{label}:{' '}</span>
  ) : null

  if (value === null) return <div className="jt-row"><span className="jt-indent" style={{ width: depth * 14 }} />{prefix}<span style={{ color: 'var(--text-muted)' }}>null</span></div>
  if (typeof value === 'string') return <div className="jt-row"><span className="jt-indent" style={{ width: depth * 14 }} />{prefix}<span style={{ color: typeColor(value) }}>"{value}"</span></div>
  if (typeof value === 'number' || typeof value === 'boolean') return <div className="jt-row"><span className="jt-indent" style={{ width: depth * 14 }} />{prefix}<span style={{ color: typeColor(value) }}>{String(value)}</span></div>

  if (Array.isArray(value)) {
    const summary = `[ ${value.length} ${value.length === 1 ? 'item' : 'items'} ]`
    return (
      <div>
        <div className="jt-row jt-collapsible" onClick={() => setOpen((o) => !o)}>
          <span className="jt-indent" style={{ width: depth * 14 }} />
          <span className="jt-toggle">{open ? '▾' : '▸'}</span>
          {prefix}
          <span style={{ color: 'var(--text-muted)' }}>{open ? '[' : summary}</span>
        </div>
        {open && value.map((item, i) => (
          <JsonNode key={i} value={item} depth={depth + 1} label={String(i)} />
        ))}
        {open && <div className="jt-row"><span className="jt-indent" style={{ width: depth * 14 }} /><span style={{ color: 'var(--text-muted)' }}>]</span></div>}
      </div>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, JsonValue>)
    const summary = `{ ${keys.length} ${keys.length === 1 ? 'key' : 'keys'} }`
    return (
      <div>
        <div className="jt-row jt-collapsible" onClick={() => setOpen((o) => !o)}>
          <span className="jt-indent" style={{ width: depth * 14 }} />
          <span className="jt-toggle">{open ? '▾' : '▸'}</span>
          {prefix}
          <span style={{ color: 'var(--text-muted)' }}>{open ? '{' : summary}</span>
        </div>
        {open && keys.map((k) => (
          <JsonNode key={k} value={(value as Record<string, JsonValue>)[k]} depth={depth + 1} label={k} />
        ))}
        {open && <div className="jt-row"><span className="jt-indent" style={{ width: depth * 14 }} /><span style={{ color: 'var(--text-muted)' }}>{'}'}</span></div>}
      </div>
    )
  }

  return null
}

interface JsonTreeProps {
  json: JsonValue
}

export function JsonTree({ json }: JsonTreeProps) {
  return (
    <div className="json-tree">
      <JsonNode value={json} depth={0} />
      <style>{`
        .json-tree {
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.7;
          padding: 10px 12px;
          background: var(--bg-code);
          overflow-x: auto;
        }
        .jt-row {
          display: flex;
          align-items: baseline;
          gap: 2px;
          white-space: nowrap;
        }
        .jt-collapsible { cursor: pointer; user-select: none; }
        .jt-collapsible:hover { background: var(--bg-hover); border-radius: 3px; }
        .jt-indent { display: inline-block; flex-shrink: 0; }
        .jt-toggle { width: 12px; flex-shrink: 0; color: var(--text-muted); font-size: 10px; }
      `}</style>
    </div>
  )
}
