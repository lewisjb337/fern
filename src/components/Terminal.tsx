import React, { useEffect, useRef, useState, useCallback } from 'react'

interface TerminalProps {
  workspacePath: string | null
  sessionEnv: Record<string, string>
  onClose: () => void
}

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 240

export function Terminal({ workspacePath, sessionEnv, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [isMinimized, setIsMinimized] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartH = useRef<number>(DEFAULT_HEIGHT)

  useEffect(() => {
    if (!containerRef.current || !workspacePath) return

    let mounted = true

    async function init() {
      try {
        await import('@xterm/xterm/css/xterm.css')
        const { Terminal: XTerm } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')

        if (!mounted || !containerRef.current) return

        const term = new XTerm({
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
          fontSize: 13,
          lineHeight: 1.5,
          cursorStyle: 'block',
          cursorBlink: true,
          theme: {
            background: '#1A1A1A',
            foreground: '#C8C4BC',
            cursor: '#5A9E6F',
            selectionBackground: 'rgba(90,158,111,0.3)',
            black: '#1A1A1A',
            red: '#CC3333',
            green: '#3D6B52',
            yellow: '#C8902A',
            blue: '#2060A0',
            magenta: '#6040A0',
            cyan: '#2060A0',
            white: '#C8C4BC',
            brightBlack: '#5A5750',
            brightRed: '#E05050',
            brightGreen: '#5A9E6F',
            brightYellow: '#E0A830',
            brightBlue: '#4080C0',
            brightMagenta: '#8060C0',
            brightCyan: '#4080C0',
            brightWhite: '#FAFAF8',
          },
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(webLinksAddon)
        term.open(containerRef.current)
        fitAddon.fit()

        termRef.current = term
        fitAddonRef.current = fitAddon

        const result = await window.fern.createTerminal(workspacePath, sessionEnv)
        if (!mounted) return

        if (!result.success) {
          setError(result.error ?? 'Terminal unavailable')
          term.dispose()
          return
        }

        const offOutput = window.fern.onTerminalOutput((data) => {
          term.write(data)
        })

        term.onData((data) => {
          window.fern.terminalInput(data)
        })

        term.onResize(({ cols, rows }) => {
          window.fern.terminalResize(cols, rows)
        })

        cleanupRef.current = () => {
          offOutput()
          term.dispose()
          window.fern.closeTerminal()
        }
      } catch (err) {
        if (mounted) setError('Failed to load terminal: ' + String(err))
      }
    }

    init()

    return () => {
      mounted = false
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [workspacePath])

  // Fit on height change
  useEffect(() => {
    if (fitAddonRef.current && !isMinimized) {
      setTimeout(() => fitAddonRef.current?.fit(), 50)
    }
  }, [height, isMinimized])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartH.current = height

    const onMove = (me: MouseEvent) => {
      if (dragStartY.current === null) return
      const delta = dragStartY.current - me.clientY
      setHeight(Math.max(MIN_HEIGHT, dragStartH.current + delta))
    }
    const onUp = () => {
      dragStartY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [height])

  const handleClose = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    onClose()
  }, [onClose])

  return (
    <div className="terminal-panel" style={{ height: isMinimized ? 32 : height }}>
      {/* Drag handle */}
      <div className="terminal-drag-handle" onMouseDown={handleDragStart} />

      {/* Header */}
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        {workspacePath && (
          <span className="terminal-cwd">{workspacePath.split(/[\\/]/).pop()}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          className="terminal-header-btn"
          title={isMinimized ? 'Expand' : 'Minimize'}
          onClick={() => setIsMinimized((m) => !m)}
        >
          {isMinimized ? '⊡' : '—'}
        </button>
        <button className="terminal-header-btn" title="Close terminal" onClick={handleClose}>
          ×
        </button>
      </div>

      {/* Terminal body */}
      {!isMinimized && (
        <div className="terminal-body">
          {error ? (
            <div className="terminal-error">
              <span>{error}</span>
              {error.includes('node-pty') && (
                <code className="terminal-error-cmd">npx electron-rebuild -f -w node-pty</code>
              )}
            </div>
          ) : (
            <div ref={containerRef} className="terminal-xterm" />
          )}
        </div>
      )}

      <style>{`
        .terminal-panel {
          border-top: 1px solid #111;
          background: #1A1A1A;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: relative;
          transition: height 0.05s linear;
        }
        .terminal-drag-handle {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          cursor: ns-resize;
          z-index: 5;
        }
        .terminal-drag-handle:hover {
          background: rgba(90,158,111,0.3);
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          height: 32px;
          flex-shrink: 0;
          border-bottom: 1px solid #111;
        }
        .terminal-title {
          font-family: var(--font-mono);
          font-size: 11px;
          color: #5A9E6F;
          font-weight: 500;
        }
        .terminal-cwd {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #4A4A4A;
        }
        .terminal-header-btn {
          font-family: var(--font-mono);
          font-size: 14px;
          color: #4A4A4A;
          background: transparent;
          padding: 0 4px;
          line-height: 1;
          transition: color 0.1s;
        }
        .terminal-header-btn:hover { color: #9A9589; }
        .terminal-body {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 6px 8px;
        }
        .terminal-xterm {
          width: 100%;
          height: 100%;
        }
        .terminal-error {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: #CC3333;
        }
        .terminal-error-cmd {
          color: #9A9589;
          font-size: 11px;
          background: #111;
          padding: 4px 8px;
          border-radius: 4px;
          display: block;
        }
      `}</style>
    </div>
  )
}
