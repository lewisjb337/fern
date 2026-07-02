import React, { useState, useEffect } from 'react'
import { FernLogo } from './FernLogo'

// Only rendered on Windows (frameless window)
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.fern.isMaximized().then(setIsMaximized)
    const off = window.fern.onMaximizeChange(setIsMaximized)
    return off
  }, [])

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <FernLogo size={18} />
          <span className="titlebar-name">Fern</span>
        </div>
      </div>

      <div className="titlebar-controls">
        <button
          className="titlebar-btn titlebar-btn-min"
          onClick={() => window.fern.minimizeWindow()}
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button
          className="titlebar-btn titlebar-btn-max"
          onClick={() => window.fern.maximizeWindow()}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" fill="var(--titlebar-bg)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={() => window.fern.closeWindow()}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <style>{`
        .titlebar {
          height: 44px;
          display: flex;
          align-items: center;
          background: var(--titlebar-bg);
          border-bottom: 1px solid var(--titlebar-border);
          flex-shrink: 0;
          position: relative;
          z-index: 200;
          -webkit-user-select: none;
          user-select: none;
        }
        .titlebar-drag {
          flex: 1;
          display: flex;
          align-items: center;
          height: 100%;
          -webkit-app-region: drag;
        }
        .titlebar-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 18px;
          -webkit-app-region: no-drag;
          pointer-events: none;
        }
        .titlebar-name {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--titlebar-text);
          font-family: var(--font-sans);
        }
        .titlebar-controls {
          display: flex;
          align-items: stretch;
          height: 100%;
          -webkit-app-region: no-drag;
        }
        .titlebar-btn {
          width: 46px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--titlebar-text);
          opacity: 0.7;
          transition: background 0.1s, opacity 0.1s;
          padding: 0;
        }
        .titlebar-btn:hover {
          opacity: 1;
          background: var(--titlebar-btn-hover);
        }
        .titlebar-btn-close:hover {
          background: #c42b1c;
          color: #fff;
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
