import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface KV { key: string; value: string }

interface ParsedRequest {
  method: string
  url: string
  baseUrl: string
  params: KV[]
  headers: KV[]
  auth: AuthInfo
  body: string
  bodyType: 'json' | 'form' | 'text' | 'none'
}

interface AuthInfo {
  type: 'bearer' | 'basic' | 'apikey' | 'none'
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
}

interface HttpResponse {
  status: number
  statusText: string
  headers: KV[]
  body: string
  bodyFormatted: string
  isJson: boolean
  duration: number
  size: number
}

type ReqTab = 'params' | 'headers' | 'auth' | 'body'
type RespTab = 'pretty' | 'raw' | 'headers'
type SendStatus = 'idle' | 'sending' | 'done' | 'error'

// ── Constants ──────────────────────────────────────────────────────────────

const METHOD_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  GET:     { text: '#61AFFE', bg: 'rgba(97,175,254,0.15)',  border: 'rgba(97,175,254,0.35)'  },
  POST:    { text: '#49CC90', bg: 'rgba(73,204,144,0.15)',  border: 'rgba(73,204,144,0.35)'  },
  PUT:     { text: '#FCA130', bg: 'rgba(252,161,48,0.15)',  border: 'rgba(252,161,48,0.35)'  },
  PATCH:   { text: '#50E3C2', bg: 'rgba(80,227,194,0.15)', border: 'rgba(80,227,194,0.35)'  },
  DELETE:  { text: '#F93E3E', bg: 'rgba(249,62,62,0.15)',  border: 'rgba(249,62,62,0.35)'   },
  HEAD:    { text: '#9012FE', bg: 'rgba(144,18,254,0.15)', border: 'rgba(144,18,254,0.35)'  },
  OPTIONS: { text: '#0D5AA7', bg: 'rgba(13,90,167,0.15)',  border: 'rgba(13,90,167,0.35)'   },
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

// ── Parsing ────────────────────────────────────────────────────────────────

function parseAuth(headers: KV[]): AuthInfo {
  const auth = headers.find(h => h.key.toLowerCase() === 'authorization')
  if (auth) {
    if (/^bearer /i.test(auth.value)) return { type: 'bearer', token: auth.value.slice(7) }
    if (/^basic /i.test(auth.value)) {
      try {
        const decoded = atob(auth.value.slice(6))
        const [username, ...rest] = decoded.split(':')
        return { type: 'basic', username, password: rest.join(':') }
      } catch { return { type: 'bearer', token: auth.value.slice(6) } }
    }
  }
  const apiKey = headers.find(h => ['x-api-key','api-key','apikey','x-auth-token'].includes(h.key.toLowerCase()))
  if (apiKey) return { type: 'apikey', key: apiKey.key, value: apiKey.value }
  return { type: 'none' }
}

function parseRequest(code: string): ParsedRequest {
  const lines = code.replace(/\r\n/g, '\n').trim().split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  const sp = firstLine.indexOf(' ')
  const method = sp > -1 ? firstLine.slice(0, sp).toUpperCase() : 'GET'
  const rawUrl = sp > -1 ? firstLine.slice(sp + 1).trim() : ''

  let baseUrl = rawUrl
  const params: KV[] = []
  try {
    const u = new URL(rawUrl)
    baseUrl = u.origin + u.pathname
    u.searchParams.forEach((v, k) => params.push({ key: k, value: v }))
  } catch {
    const qi = rawUrl.indexOf('?')
    if (qi > -1) {
      baseUrl = rawUrl.slice(0, qi)
      rawUrl.slice(qi + 1).split('&').forEach(pair => {
        const [k, v] = pair.split('=')
        if (k) params.push({ key: decodeURIComponent(k), value: decodeURIComponent(v ?? '') })
      })
    }
  }

  const headers: KV[] = []
  let bodyStart = lines.length
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') { bodyStart = i + 1; break }
    const ci = line.indexOf(':')
    if (ci > 0) headers.push({ key: line.slice(0, ci).trim(), value: line.slice(ci + 1).trim() })
  }

  const bodyRaw = bodyStart < lines.length ? lines.slice(bodyStart).join('\n').trim() : ''
  let bodyType: ParsedRequest['bodyType'] = 'none'
  if (bodyRaw) {
    const ct = headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? ''
    bodyType = ct.includes('json') || bodyRaw.trimStart().startsWith('{') || bodyRaw.trimStart().startsWith('[')
      ? 'json' : ct.includes('form') ? 'form' : 'text'
  }

  return { method, url: rawUrl, baseUrl, params, headers, auth: parseAuth(headers), body: bodyRaw, bodyType }
}

function serializeRequest(method: string, baseUrl: string, params: KV[], headers: KV[], body: string): string {
  const activeParams = params.filter(p => p.key.trim())
  const qs = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  const url = qs ? `${baseUrl}?${qs}` : baseUrl
  const headerLines = headers.filter(h => h.key.trim()).map(h => `${h.key}: ${h.value}`)
  const parts = [`${method} ${url}`, ...headerLines]
  if (body.trim()) parts.push('', body.trim())
  return parts.join('\n')
}

function buildUrl(base: string, params: KV[]): string {
  const active = params.filter(p => p.key)
  if (!active.length) return base
  return `${base}?${active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')}`
}

// ── Formatting ─────────────────────────────────────────────────────────────

function formatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
}

function syntaxJson(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      m => {
        if (m.startsWith('"') && m.endsWith(':')) return `<span class="jk">${m}</span>`
        if (m.startsWith('"')) return `<span class="jv">${m}</span>`
        if (m === 'true' || m === 'false') return `<span class="jb">${m}</span>`
        if (m === 'null') return `<span class="jn">${m}</span>`
        return `<span class="jnum">${m}</span>`
      }
    )
}

function statusStyle(s: number) {
  if (s >= 200 && s < 300) return { text: '#49CC90', bg: 'rgba(73,204,144,0.12)', border: 'rgba(73,204,144,0.3)' }
  if (s >= 300 && s < 400) return { text: '#FCA130', bg: 'rgba(252,161,48,0.12)',  border: 'rgba(252,161,48,0.3)'  }
  if (s >= 400 && s < 500) return { text: '#F93E3E', bg: 'rgba(249,62,62,0.12)',  border: 'rgba(249,62,62,0.3)'   }
  return                           { text: '#D73A49', bg: 'rgba(215,58,73,0.12)',  border: 'rgba(215,58,73,0.3)'   }
}

function fmtSize(b: number) { return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB` }

// ── Editable KV table ──────────────────────────────────────────────────────

function EditableKVTable({ rows, onChange, keyPlaceholder = 'key', valuePlaceholder = 'value', emptyMsg }: {
  rows: KV[]
  onChange: (rows: KV[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  emptyMsg: string
}) {
  const update = (i: number, field: 'key' | 'value', val: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const add = () => onChange([...rows, { key: '', value: '' }])

  return (
    <div className="hb-kv">
      {rows.length === 0 && <div className="hb-empty">{emptyMsg}</div>}
      {rows.map((r, i) => (
        <div key={i} className="hb-kv-row">
          <input
            className="hb-kv-input hb-kv-key"
            value={r.key}
            placeholder={keyPlaceholder}
            onChange={e => update(i, 'key', e.target.value)}
            spellCheck={false}
          />
          <span className="hb-kv-sep">:</span>
          <input
            className="hb-kv-input hb-kv-val"
            value={r.value}
            placeholder={valuePlaceholder}
            onChange={e => update(i, 'value', e.target.value)}
            spellCheck={false}
          />
          <button className="hb-kv-rm" onClick={() => remove(i)} title="Remove">×</button>
        </div>
      ))}
      <button className="hb-kv-add" onClick={add}>+ Add {keyPlaceholder}</button>
    </div>
  )
}

// ── Auth tab ───────────────────────────────────────────────────────────────

function AuthTab({ auth }: { auth: AuthInfo }) {
  const [showToken, setShowToken] = useState(false)

  if (auth.type === 'none') {
    return (
      <div className="hb-auth-none">
        <div>
          <div className="hb-auth-title">No authorization</div>
          <div className="hb-auth-hint">Add an <code>Authorization: Bearer …</code> header to configure auth</div>
        </div>
      </div>
    )
  }

  return (
    <div className="hb-auth-section">
      <div className={`hb-auth-badge hb-auth-badge--${auth.type}`}>
        {auth.type === 'bearer' ? 'Bearer Token' : auth.type === 'basic' ? 'Basic Auth' : 'API Key'}
      </div>
      {auth.type === 'bearer' && (
        <div className="hb-auth-row">
          <span className="hb-auth-label">Token</span>
          <span className="hb-auth-val">{showToken ? auth.token : '•'.repeat(Math.min(auth.token?.length ?? 0, 28))}</span>
          <button className="hb-auth-toggle" onClick={() => setShowToken(v => !v)}>{showToken ? 'Hide' : 'Show'}</button>
        </div>
      )}
      {auth.type === 'basic' && <>
        <div className="hb-auth-row">
          <span className="hb-auth-label">Username</span>
          <span className="hb-auth-val">{auth.username}</span>
        </div>
        <div className="hb-auth-row">
          <span className="hb-auth-label">Password</span>
          <span className="hb-auth-val">{showToken ? auth.password : '•'.repeat(Math.min(auth.password?.length ?? 0, 20))}</span>
          <button className="hb-auth-toggle" onClick={() => setShowToken(v => !v)}>{showToken ? 'Hide' : 'Show'}</button>
        </div>
      </>}
      {auth.type === 'apikey' && <>
        <div className="hb-auth-row">
          <span className="hb-auth-label">Header</span>
          <span className="hb-auth-val">{auth.key}</span>
        </div>
        <div className="hb-auth-row">
          <span className="hb-auth-label">Value</span>
          <span className="hb-auth-val">{showToken ? auth.value : '•'.repeat(Math.min(auth.value?.length ?? 0, 28))}</span>
          <button className="hb-auth-toggle" onClick={() => setShowToken(v => !v)}>{showToken ? 'Hide' : 'Show'}</button>
        </div>
      </>}
      <p className="hb-auth-edit-hint">Edit the Authorization header to change auth</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function HttpBlock({ code, onChange }: { code: string; onChange?: (newCode: string) => void }) {
  const parsed = useMemo(() => parseRequest(code), [code])
  const currentMs = METHOD_STYLE[parsed.method] ?? METHOD_STYLE['GET']

  // Local editable state — sync from parsed when code changes externally
  const [method, setMethod] = useState(parsed.method)
  const [baseUrl, setBaseUrl] = useState(parsed.baseUrl)
  const [params, setParams] = useState<KV[]>(parsed.params)
  const [headers, setHeaders] = useState<KV[]>(parsed.headers)
  const [body, setBody] = useState(parsed.body)

  const prevCode = useRef(code)
  useEffect(() => {
    if (code !== prevCode.current) {
      prevCode.current = code
      const p = parseRequest(code)
      setMethod(p.method)
      setBaseUrl(p.baseUrl)
      setParams(p.params)
      setHeaders(p.headers)
      setBody(p.body)
    }
  }, [code])

  const push = useCallback((m: string, bu: string, ps: KV[], hs: KV[], bd: string) => {
    onChange?.(serializeRequest(m, bu, ps, hs, bd))
  }, [onChange])

  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reqTab, setReqTab] = useState<ReqTab>('params')
  const [respTab, setRespTab] = useState<RespTab>('pretty')
  const [copied, setCopied] = useState(false)

  const hasAuth = parsed.auth.type !== 'none'
  const displayUrl = buildUrl(baseUrl, params.filter(p => p.key))

  const tabs: { id: ReqTab; label: string; badge?: number }[] = [
    { id: 'params',  label: 'Params',  badge: params.filter(p => p.key).length || undefined },
    { id: 'headers', label: 'Headers', badge: headers.filter(h => h.key).length || undefined },
    { id: 'auth',    label: 'Auth' },
    { id: 'body',    label: 'Body' },
  ]

  const handleSend = useCallback(async () => {
    if (sendStatus === 'sending') return
    setSendStatus('sending')
    setResponse(null)
    setError(null)

    const url = buildUrl(baseUrl, params)
    const hdrs: Record<string, string> = {}
    headers.forEach(h => { if (h.key) hdrs[h.key] = h.value })

    const start = Date.now()
    try {
      const opts: RequestInit = { method, headers: hdrs }
      if (body && !['GET', 'HEAD'].includes(method)) opts.body = body

      const res = await fetch(url, opts)
      const duration = Date.now() - start
      const bodyText = await res.text()
      const size = new TextEncoder().encode(bodyText).length
      const respHdrs: KV[] = []
      res.headers.forEach((v, k) => respHdrs.push({ key: k, value: v }))
      const ct = res.headers.get('content-type') ?? ''
      const isJson = ct.includes('json') || bodyText.trimStart().startsWith('{') || bodyText.trimStart().startsWith('[')
      setResponse({ status: res.status, statusText: res.statusText, headers: respHdrs, body: bodyText, bodyFormatted: isJson ? formatJson(bodyText) : bodyText, isJson, duration, size })
      setSendStatus('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSendStatus('error')
    }
  }, [method, baseUrl, params, headers, body, sendStatus])

  const handleCopy = useCallback(async () => {
    if (!response) return
    await navigator.clipboard.writeText(respTab === 'raw' ? response.body : response.bodyFormatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [response, respTab])

  return (
    <div className="hb" style={{ '--hb-accent': currentMs.text } as React.CSSProperties}>

      {/* ── Request bar ── */}
      <div className="hb-header">
        <select
          className="hb-method-select"
          value={method}
          style={{ color: currentMs.text, background: currentMs.bg, borderColor: currentMs.border }}
          onChange={e => { const m = e.target.value; setMethod(m); push(m, baseUrl, params, headers, body) }}
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          className="hb-url-input"
          value={baseUrl}
          placeholder="https://example.com/api/…"
          spellCheck={false}
          onChange={e => setBaseUrl(e.target.value)}
          onBlur={() => push(method, baseUrl, params, headers, body)}
          onKeyDown={e => { if (e.key === 'Enter') push(method, baseUrl, params, headers, body) }}
        />
        <button
          className={`hb-send hb-send--${sendStatus}`}
          onClick={handleSend}
          disabled={sendStatus === 'sending' || !baseUrl}
        >
          {sendStatus === 'sending' ? '◌ Sending…' : sendStatus === 'done' ? '↻ Resend' : sendStatus === 'error' ? '↻ Retry' : '▶ Send'}
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="hb-tabbar">
        {tabs.map(t => (
          <button key={t.id} className={`hb-tab ${reqTab === t.id ? 'hb-tab--active' : ''}`} onClick={() => setReqTab(t.id)}>
            {t.label}
            {t.badge !== undefined && (
              <span className="hb-tab-badge">{t.badge}</span>
            )}
            {t.id === 'auth' && hasAuth && <span className="hb-tab-dot" />}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="hb-tabcontent">
        {reqTab === 'params' && (
          <EditableKVTable
            rows={params}
            keyPlaceholder="param"
            valuePlaceholder="value"
            emptyMsg="No query params"
            onChange={next => { setParams(next); push(method, baseUrl, next, headers, body) }}
          />
        )}
        {reqTab === 'headers' && (
          <EditableKVTable
            rows={headers}
            keyPlaceholder="header"
            valuePlaceholder="value"
            emptyMsg="No headers defined"
            onChange={next => { setHeaders(next); push(method, baseUrl, params, next, body) }}
          />
        )}
        {reqTab === 'auth' && <AuthTab auth={parsed.auth} />}
        {reqTab === 'body' && (
          <div className="hb-body-wrap">
            {parsed.bodyType !== 'none' && (
              <div className="hb-body-meta">
                <span className="hb-body-type">{parsed.bodyType === 'json' ? 'JSON' : parsed.bodyType === 'form' ? 'Form' : 'Text'}</span>
              </div>
            )}
            <textarea
              className="hb-body-textarea"
              value={body}
              placeholder={'{\n  "key": "value"\n}'}
              spellCheck={false}
              onChange={e => setBody(e.target.value)}
              onBlur={() => push(method, baseUrl, params, headers, body)}
            />
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {sendStatus === 'error' && error && (
        <div className="hb-error">✗ {error}</div>
      )}

      {/* ── Response ── */}
      {response && (() => {
        const sc = statusStyle(response.status)
        return (
          <div className="hb-response">
            <div className="hb-resp-bar">
              <span className="hb-status" style={{ color: sc.text, background: sc.bg, borderColor: sc.border }}>
                {response.status} {response.statusText}
              </span>
              <span className="hb-resp-pill">{response.duration}ms</span>
              <span className="hb-resp-pill">{fmtSize(response.size)}</span>
              <div style={{ flex: 1 }} />
              <div className="hb-rtabs">
                {(['pretty', 'raw', 'headers'] as RespTab[]).map(t => (
                  <button key={t} className={`hb-rtab ${respTab === t ? 'hb-rtab--active' : ''}`} onClick={() => setRespTab(t)}>
                    {t === 'pretty' ? 'Pretty' : t === 'raw' ? 'Raw' : `Headers (${response.headers.length})`}
                  </button>
                ))}
              </div>
              <button className="hb-icon-btn" onClick={handleCopy} title="Copy">{copied ? '✓' : '⎘'}</button>
            </div>

            {respTab === 'headers' ? (
              <div className="hb-kv hb-resp-kv">
                {response.headers.map((r, i) => (
                  <div key={i} className="hb-kv-row hb-kv-row--readonly">
                    <span className="hb-kv-key-ro">{r.key}</span>
                    <span className="hb-kv-sep">:</span>
                    <span className="hb-kv-val-ro">{r.value}</span>
                  </div>
                ))}
              </div>
            ) : respTab === 'pretty' && response.isJson ? (
              <pre className="hb-resp-body" dangerouslySetInnerHTML={{ __html: syntaxJson(response.bodyFormatted) }} />
            ) : (
              <pre className="hb-resp-body">{respTab === 'pretty' ? response.bodyFormatted : response.body}</pre>
            )}
          </div>
        )
      })()}

      <style>{`
        .hb {
          margin: 16px -16px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg-code);
          font-family: var(--font-mono);
          font-size: 12px;
          position: relative;
        }
        .hb::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0; width: 3px;
          background: var(--hb-accent, var(--accent));
        }

        /* ── Request bar ── */
        .hb-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px 8px 14px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border);
        }
        .hb-method-select {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 3px 6px;
          border-radius: 4px;
          border: 1px solid;
          flex-shrink: 0;
          min-width: 72px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          text-align: center;
          text-align-last: center;
        }
        .hb-method-select option {
          background: var(--bg-app);
          color: var(--text-primary);
          font-weight: 700;
        }
        .hb-url-input {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          outline: none;
          flex: 1;
          min-width: 0;
          padding: 2px 0;
          transition: color 0.1s;
        }
        .hb-url-input::placeholder { color: var(--text-disabled); }
        .hb-url-input:focus { color: var(--text-primary); }
        .hb-send {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          padding: 5px 14px;
          border-radius: 5px;
          flex-shrink: 0;
          transition: background 0.1s;
          letter-spacing: 0.02em;
        }
        .hb-send--idle    { background: var(--text-primary); color: #FFFFFF; border: 1px solid transparent; }
        .hb-send--idle:hover { opacity: 0.85; }
        .hb-send--sending { background: var(--bg-selected); color: var(--text-muted); border: 1px solid var(--border); cursor: default; }
        .hb-send--done    { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--border); }
        .hb-send--done:hover { opacity: 0.9; }
        .hb-send--error   { background: var(--color-red-bg); color: var(--color-red); border: 1px solid var(--border); }
        .hb-send:disabled { cursor: default; }

        /* ── Tab bar ── */
        .hb-tabbar {
          display: flex;
          background: var(--bg-code);
          border-bottom: 1px solid var(--border);
          padding: 0 12px;
          gap: 0;
        }
        .hb-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans, sans-serif);
          font-size: 11px;
          font-weight: 400;
          color: var(--text-muted);
          padding: 8px 12px;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          background: transparent;
          transition: color 0.12s, border-color 0.12s;
          letter-spacing: 0.01em;
        }
        .hb-tab:hover { color: var(--text-secondary); }
        .hb-tab--active {
          color: var(--text-primary);
          border-bottom-color: var(--hb-accent, var(--accent));
          font-weight: 500;
        }
        .hb-tab-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          background: transparent;
          border: none;
          padding: 0;
          line-height: 1;
        }
        .hb-tab--active .hb-tab-badge { color: var(--text-secondary); }
        .hb-tab-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: var(--hb-accent, var(--accent));
          opacity: 0.8;
          flex-shrink: 0;
        }

        /* ── Tab content ── */
        .hb-tabcontent { background: var(--bg-code); min-height: 44px; }
        .hb-empty {
          padding: 12px 14px;
          color: var(--text-disabled);
          font-size: 11px;
        }

        /* ── Editable KV ── */
        .hb-kv { padding: 4px 0; }
        .hb-kv-row {
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border);
          min-height: 30px;
        }
        .hb-kv-row:last-of-type { border-bottom: none; }
        .hb-kv-input {
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 6px 10px;
          color: var(--text-secondary);
          transition: color 0.1s;
        }
        .hb-kv-input:focus { color: var(--text-primary); }
        .hb-kv-input::placeholder { color: var(--text-disabled); }
        .hb-kv-key { width: 170px; flex-shrink: 0; color: var(--accent); }
        .hb-kv-key:focus { color: var(--accent-hover); }
        .hb-kv-val { flex: 1; min-width: 0; }
        .hb-kv-sep { color: var(--text-disabled); font-size: 12px; user-select: none; }
        .hb-kv-rm {
          font-size: 14px; line-height: 1;
          color: var(--text-disabled); background: transparent;
          padding: 4px 10px; flex-shrink: 0;
          transition: color 0.1s;
        }
        .hb-kv-rm:hover { color: var(--color-red); }
        .hb-kv-add {
          display: block; width: 100%; text-align: left;
          font-family: var(--font-mono); font-size: 10px;
          color: var(--text-muted); padding: 6px 12px;
          transition: color 0.1s; border-top: 1px solid var(--border);
        }
        .hb-kv-add:hover { color: var(--accent); }
        .hb-kv-key-ro {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--accent); padding: 6px 10px; width: 170px; flex-shrink: 0;
        }
        .hb-kv-val-ro {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--text-secondary); padding: 6px 10px; flex: 1; word-break: break-all;
        }
        .hb-resp-kv { background: var(--bg-code); }
        .hb-kv-row--readonly { border-bottom: 1px solid var(--border); }

        /* ── Auth ── */
        .hb-auth-none { padding: 14px; }
        .hb-auth-title { font-family: var(--font-sans); font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 3px; }
        .hb-auth-hint  { font-size: 10px; color: var(--text-muted); }
        .hb-auth-hint code { color: var(--accent); background: var(--accent-bg); padding: 0 3px; border-radius: 2px; }
        .hb-auth-section { padding: 10px 14px; display: flex; flex-direction: column; gap: 7px; }
        .hb-auth-badge {
          display: inline-flex; align-items: center;
          font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 2px 8px; border-radius: 3px; align-self: flex-start;
        }
        .hb-auth-badge--bearer { background: var(--color-blue-bg); color: var(--color-blue); border: 1px solid var(--border); }
        .hb-auth-badge--basic  { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--border); }
        .hb-auth-badge--apikey { background: var(--color-amber-bg); color: var(--color-amber); border: 1px solid var(--border); }
        .hb-auth-row { display: flex; align-items: center; gap: 10px; }
        .hb-auth-label { font-size: 10px; color: var(--text-muted); font-weight: 500; min-width: 76px; }
        .hb-auth-val { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hb-auth-toggle {
          font-family: var(--font-mono); font-size: 9px;
          color: var(--text-secondary); background: var(--bg-selected); padding: 2px 7px; border-radius: 3px; flex-shrink: 0;
          border: 1px solid var(--border-strong);
          transition: color 0.1s, background 0.1s;
        }
        .hb-auth-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }
        .hb-auth-edit-hint { font-size: 10px; color: var(--text-disabled); margin-top: 4px; }

        /* ── Body textarea ── */
        .hb-body-meta {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 12px; border-bottom: 1px solid var(--border);
        }
        .hb-body-type {
          font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted); background: var(--bg-selected); padding: 2px 7px; border-radius: 3px;
          border: 1px solid var(--border-strong);
        }
        .hb-body-textarea {
          display: block; width: 100%; min-height: 100px;
          background: transparent; border: none; outline: none; resize: vertical;
          font-family: var(--font-mono); font-size: 11.5px; line-height: 1.7;
          color: var(--text-secondary); padding: 10px 14px; box-sizing: border-box;
          transition: color 0.1s;
        }
        .hb-body-textarea:focus { color: var(--text-primary); }
        .hb-body-textarea::placeholder { color: var(--text-disabled); }

        /* ── Error ── */
        .hb-error {
          padding: 10px 14px; font-size: 11px;
          color: var(--color-red); background: var(--color-red-bg);
          border-top: 1px solid var(--border);
        }

        /* ── Response ── */
        .hb-response { border-top: 1px solid var(--border); }
        .hb-resp-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border);
        }
        .hb-status {
          font-family: var(--font-mono); font-size: 11px; font-weight: 700;
          padding: 2px 8px; border-radius: 4px; border: 1px solid;
          letter-spacing: 0.03em; flex-shrink: 0;
        }
        .hb-resp-pill {
          font-family: var(--font-mono); font-size: 10px;
          color: var(--text-muted); background: var(--bg-selected); padding: 1px 7px; border-radius: 10px;
          border: 1px solid var(--border);
        }
        .hb-rtabs {
          display: flex; background: var(--bg-selected); border-radius: 4px;
          padding: 2px; gap: 1px; border: 1px solid var(--border);
        }
        .hb-rtab {
          font-family: var(--font-sans); font-size: 10px; font-weight: 500;
          padding: 2px 9px; border-radius: 3px; color: var(--text-muted); transition: all 0.1s;
        }
        .hb-rtab--active { background: var(--bg-app); color: var(--text-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
        .hb-rtab:hover:not(.hb-rtab--active) { color: var(--text-secondary); }
        .hb-icon-btn {
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-muted); background: transparent; padding: 2px 6px;
          border-radius: 3px; transition: color 0.1s;
        }
        .hb-icon-btn:hover { color: var(--text-primary); }
        .hb-resp-body {
          margin: 0; padding: 12px 14px;
          font-family: var(--font-mono); font-size: 11.5px; line-height: 1.75;
          color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;
          overflow-x: auto; max-height: 440px; overflow-y: auto; background: var(--bg-code);
        }

        /* JSON colours */
        .hb-resp-body .jk  { color: var(--color-red); }
        .hb-resp-body .jv  { color: var(--accent); }
        .hb-resp-body .jb  { color: var(--color-blue); }
        .hb-resp-body .jn  { color: var(--syntax-keyword); }
        .hb-resp-body .jnum { color: var(--color-amber); }
      `}</style>
    </div>
  )
}
