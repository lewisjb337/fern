import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Short label shown in the fallback, e.g. "preview" or "this embed" */
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[Fern] Caught render error:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="fern-error-boundary">
        <div className="feb-title">⚠ Couldn't render {this.props.label ?? 'this content'}</div>
        <div className="feb-message">{error.message}</div>
        <button className="feb-retry" onClick={this.reset}>Try again</button>
        <style>{`
          .fern-error-boundary {
            margin: 12px 0;
            padding: 14px 16px;
            border: 1px solid var(--border);
            border-left: 3px solid var(--color-red);
            border-radius: 6px;
            background: var(--color-red-bg);
            font-family: var(--font-mono);
          }
          .feb-title {
            font-size: 12px; font-weight: 600;
            color: var(--color-red); margin-bottom: 4px;
          }
          .feb-message {
            font-size: 11.5px; color: var(--text-secondary);
            margin-bottom: 10px; word-break: break-word;
          }
          .feb-retry {
            font-family: var(--font-sans); font-size: 11px; font-weight: 500;
            padding: 4px 10px; border-radius: 5px;
            background: var(--bg-app); border: 1px solid var(--border-strong);
            color: var(--text-primary);
          }
          .feb-retry:hover { background: var(--bg-hover); }
        `}</style>
      </div>
    )
  }
}
