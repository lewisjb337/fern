import React, { useState, useEffect } from 'react'
import { FernLogo } from './FernLogo'
import { shortcut } from '../utils/platform'

const TIPS = [
  `Add \`run\` to any code fence to make it executable`,
  `Blocks share a session — set a variable in one, use it in the next`,
  `Supports bash · node · python3 out of the box`,
  `${shortcut('N')} creates a new file instantly`,
  `Auto-saves as you type — never lose work`,
  `${shortcut('⇧↩')} runs all blocks top to bottom in sequence`,
  `Use Split view to edit and preview markdown side by side`,
  `Exit code and duration shown after every block run`,
  `Press Esc to close the current file and return here`,
]

export function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % TIPS.length)
        setVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <div className="loading-logo-pulse">
          <FernLogo size={96} />
        </div>
        <span className="loading-wordmark">fern</span>
      </div>

      <div className="loading-tip-area">
        <p className={`loading-tip ${visible ? 'visible' : ''}`}>
          {TIPS[tipIndex]}
        </p>
      </div>

      <style>{`
        .loading-screen {
          height: 100vh;
          width: 100vw;
          background: var(--bg-app);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 56px;
        }
        .loading-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .loading-logo-pulse {
          animation: logo-breathe 2.4s ease-in-out infinite;
        }
        @keyframes logo-breathe {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .loading-wordmark {
          font-size: 36px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: -0.02em;
        }
        .loading-tip-area {
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-tip {
          font-family: var(--font-sans);
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          max-width: 380px;
        }
        .loading-tip.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .loading-tip code {
          color: var(--accent);
          background: var(--accent-bg);
          padding: 1px 4px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}
