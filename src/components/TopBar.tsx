import React, { useState, useEffect } from 'react'
import { FernLogo } from './FernLogo'

export type ViewMode = 'edit' | 'split' | 'preview'
export type AppPage = 'editor' | 'overview' | 'git' | 'settings' | 'revisions' | 'search'

const IS_WINDOWS = navigator.platform.startsWith('Win')

interface TopBarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onRunAll: () => void
  isRunningAll: boolean
  isRunAllPaused?: boolean
  hasFile: boolean
  fileName?: string | null
  activePage: AppPage
}

export function TopBar({
  viewMode,
  onViewModeChange,
  onRunAll,
  isRunningAll,
  isRunAllPaused,
  hasFile,
  fileName,
  activePage,
}: TopBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!IS_WINDOWS || !window.fern?.isMaximized) return
    window.fern.isMaximized().then(setIsMaximized)
    const off = window.fern.onMaximizeChange?.(setIsMaximized)
    return () => off?.()
  }, [])

  const pageTitle =
    activePage === 'overview' ? 'Overview' :
    activePage === 'git' ? 'Source Control' :
    activePage === 'settings' ? 'Settings' :
    activePage === 'revisions' ? 'Revision History' :
    fileName ?? ''

  return (
    <header className={`topbar${IS_WINDOWS ? ' topbar-win' : ''}`}>
      {/* Brand — always shown, acts as left anchor */}
      <div className="topbar-brand">
        <FernLogo size={IS_WINDOWS ? 16 : 14} />
        <span className="topbar-brand-text">Fern</span>
      </div>

      {pageTitle && (
        <span className="topbar-page-title">{pageTitle}</span>
      )}

      <div className="topbar-actions">
        {activePage === 'editor' && hasFile && (
          <>
            <div className="topbar-tabs">
              {(['edit', 'split', 'preview'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`topbar-tab ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => onViewModeChange(mode)}
                >
                  {mode === 'edit' ? 'Edit' : mode === 'split' ? 'Split' : 'Preview'}
                </button>
              ))}
            </div>
            <button
              className={`topbar-run-all ${isRunAllPaused ? 'paused' : isRunningAll ? 'running' : ''}`}
              onClick={onRunAll}
              disabled={isRunningAll}
              title={isRunAllPaused ? 'A block failed — choose Continue or Stop in its output panel below' : undefined}
            >
              {isRunAllPaused ? 'Awaiting decision' : isRunningAll ? 'Running…' : '▶ Run all'}
            </button>
          </>
        )}

        {/* Windows window controls */}
        {IS_WINDOWS && (
          <div className="topbar-wincontrols">
            <button
              className="wc-btn wc-min"
              onClick={() => window.fern.minimizeWindow()}
              title="Minimize"
            >
              <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
            </button>
            <button
              className="wc-btn wc-max"
              onClick={() => window.fern.maximizeWindow()}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                /* Restore: two offset squares (outline only, no fill) */
                <svg width="11" height="11" viewBox="0 0 11 11">
                  <rect x="2.5" y="0.5" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="0.5" y="2.5" width="8" height="8" rx="0.5" fill="var(--bg-app)" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              )}
            </button>
            <button
              className="wc-btn wc-close"
              onClick={() => window.fern.closeWindow()}
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
        .topbar {
          height: 36px;
          background: var(--bg-app);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 10px 0 0;
          flex-shrink: 0;
          -webkit-app-region: drag;
          z-index: 200;
          position: relative;
        }
        /* Windows variant — taller bar, light by default */
        .topbar-win {
          height: 44px;
          background: var(--bg-app);
          border-bottom: 1px solid var(--border);
          padding: 0;
        }
        /* Dark theme: branded dark bar */
        [data-theme="dark"] .topbar-win {
          background: #1C1C1E;
          border-bottom: 1px solid rgba(0,0,0,0.35);
        }
        @media (prefers-color-scheme: dark) {
          [data-theme="system"] .topbar-win {
            background: #1C1C1E;
            border-bottom: 1px solid rgba(0,0,0,0.35);
          }
        }
        .topbar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 16px;
          padding-right: 16px;
          flex-shrink: 0;
          -webkit-app-region: no-drag;
          width: 240px;
          box-sizing: border-box;
        }
        .topbar-brand-text {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--text-primary);
        }
        [data-theme="dark"] .topbar-win .topbar-brand-text,
        [data-theme="system"] .topbar-win .topbar-brand-text {
          color: rgba(255,255,255,0.88);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .topbar-win .topbar-brand-text { color: var(--text-primary); }
        }
        .topbar-page-title {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
          pointer-events: none;
        }
        [data-theme="dark"] .topbar-win .topbar-page-title,
        [data-theme="system"] .topbar-win .topbar-page-title {
          color: rgba(255,255,255,0.5);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .topbar-win .topbar-page-title { color: var(--text-secondary); }
        }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          -webkit-app-region: no-drag;
        }
        .topbar-win .topbar-actions {
          gap: 4px;
        }
        .topbar-tabs {
          display: flex;
          align-items: center;
        }
        .topbar-tab {
          font-size: 12px;
          font-weight: 400;
          color: var(--text-muted);
          padding: 4px 10px;
          border-radius: 5px;
          background: transparent;
          transition: color 0.12s, background 0.12s;
          -webkit-app-region: no-drag;
        }
        [data-theme="dark"] .topbar-win .topbar-tab,
        [data-theme="system"] .topbar-win .topbar-tab {
          color: rgba(255,255,255,0.45);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .topbar-win .topbar-tab { color: var(--text-muted); }
        }
        .topbar-tab.active {
          color: var(--text-primary);
          background: var(--bg-hover);
          font-weight: 500;
        }
        [data-theme="dark"] .topbar-win .topbar-tab.active,
        [data-theme="system"] .topbar-win .topbar-tab.active {
          color: rgba(255,255,255,0.9);
          background: rgba(255,255,255,0.1);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .topbar-win .topbar-tab.active { color: var(--text-primary); background: var(--bg-hover); }
        }
        .topbar-tab:hover:not(.active) {
          color: var(--text-secondary);
          background: var(--bg-hover);
        }
        [data-theme="dark"] .topbar-win .topbar-tab:hover:not(.active),
        [data-theme="system"] .topbar-win .topbar-tab:hover:not(.active) {
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.06);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .topbar-win .topbar-tab:hover:not(.active) { color: var(--text-secondary); background: var(--bg-hover); }
        }
        .topbar-run-all {
          background: var(--accent);
          color: white;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 5px;
          transition: background 0.1s;
          display: flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.01em;
          margin-right: 6px;
        }
        .topbar-run-all:hover:not(:disabled) { background: var(--accent-hover); }
        .topbar-run-all:disabled { opacity: 0.35; cursor: default; }
        .topbar-run-all.running { background: var(--accent-hover); opacity: 0.7; }
        .topbar-run-all.paused {
          background: var(--color-amber);
          opacity: 1;
          animation: topbar-run-all-pulse 1.6s ease-in-out infinite;
        }
        @keyframes topbar-run-all-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.4); }
          50% { box-shadow: 0 0 0 5px rgba(217,119,6,0); }
        }

        /* Windows window control buttons */
        .topbar-wincontrols {
          display: flex;
          align-items: stretch;
          height: 44px;
          margin-left: 4px;
          -webkit-app-region: no-drag;
        }
        .wc-btn {
          width: 46px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          transition: background 0.1s, color 0.1s;
          padding: 0;
          flex-shrink: 0;
        }
        .wc-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        [data-theme="dark"] .wc-btn,
        [data-theme="system"] .wc-btn {
          color: rgba(255,255,255,0.65);
        }
        [data-theme="dark"] .wc-btn:hover,
        [data-theme="system"] .wc-btn:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.95);
        }
        @media (prefers-color-scheme: light) {
          [data-theme="system"] .wc-btn { color: var(--text-secondary); }
          [data-theme="system"] .wc-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        }
        .wc-close:hover {
          background: #c42b1c;
          color: #fff;
        }
      `}</style>
    </header>
  )
}
