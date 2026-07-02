import React, { useState, useEffect } from 'react'
import type { FernSettings } from '../types/fern.d'

interface SettingsPanelProps {
  settings: FernSettings
  onUpdate: (patch: Partial<FernSettings>) => void
  onClose: () => void
  workspacePath?: string | null
  apiTrusted?: boolean | null
  onSetApiTrust?: (trusted: boolean) => void
  pageMode?: boolean
}

const CACHE_OPTIONS = [
  { value: 30,  label: '30 seconds' },
  { value: 60,  label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 0,   label: 'Never cache' },
]

export function SettingsPanel({ settings, onUpdate, onClose, workspacePath, apiTrusted, onSetApiTrust, pageMode }: SettingsPanelProps) {
  const [tokenInput, setTokenInput] = useState('')
  const [connectedUser, setConnectedUser] = useState<{ login: string; name?: string } | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    // Check if already connected
    window.fern.getGithubToken().then((token) => {
      if (token) {
        window.fern.githubWhoami().then((res) => {
          if (res.success && res.login) {
            setConnectedUser({ login: res.login, name: res.name })
          }
        })
      }
    })
  }, [])

  const handleConnect = async () => {
    if (!tokenInput.trim()) return
    setTokenLoading(true)
    setTokenError(null)
    await window.fern.setGithubToken(tokenInput.trim())
    const res = await window.fern.githubWhoami()
    if (res.success && res.login) {
      setConnectedUser({ login: res.login, name: res.name })
      setTokenInput('')
    } else {
      setTokenError(res.error ?? 'Could not verify token')
      await window.fern.setGithubToken(null)
    }
    setTokenLoading(false)
  }

  const handleDisconnect = async () => {
    await window.fern.setGithubToken(null)
    setConnectedUser(null)
    setTokenInput('')
  }

  const bodyContent = (
    <>
      {/* Appearance */}
      <div className="sp-section-label">Appearance</div>
      <div className="sp-card">
        <div className="sp-row sp-row--last">
          <span className="sp-label">Theme</span>
          <div className="sp-theme-btns">
            {(['light', 'system', 'dark'] as const).map((t) => (
              <button
                key={t}
                className={`sp-theme-btn ${(settings.theme ?? 'system') === t ? 'active' : ''}`}
                onClick={() => onUpdate({ theme: t })}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="sp-section-label">Editor</div>
      <div className="sp-card">
        <label className="sp-row">
          <span className="sp-label">Vim keybindings</span>
          <input type="checkbox" className="sp-toggle" checked={settings.vimMode}
            onChange={(e) => onUpdate({ vimMode: e.target.checked })} />
        </label>
        <label className="sp-row">
          <span className="sp-label">Font size</span>
          <div className="sp-slider-group">
            <input type="range" min={12} max={22} step={1} value={settings.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="sp-slider" />
            <span className="sp-val">{settings.fontSize}px</span>
          </div>
        </label>
        <label className="sp-row">
          <span className="sp-label">Line height</span>
          <div className="sp-slider-group">
            <input type="range" min={1.3} max={2.2} step={0.05} value={settings.lineHeight}
              onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} className="sp-slider" />
            <span className="sp-val">{settings.lineHeight.toFixed(2)}</span>
          </div>
        </label>
        <label className="sp-row">
          <span className="sp-label">Spell check</span>
          <input type="checkbox" className="sp-toggle" checked={settings.spellCheck ?? true}
            onChange={(e) => onUpdate({ spellCheck: e.target.checked })} />
        </label>
        <label className="sp-row sp-row--last">
          <span className="sp-label">Autosave delay</span>
          <div className="sp-slider-group">
            <input type="range" min={200} max={3000} step={100} value={settings.autosaveDelay}
              onChange={(e) => onUpdate({ autosaveDelay: Number(e.target.value) })} className="sp-slider" />
            <span className="sp-val">{settings.autosaveDelay}ms</span>
          </div>
        </label>
      </div>

      {/* Interface */}
      <div className="sp-section-label">Interface</div>
      <div className="sp-card">
        <label className="sp-row">
          <span className="sp-label">Show word count</span>
          <input type="checkbox" className="sp-toggle" checked={settings.showWordCount}
            onChange={(e) => onUpdate({ showWordCount: e.target.checked })} />
        </label>
        <label className="sp-row sp-row--last">
          <span className="sp-label">Show outline panel</span>
          <input type="checkbox" className="sp-toggle" checked={settings.showOutline}
            onChange={(e) => onUpdate({ showOutline: e.target.checked })} />
        </label>
      </div>

      {/* GitHub */}
      <div className="sp-section-label">GitHub</div>
      <div className="sp-card">
        {connectedUser ? (
          <div className="sp-row sp-row--col sp-row--last">
            <div className="sp-gh-connected">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div className="sp-gh-user">@{connectedUser.login}</div>
                {connectedUser.name && <div className="sp-gh-name">{connectedUser.name}</div>}
              </div>
            </div>
            <button className="sp-gh-disconnect" onClick={handleDisconnect}>Disconnect</button>
          </div>
        ) : (
          <div className="sp-row sp-row--col sp-row--last">
            <span className="sp-label">Personal access token</span>
            <div className="sp-gh-input-row">
              <input type="password" className="sp-text-input" placeholder="ghp_••••••••••••"
                value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConnect() }} />
              <button className="sp-gh-connect" onClick={handleConnect}
                disabled={tokenLoading || !tokenInput.trim()}>
                {tokenLoading ? '…' : 'Connect'}
              </button>
            </div>
            {tokenError && <span className="sp-gh-error">{tokenError}</span>}
          </div>
        )}
      </div>

      {/* Embeds & Network */}
      <div className="sp-section-label">Embeds & Network</div>
      <div className="sp-card">
        {workspacePath && (
          <div className="sp-row sp-row--col">
            <span className="sp-label">API embeds for this workspace</span>
            <div className="sp-embed-trust-btns">
              <button className={`sp-trust-btn ${apiTrusted === true ? 'active' : ''}`}
                onClick={() => onSetApiTrust?.(true)}>Allow</button>
              <button className={`sp-trust-btn sp-trust-btn--deny ${apiTrusted === false ? 'active' : ''}`}
                onClick={() => onSetApiTrust?.(false)}>Block</button>
              {apiTrusted === null && <span className="sp-trust-unset">Not set</span>}
            </div>
          </div>
        )}
        <label className="sp-row sp-row--last">
          <span className="sp-label">Cache duration</span>
          <select className="sp-select" value={settings.embedCacheDuration ?? 30}
            onChange={(e) => onUpdate({ embedCacheDuration: Number(e.target.value) })}>
            {CACHE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  )

  const sharedStyles = `
    .sp-header {
      display: flex; align-items: center;
      padding: 0 14px;
      height: 44px;
      border-bottom: 1px solid var(--border);
      gap: 9px;
      background: var(--bg-app);
      flex-shrink: 0;
    }
    .sp-title {
      flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary);
    }
    .sp-icon-btn {
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 5px; background: transparent;
      color: var(--text-muted); transition: background 0.1s, color 0.1s;
    }
    .sp-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .sp-body {
      padding: 16px 14px;
      overflow-y: auto; flex: 1;
      display: flex; flex-direction: column; gap: 4px;
    }
    .sp-section-label {
      font-size: 11px; font-weight: 600;
      letter-spacing: 0.3px; text-transform: uppercase;
      color: var(--text-muted);
      padding: 10px 2px 6px;
    }
    .sp-section-label:first-child { padding-top: 2px; }
    .sp-card {
      background: var(--bg-app);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .sp-row {
      display: flex; align-items: center;
      gap: 12px; padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .sp-row--col { flex-direction: column; align-items: flex-start; gap: 10px; cursor: default; }
    .sp-row--last { border-bottom: none; }
    .sp-label { flex: 1; font-size: 13px; color: var(--text-primary); line-height: 1.3; }
    .sp-val { color: var(--text-muted); font-size: 11px; font-family: var(--font-mono); min-width: 38px; text-align: right; flex-shrink: 0; }
    .sp-slider-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .sp-toggle { width: 34px; height: 18px; appearance: none; -webkit-appearance: none; background: var(--border-strong); border-radius: 9px; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
    .sp-toggle:checked { background: var(--accent); }
    .sp-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .sp-toggle:checked::after { transform: translateX(16px); }
    .sp-slider { width: 90px; accent-color: var(--accent); flex-shrink: 0; cursor: pointer; }
    .sp-select { font-size: 12px; color: var(--text-primary); background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 5px; padding: 5px 8px; flex-shrink: 0; }
    .sp-gh-input-row { display: flex; gap: 6px; width: 100%; }
    .sp-text-input { flex: 1; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 5px; padding: 6px 9px; font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); outline: none; transition: border-color 0.15s; }
    .sp-text-input:focus { border-color: var(--border-strong); background: var(--bg-app); }
    .sp-text-input::placeholder { color: var(--text-disabled); }
    .sp-gh-connect { background: var(--accent); color: white; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 5px; flex-shrink: 0; }
    .sp-gh-connect:disabled { opacity: 0.35; cursor: not-allowed; }
    .sp-gh-connect:not(:disabled):hover { background: var(--accent-hover); }
    .sp-gh-connected { display: flex; align-items: center; gap: 8px; width: 100%; }
    .sp-gh-user { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .sp-gh-name { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
    .sp-gh-disconnect { font-size: 11px; color: var(--color-red); background: transparent; padding: 3px 0; }
    .sp-gh-disconnect:hover { text-decoration: underline; }
    .sp-gh-error { font-size: 11px; color: var(--color-red); }
    .sp-embed-trust-btns { display: flex; gap: 6px; align-items: center; }
    .sp-trust-unset { font-size: 11px; color: var(--text-disabled); margin-left: 4px; }
    .sp-trust-btn { font-size: 12px; padding: 5px 12px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg-sidebar); color: var(--text-primary); transition: all 0.1s; }
    .sp-trust-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
    .sp-trust-btn--deny.active { background: var(--color-red); border-color: var(--color-red); }
    .sp-trust-btn:hover:not(.active) { background: var(--bg-hover); border-color: var(--border-strong); }
    .sp-theme-btns { display: flex; gap: 4px; }
    .sp-theme-btn { font-size: 12px; padding: 4px 10px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg-sidebar); color: var(--text-secondary); transition: all 0.1s; }
    .sp-theme-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
    .sp-theme-btn:hover:not(.active) { background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-primary); }
  `

  if (pageMode) {
    return (
      <div className="sp-page">
        <div className="sp-page-inner">
          <div className="sp-header" style={{ background: 'var(--bg-sidebar)', borderBottom: 'none', height: 'auto', padding: '24px 0 16px', position: 'sticky', top: 0 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 1.5v1.2M7.5 12.3v1.2M1.5 7.5h1.2M12.3 7.5h1.2M3.4 3.4l.85.85M10.75 10.75l.85.85M3.4 11.6l.85-.85M10.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="sp-title">Settings</span>
          </div>
          <div className="sp-body" style={{ padding: 0, overflow: 'visible' }}>
            {bodyContent}
          </div>
        </div>
        <style>{sharedStyles}</style>
        <style>{`
          .sp-page { flex: 1; overflow-y: auto; background: var(--bg-sidebar); display: flex; justify-content: center; }
          .sp-page-inner { width: 100%; max-width: 580px; padding: 0 40px 40px; display: flex; flex-direction: column; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="sp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sp-panel">
        <div className="sp-header">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7.5 1.5v1.2M7.5 12.3v1.2M1.5 7.5h1.2M12.3 7.5h1.2M3.4 3.4l.85.85M10.75 10.75l.85.85M3.4 11.6l.85-.85M10.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="sp-title">Settings</span>
          <button className="sp-icon-btn" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="sp-body">{bodyContent}</div>
      </div>
      <style>{sharedStyles}</style>
      <style>{`
        .sp-overlay { position: fixed; inset: 0; background: rgba(15,15,15,0.3); z-index: 400; display: flex; justify-content: flex-end; }
        .sp-panel { width: 320px; height: 100%; background: var(--bg-sidebar); border-left: 1px solid var(--border); box-shadow: -8px 0 24px rgba(15,15,15,0.07); display: flex; flex-direction: column; animation: sp-slide-in 0.18s ease; overflow: hidden; }
        @keyframes sp-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}
