import React, { useState } from 'react'
import { shortcut, isMac } from '../utils/platform'
import { FernLogo } from './FernLogo'

interface WelcomeScreenProps {
  recentFolders: string[]
  onOpenFolder: () => void
  onOpenRecent: (folderPath: string) => void
  onCreateFile: () => void
}

export function WelcomeScreen({ recentFolders, onOpenFolder, onOpenRecent, onCreateFile }: WelcomeScreenProps) {
  const [tab, setTab] = useState<'home' | 'docs' | 'embeds' | 'shortcuts'>('home')

  function getFolderName(fp: string) {
    return fp.split(/[\\/]/).filter(Boolean).pop() ?? fp
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">

        {/* Header */}
        <div className="welcome-header">
          <span className="welcome-icon"><FernLogo size={48} /></span>
          <h1 className="welcome-title">Fern</h1>
          <p className="welcome-subtitle">The markdown editor where code runs.</p>
        </div>

        {/* Tab bar */}
        <div className="welcome-tabs">
          {(['home', 'docs', 'embeds', 'shortcuts'] as const).map((t) => (
            <button
              key={t}
              className={`welcome-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'home' ? 'Home' : t === 'docs' ? 'Code blocks' : t === 'embeds' ? 'Embeds' : 'Shortcuts'}
            </button>
          ))}
        </div>

        {/* ── Home ── */}
        {tab === 'home' && (
          <div className="welcome-tab-body">
            <div className="welcome-actions">
              <div className="welcome-card">
                <div className="welcome-card-title">Get started</div>
                <button className="welcome-open-btn" onClick={onOpenFolder}>
                  Open folder
                  <span className="welcome-kbd">{shortcut('O')}</span>
                </button>
                <button className="welcome-new-btn" onClick={onCreateFile}>
                  New file
                  <span className="welcome-kbd">{shortcut('N')}</span>
                </button>
              </div>

              {recentFolders.length > 0 && (
                <div className="welcome-card">
                  <div className="welcome-card-title">Recent</div>
                  <ul className="welcome-recent-list">
                    {recentFolders.slice(0, 5).map((fp) => (
                      <li key={fp}>
                        <button className="welcome-recent-item" onClick={() => onOpenRecent(fp)}>
                          <span className="welcome-recent-icon">📁</span>
                          <span className="welcome-recent-name">{getFolderName(fp)}</span>
                          <span className="welcome-recent-path">{fp}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Feature highlights */}
            <div className="welcome-features">
              <div className="welcome-card-title" style={{ marginBottom: 12 }}>What Fern can do</div>
              <div className="features-grid">
                {[
                  {
                    label: 'Run code',
                    desc: 'Execute Node, Python, Bash, PowerShell and more directly in your notes.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="3,2 13,8 3,14" fill="currentColor" opacity="0.9"/></svg>,
                  },
                  {
                    label: 'Charts & diagrams',
                    desc: 'Render Chart.js charts and Mermaid diagrams from fenced code blocks.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.5"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.75"/><rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor"/></svg>,
                  },
                  {
                    label: 'Live embeds',
                    desc: 'Inline files, CSVs, API responses, GitHub issues and env vars.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h14M8 1v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/><rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg>,
                  },
                  {
                    label: 'Git integration',
                    desc: 'Commit, push, pull and diff without leaving the editor.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 5c0 3-8 4-8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                  },
                  {
                    label: 'Revision history',
                    desc: 'Auto-saved snapshots let you restore any previous version instantly.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4.5V8l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  },
                  {
                    label: 'Named block I/O',
                    desc: 'Chain blocks together — stdout from one block flows into the next.',
                    svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 7v2h8V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  },
                ].map(({ label, desc, svg }) => (
                  <div key={label} className="feature-card">
                    <span className="feature-icon">{svg}</span>
                    <div>
                      <div className="feature-label">{label}</div>
                      <div className="feature-desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Code blocks docs ── */}
        {tab === 'docs' && (
          <div className="welcome-tab-body docs-body">

            <div className="doc-section">
              <h3 className="doc-h3">Making a block runnable</h3>
              <p className="doc-p">Add <code>run</code> after the language tag. Fern will show a Run button and you can also press <kbd>{isMac ? '⌘↩' : 'Ctrl+Enter'}</kbd> with your cursor inside the block.</p>
              <pre className="doc-fence"><span className="df-tick">```</span><span className="df-lang">node</span> <span className="df-run">run</span>{'\n'}console.log("hello from Fern"){'\n'}<span className="df-tick">```</span></pre>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Supported runtimes</h3>
              <p className="doc-p">Use any of these as the language tag. Fern detects which are installed on startup and shows them in the status bar.</p>
              <div className="doc-runtime-list">
                {[
                  { lang: 'node', color: '#68A063', note: 'node script.js' },
                  { lang: 'python', color: '#3776AB', note: 'python script.py' },
                  { lang: 'powershell', color: '#2671BE', note: 'powershell -File script.ps1' },
                  { lang: 'bash', color: '#4EAA25', note: 'bash -c "..."' },
                  { lang: 'typescript', color: '#3178C6', note: 'ts-node via npx' },
                  { lang: 'ruby', color: '#CC342D', note: 'ruby script.rb' },
                  { lang: 'go', color: '#00ADD8', note: 'go run script.go' },
                  { lang: 'rust', color: '#CE4121', note: 'rustc + run' },
                  { lang: 'php', color: '#777BB4', note: 'php script.php' },
                  { lang: 'deno', color: '#70FFAF', note: 'deno run script.ts' },
                  { lang: 'bun', color: '#F9F1E1', note: 'bun script.ts' },
                ].map(({ lang, color, note }) => (
                  <div key={lang} className="doc-runtime-row">
                    <span className="doc-rt-dot" style={{ background: color }} />
                    <code className="doc-rt-name">{lang}</code>
                    <span className="doc-rt-note">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Named blocks</h3>
              <p className="doc-p">Add <code>id=name</code> to capture a block's stdout after it runs. Every subsequent block receives that output as an environment variable: <code>FERN_OUT_name</code>.</p>
              <pre className="doc-fence"><span className="df-tick">```</span><span className="df-lang">node</span> <span className="df-run">run</span> <span className="df-id">id=greeting</span>{'\n'}console.log("hello world"){'\n'}<span className="df-tick">```</span>{'\n\n'}<span className="df-tick">```</span><span className="df-lang">powershell</span> <span className="df-run">run</span>{'\n'}Write-Output "Previous block said: $env:FERN_OUT_greeting"{'\n'}<span className="df-tick">```</span></pre>
              <p className="doc-p doc-note">The id badge <span className="doc-inline-pill">id: greeting</span> appears in the block header so you can see at a glance which blocks are named.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Hidden blocks</h3>
              <p className="doc-p">Add <code>hidden</code> to make a block invisible in Preview mode. Hidden blocks still run with <kbd>{isMac ? '⌘⇧↩' : 'Ctrl+Shift+Enter'}</kbd> Run All — ideal for setup, secrets, or seed scripts.</p>
              <pre className="doc-fence"><span className="df-tick">```</span><span className="df-lang">powershell</span> <span className="df-hidden">hidden</span> <span className="df-id">id=setup</span> <span className="df-run">run</span>{'\n'}$env:DB_HOST = "localhost"{'\n'}<span className="df-tick">```</span></pre>
              <p className="doc-p doc-note">Hidden blocks show a dashed border and a <span className="doc-inline-pill doc-inline-hidden">hidden</span> badge in the editor.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Token order</h3>
              <p className="doc-p">Tokens can appear in any order after the language. All three of these are equivalent:</p>
              <pre className="doc-fence"><span className="df-tick">```</span><span className="df-lang">bash</span> <span className="df-run">run</span> <span className="df-hidden">hidden</span> <span className="df-id">id=setup</span>{'\n'}<span className="df-tick">```</span><span className="df-lang">bash</span> <span className="df-hidden">hidden</span> <span className="df-id">id=setup</span> <span className="df-run">run</span>{'\n'}<span className="df-tick">```</span><span className="df-lang">bash</span> <span className="df-id">id=setup</span> <span className="df-run">run</span> <span className="df-hidden">hidden</span></pre>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Rich output</h3>
              <p className="doc-p">After a block runs, Fern auto-detects the output format:</p>
              <ul className="doc-list">
                <li><strong>JSON</strong> — collapsible colour-coded tree with Copy JSON button</li>
                <li><strong>CSV</strong> — sortable table (click column headers to sort)</li>
                <li><strong>Raw</strong> — plain text as usual</li>
              </ul>
              <p className="doc-p">Use the <strong>Auto / JSON / CSV / Raw</strong> selector in the output panel to override.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Run All & error pause</h3>
              <p className="doc-p">Press <kbd>{isMac ? '⌘⇧↩' : 'Ctrl+Shift+Enter'}</kbd> to run every <code>run</code> block in order. If a block fails, Run All pauses inline with two choices:</p>
              <ul className="doc-list">
                <li><strong>Continue anyway</strong> — skip the error and proceed</li>
                <li><strong>Stop here</strong> — abort the sequence</li>
              </ul>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Pinned output</h3>
              <p className="doc-p">After a successful run, click <strong>Pin output</strong> to snapshot it to <code>.fern/snapshots.json</code>. Switch between <strong>Live</strong> and <strong>Pinned</strong> tabs in the output panel to compare runs.</p>
              <p className="doc-p doc-note"><code>.fern/</code> is automatically added to <code>.gitignore</code> when you open a workspace.</p>
            </div>

          </div>
        )}

        {/* ── Embeds docs ── */}
        {tab === 'embeds' && (
          <div className="welcome-tab-body docs-body">

            <div className="doc-section">
              <h3 className="doc-h3">File embeds</h3>
              <p className="doc-p">Embed any file from your workspace as a syntax-highlighted, read-only code block. The path is relative to the workspace root.</p>
              <pre className="doc-fence"><span className="df-embed-brace">{'{{'}file: src/config.ts{'}}'}</span></pre>
              <p className="doc-p doc-note">Re-reads from disk on every preview render. Extension determines the language highlight: <code>.ts</code> → TypeScript, <code>.py</code> → Python, <code>.json</code> → JSON, etc.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">CSV embeds</h3>
              <p className="doc-p">Embed a CSV file as a live sortable table. Click any column header to sort ascending or descending.</p>
              <pre className="doc-fence"><span className="df-embed-brace">{'{{'}csv: data/results.csv{'}}'}</span></pre>
              <p className="doc-p doc-note">First row is treated as headers. Re-reads from disk on every preview render.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">API embeds</h3>
              <p className="doc-p">Fetch a live API response and render it as an interactive JSON tree.</p>
              <pre className="doc-fence"><span className="df-embed-brace">{'{{'}api: GET https://api.example.com/status{'}}'}</span></pre>
              <ul className="doc-list">
                <li>Supports <code>GET</code> and <code>POST</code></li>
                <li>Responses are cached for the duration set in Settings → Embeds (default 30s)</li>
                <li>Use the <strong>↻ Refresh</strong> button in the embed header to bypass the cache</li>
                <li>Status code shown in colour: <span style={{ color: '#3D6B52' }}>2xx green</span>, <span style={{ color: '#C9A227' }}>3xx amber</span>, <span style={{ color: '#C0392B' }}>4xx/5xx red</span></li>
              </ul>
              <p className="doc-p doc-note">The first time an API embed appears in a workspace you'll be prompted to allow or block network requests from that workspace. This can be changed in Settings → Embeds.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">GitHub issues embeds</h3>
              <p className="doc-p">Render a live list of GitHub issues from the workspace's <code>origin</code> remote. Requires a personal access token in Settings → GitHub.</p>
              <pre className="doc-fence"><span className="df-embed-brace">{'{{'}issues: open{'}}'}</span>{'\n'}<span className="df-embed-brace">{'{{'}issues: open label:bug{'}}'}</span>{'\n'}<span className="df-embed-brace">{'{{'}issues: closed assignee:lewis{'}}'}</span></pre>
              <ul className="doc-list">
                <li><code>open</code> or <code>closed</code> — required, must be first token</li>
                <li><code>label:X</code> — filter by label name</li>
                <li><code>assignee:X</code> — filter by GitHub username</li>
              </ul>
              <p className="doc-p doc-note">Click any issue to open it in your browser. Results are cached for 60 seconds.</p>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Environment variable embeds</h3>
              <p className="doc-p">Display a value from your workspace's <code>.env</code> file with the value masked by default.</p>
              <pre className="doc-fence"><span className="df-embed-brace">{'{{'}env: DATABASE_URL{'}}'}</span></pre>
              <p className="doc-p">Renders inline as: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'rgba(61,107,82,0.08)', border: '1px solid rgba(61,107,82,0.2)', borderRadius: 4, padding: '1px 8px' }}><span style={{ color: '#3D6B52', fontWeight: 600 }}>DATABASE_URL:</span> ••••••••3306</span></p>
              <ul className="doc-list">
                <li>Click <strong>👁</strong> to reveal the full value for 3 seconds, then it re-masks</li>
                <li>Real values are automatically available to <code>run</code> blocks — no embed needed</li>
                <li>If <code>.env</code> exists but isn't in <code>.gitignore</code>, Fern shows a one-time warning banner</li>
              </ul>
            </div>

            <div className="doc-section">
              <h3 className="doc-h3">Git panel</h3>
              <p className="doc-p">The full git workflow is available without leaving Fern. Press <kbd>{isMac ? '⌘⇧G' : 'Ctrl+Shift+G'}</kbd> to open the Git panel.</p>
              <ul className="doc-list">
                <li>See all changed files with their status (M modified, + added, D deleted, R renamed)</li>
                <li>Click any file to open a line-by-line diff against HEAD</li>
                <li>Write a commit message and click <strong>Commit</strong> to stage all and commit</li>
                <li><strong>Push</strong> and <strong>Pull</strong> against the current branch's upstream</li>
                <li>If no upstream is set, Fern prompts to push and set it in one step</li>
                <li><strong>Initialize git repo</strong> button appears if the folder isn't a git repository yet</li>
              </ul>
            </div>

          </div>
        )}

        {/* ── Shortcuts ── */}
        {tab === 'shortcuts' && (
          <div className="welcome-tab-body">
            <table className="welcome-shortcuts">
              <tbody>
                <tr><td><kbd>{shortcut('O')}</kbd></td><td>Open folder</td></tr>
                <tr><td><kbd>{shortcut('N')}</kbd></td><td>New file</td></tr>
                <tr><td><kbd>{isMac ? '⌘P' : 'Ctrl+P'}</kbd></td><td>Quick open file</td></tr>
                <tr><td><kbd>{isMac ? '⌘⇧P' : 'Ctrl+Shift+P'}</kbd></td><td>Command palette</td></tr>
                <tr><td><kbd>{isMac ? '⌘⇧D' : 'Ctrl+Shift+D'}</kbd></td><td>Distraction-free mode</td></tr>
                <tr><td><kbd>{isMac ? '⌘↩' : 'Ctrl+Enter'}</kbd></td><td>Run current block</td></tr>
                <tr><td><kbd>{isMac ? '⌘⇧↩' : 'Ctrl+Shift+Enter'}</kbd></td><td>Run all blocks</td></tr>
                <tr><td><kbd>{isMac ? '⌘`' : 'Ctrl+`'}</kbd></td><td>Toggle terminal</td></tr>
                <tr><td><kbd>{isMac ? '⌘⇧G' : 'Ctrl+Shift+G'}</kbd></td><td>Git panel</td></tr>
                <tr><td><kbd>{isMac ? '⌘⇧H' : 'Ctrl+Shift+H'}</kbd></td><td>Revision history</td></tr>
                <tr><td><kbd>{isMac ? '⌘,' : 'Ctrl+,'}</kbd></td><td>Settings</td></tr>
                <tr><td><kbd>{isMac ? '⌘1 / ⌘2 / ⌘3' : 'Ctrl+1/2/3'}</kbd></td><td>Edit / Split / Preview</td></tr>
              </tbody>
            </table>
          </div>
        )}

      </div>

      <style>{`
        .welcome {
          flex: 1;
          overflow-y: auto;
          display: flex;
          justify-content: center;
          padding: 48px 40px 80px;
          background: var(--bg-app);
        }
        .welcome-inner {
          width: 100%;
          max-width: 620px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Header */
        .welcome-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .welcome-icon { display: flex; line-height: 1; margin-bottom: 6px; }
        .welcome-title {
          font-family: var(--font-sans);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .welcome-subtitle { font-size: 13px; color: var(--text-muted); }

        /* Tab bar */
        .welcome-tabs {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0;
        }
        .welcome-tab {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          padding: 6px 14px;
          border-radius: 6px 6px 0 0;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.1s;
        }
        .welcome-tab:hover { color: var(--text-secondary); }
        .welcome-tab.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent);
        }

        /* Tab content */
        .welcome-tab-body { display: flex; flex-direction: column; gap: 0; }

        /* Home tab */
        .welcome-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .welcome-card {
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .welcome-card-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .welcome-open-btn,
        .welcome-new-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          padding: 6px 8px;
          border-radius: 5px;
          text-align: left;
          transition: background 0.1s;
        }
        .welcome-open-btn:hover, .welcome-new-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .welcome-open-btn { font-weight: 500; color: var(--accent); }
        .welcome-kbd {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          background: var(--bg-selected);
          padding: 1px 5px;
          border-radius: 3px;
        }
        .welcome-recent-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
        .welcome-recent-item {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          padding: 4px 6px;
          border-radius: 4px;
          text-align: left;
          width: 100%;
          transition: background 0.1s;
          overflow: hidden;
        }
        .welcome-recent-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .welcome-recent-icon { font-size: 12px; flex-shrink: 0; }
        .welcome-recent-name { font-weight: 500; flex-shrink: 0; }
        .welcome-recent-path {
          font-size: 10px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: var(--font-mono);
        }

        /* Feature highlights */
        .welcome-features {
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 14px;
        }
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 20px;
        }
        .feature-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 6px 0;
        }
        .feature-icon {
          color: var(--accent);
          flex-shrink: 0;
          margin-top: 1px;
          display: flex;
        }
        .feature-label { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 1px; }
        .feature-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; }

        /* Docs tab */
        .docs-body { gap: 0; }
        .doc-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 20px 0;
          border-bottom: 0.5px solid var(--border);
        }
        .doc-section:last-child { border-bottom: none; }
        .doc-h3 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }
        .doc-p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }
        .doc-note {
          color: var(--text-muted);
          font-size: 12px;
        }
        .doc-p code {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-hover);
          padding: 1px 4px;
          border-radius: 3px;
          color: var(--accent);
        }
        .doc-p kbd {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-selected);
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid var(--border-strong);
          color: var(--text-secondary);
        }
        .doc-list {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
          padding-left: 18px;
        }
        .doc-list li { margin-bottom: 2px; }
        .doc-list code {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-hover);
          padding: 1px 4px;
          border-radius: 3px;
          color: var(--accent);
        }

        /* Fence syntax demo */
        .doc-fence {
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.7;
          background: var(--bg-code);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 14px;
          margin: 0;
          white-space: pre;
          overflow-x: auto;
        }
        .df-tick       { color: var(--text-muted); }
        .df-lang       { color: var(--color-amber); }
        .df-run        { color: var(--accent); }
        .df-id         { color: var(--color-blue); }
        .df-hidden     { color: var(--syntax-keyword); }
        .df-embed-brace { color: var(--color-red); }

        /* Runtime list */
        .doc-runtime-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .doc-runtime-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
        }
        .doc-rt-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          opacity: 0.85;
        }
        .doc-rt-name {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-primary);
          width: 90px;
          flex-shrink: 0;
        }
        .doc-rt-note { color: var(--text-muted); font-size: 11px; font-family: var(--font-mono); }

        /* Inline badges */
        .doc-inline-pill {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: var(--color-amber);
          background: var(--color-amber-bg);
          padding: 1px 6px;
          border-radius: 3px;
          vertical-align: middle;
        }
        .doc-inline-hidden {
          color: var(--text-muted);
          background: transparent;
          border: 1px dashed var(--border-strong);
        }

        /* Shortcuts tab */
        .welcome-shortcuts {
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 4px;
        }
        .welcome-shortcuts td {
          padding: 6px 14px 6px 0;
          color: var(--text-secondary);
          vertical-align: middle;
          border-bottom: 0.5px solid var(--border);
        }
        .welcome-shortcuts tr:last-child td { border-bottom: none; }
        .welcome-shortcuts td:first-child { width: 160px; }
        .welcome-shortcuts kbd {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          background: var(--bg-selected);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--border-strong);
        }
      `}</style>
    </div>
  )
}
