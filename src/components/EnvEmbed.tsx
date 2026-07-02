import React, { useState } from 'react'

interface EnvEmbedProps {
  varName: string
  envVars: Record<string, string>
}

function maskValue(val: string): string {
  const visible = val.slice(-4) || val
  const bullets = '•'.repeat(Math.max(8, val.length - 4))
  return bullets + visible
}

export function EnvEmbed({ varName, envVars }: EnvEmbedProps) {
  const [revealed, setRevealed] = useState(false)

  const value = envVars[varName]

  if (value === undefined) {
    return (
      <span className="env-embed env-embed--missing">
        ⚠ {varName} not found in .env
      </span>
    )
  }

  const handleReveal = () => {
    setRevealed(true)
    setTimeout(() => setRevealed(false), 3000)
  }

  return (
    <span className="env-embed">
      <span className="env-embed-key">{varName}:</span>
      <span className="env-embed-value" title="Visible only to you, locally">
        {revealed ? value : maskValue(value)}
      </span>
      <button
        className="env-embed-reveal"
        onClick={handleReveal}
        title="Visible only to you, locally"
      >
        {revealed ? '🙈' : '👁'}
      </button>
      <style>{`
        .env-embed {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--accent-bg);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 2px 8px;
          font-family: var(--font-mono); font-size: 0.85em;
          vertical-align: baseline;
        }
        .env-embed--missing {
          background: var(--color-red-bg);
          border-color: var(--border);
          color: var(--color-red);
        }
        .env-embed-key { color: var(--accent); font-weight: 600; }
        .env-embed-value { color: var(--text-primary); letter-spacing: 0.05em; }
        .env-embed-reveal {
          background: transparent; font-size: 11px;
          padding: 0 2px; line-height: 1; opacity: 0.6;
          transition: opacity 0.1s;
        }
        .env-embed-reveal:hover { opacity: 1; }
      `}</style>
    </span>
  )
}
