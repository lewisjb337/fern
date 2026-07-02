import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import matter from 'gray-matter'
import mermaid from 'mermaid'

let mermaidReady = false
function initMermaid() {
  if (mermaidReady) return
  mermaidReady = true
  const dark = isDarkTheme()
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      themeVariables: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Inter", sans-serif',
        fontSize: '14px',
      },
    })
  } catch {}
}
import { CodeBlock } from './CodeBlock'
import { HttpBlock } from './HttpBlock'
import { FileEmbed } from './FileEmbed'
import { CsvEmbed } from './CsvEmbed'
import { ApiEmbed } from './ApiEmbed'
import { IssuesEmbed } from './IssuesEmbed'
import { EnvEmbed } from './EnvEmbed'
import { ErrorBoundary } from './ErrorBoundary'
import { parseAllBlocks, type CodeBlock as CodeBlockData } from '../utils/parseBlocks'
import { useExecutor } from '../hooks/useExecutor'
import type { PinnedOutput } from '../hooks/usePinnedOutputs'

interface PreviewPaneProps {
  content: string
  folderPath: string | null
  onMakeRunnable: (block: CodeBlockData) => void
  onBlockChange: (block: CodeBlockData, newCode: string) => void
  runAllPausedAt?: string | null
  onResolveRunAll?: (action: 'continue' | 'stop') => void
  getPinned?: (blockKey: string) => PinnedOutput | null
  onPin?: (blockKey: string, output: string) => void
  onUnpin?: (blockKey: string) => void
  embedCacheDuration?: number
}

// Shortcode pattern — matches {{file:…}}, {{csv:…}}, {{api:…}}, {{issues:…}}, {{env:…}}
const EMBED_PATTERN = /\{\{(file|csv|api|issues|env):\s*([^}]+)\}\}/g

type Segment =
  | { type: 'prose'; html: string; key: string }
  | { type: 'block'; block: CodeBlockData }
  | { type: 'chart'; code: string; key: string }
  | { type: 'mermaid'; code: string; key: string }
  | { type: 'embed-file'; relPath: string; key: string }
  | { type: 'embed-csv'; relPath: string; key: string }
  | { type: 'embed-api'; method: string; url: string; key: string }
  | { type: 'embed-issues'; filter: string; key: string }
  | { type: 'embed-env'; varName: string; key: string }

marked.setOptions({ async: false })
marked.use({ breaks: false })

// ── Chart segment — proper React component, survives Strict Mode double-invoke ──
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler,
  ScatterController, LineController, BarController, PieController,
  DoughnutController, RadarController,
} from 'chart.js'
import { parseChartSpec, buildOptions } from './ChartBlock'
Chart.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  RadialLinearScale, Title, Tooltip, Legend, Filler,
  ScatterController, LineController, BarController, PieController,
  DoughnutController, RadarController,
)

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function ChartSegment({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const spec = parseChartSpec(code)
    if (!spec) return
    const { labels, datasets, options, chartType } = buildOptions(spec, isDarkTheme())
    const instance = new Chart(canvas, {
      type: chartType as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter',
      data: { labels, datasets },
      options,
    })
    return () => { instance.destroy() }
  }, [code])

  const spec = parseChartSpec(code)
  if (!spec) {
    return (
      <div className="chart-error">
        <span>Invalid chart spec</span>
        <pre>{code}</pre>
      </div>
    )
  }
  return <div className="chart-block-wrapper"><canvas ref={canvasRef} /></div>
}

function MermaidSegment({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    initMermaid()
    let cancelled = false
    const id = `fern-mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
    mermaid.render(id, code).then(({ svg }) => {
      if (!cancelled && el) el.innerHTML = svg
    }).catch(() => {
      if (!cancelled && el) el.classList.add('mermaid-error')
    })
    return () => { cancelled = true }
  }, [code])
  return <div className="mermaid-diagram" ref={ref} />
}

function renderProse(text: string): string {
  const normalised = text.replace(/\r\n/g, '\n')
  if (!normalised.trim()) return ''
  try {
    return marked.parse(normalised) as string
  } catch {
    return ''
  }
}

export function PreviewPane({
  content, folderPath, onMakeRunnable, onBlockChange,
  runAllPausedAt, onResolveRunAll, getPinned, onPin, onUnpin,
  embedCacheDuration = 30,
}: PreviewPaneProps) {
  const { blockStates, runBlock, stopBlock, clearBlock } = useExecutor(folderPath)

  // API trust state for this workspace
  const previewRef = useRef<HTMLDivElement>(null)
  const [apiTrusted, setApiTrusted] = useState<boolean | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Jump to heading on demand
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail
      const pane = previewRef.current
      const scroller = scrollRef.current
      if (!pane || !scroller) return
      const headings = pane.querySelectorAll('h1, h2, h3')
      for (const el of headings) {
        if ((el as HTMLElement).textContent?.trim() === text) {
          const elRect = (el as HTMLElement).getBoundingClientRect()
          const scrollerRect = scroller.getBoundingClientRect()
          const elTop = elRect.top - scrollerRect.top + scroller.scrollTop
          scroller.scrollTo({ top: Math.max(0, elTop - 80), behavior: 'smooth' })
          break
        }
      }
    }
    window.addEventListener('fern:jump-to-heading', handler)
    return () => window.removeEventListener('fern:jump-to-heading', handler)
  }, [])

  // Emit visible-heading on scroll so outline tracks preview position
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onScroll = () => {
      const pane = previewRef.current
      if (!pane) return
      const scrollerRect = scroller.getBoundingClientRect()
      const threshold = scrollerRect.top + 100
      const headings = Array.from(pane.querySelectorAll('h1, h2, h3')) as HTMLElement[]
      let active: HTMLElement | null = null
      for (const el of headings) {
        if (el.getBoundingClientRect().top <= threshold) active = el
        else break
      }
      if (active) {
        window.dispatchEvent(new CustomEvent('fern:visible-heading', { detail: { text: active.textContent?.trim() ?? '' } }))
      }
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!folderPath) return
    window.fern.getApiTrust(folderPath).then(setApiTrusted)
  }, [folderPath])

  // .env variables
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!folderPath) return
    window.fern.readEnvFile(folderPath).then(setEnvVars)
  }, [folderPath])

  // Extract frontmatter tags
  const frontmatterTags = useMemo<string[]>(() => {
    try {
      const lines = content.replace(/\r\n/g, '\n').split('\n')
      if (lines[0] !== '---') return []
      const closeIdx = lines.indexOf('---', 1)
      if (closeIdx < 1) return []
      for (let i = 1; i < closeIdx; i++) {
        const m = lines[i].match(/^tags:\s*(.+)$/)
        if (!m) continue
        const raw = m[1].trim().replace(/^\[/, '').replace(/\]$/, '')
        return raw.split(',').map((t) => t.trim()).filter(Boolean)
      }
      return []
    } catch {
      return []
    }
  }, [content])

  const segments = useMemo<Segment[]>(() => {
    const normalised = content.replace(/\r\n/g, '\n')

    // Strip frontmatter for PROSE rendering only
    let body = normalised
    try { body = matter(normalised).content } catch {}
    if (body === normalised) body = normalised.replace(/^---\n[\s\S]*?\n---\n?/, '')
    const fmLen = normalised.length - body.length

    // Parse code blocks from normalised (same as App.tsx) so IDs match
    const allBlocks = parseAllBlocks(normalised)
    const VISUAL_RUNTIMES = new Set(['chart', 'mermaid'])
    const blocks = allBlocks.filter((b) => b.startIndex >= fmLen && !VISUAL_RUNTIMES.has(b.runtime))

    const result: Segment[] = []

    // We need to interleave code blocks and embed shortcodes.
    // Build a flat list of "events" sorted by position, then walk them.

    type Event =
      | { kind: 'block'; block: CodeBlockData; start: number; end: number }
      | { kind: 'visual'; runtime: string; code: string; start: number; end: number }
      | { kind: 'embed'; embedType: string; params: string; start: number; end: number; raw: string }

    const events: Event[] = []

    for (const block of blocks) {
      events.push({ kind: 'block', block, start: block.startIndex, end: block.endIndex })
    }
    // Extract chart/mermaid blocks as first-class visual segments
    for (const block of allBlocks) {
      if (block.startIndex < fmLen) continue
      if (VISUAL_RUNTIMES.has(block.runtime)) {
        events.push({ kind: 'visual', runtime: block.runtime, code: block.code, start: block.startIndex, end: block.endIndex })
      }
    }

    // Find embed shortcodes in body (body-relative positions)
    EMBED_PATTERN.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = EMBED_PATTERN.exec(body)) !== null) {
      events.push({
        kind: 'embed',
        embedType: m[1],
        params: m[2].trim(),
        start: fmLen + m.index,
        end: fmLen + m.index + m[0].length,
        raw: m[0],
      })
    }

    events.sort((a, b) => a.start - b.start)

    let pos = 0 // position in body (body-relative)

    for (const ev of events) {
      const startInBody = ev.start - fmLen
      const endInBody = ev.end - fmLen

      if (startInBody < 0) continue // inside frontmatter

      if (startInBody > pos) {
        const html = renderProse(body.slice(pos, startInBody))
        if (html) result.push({ type: 'prose', html, key: `prose-${pos}` })
      }

      if (ev.kind === 'visual') {
        const key = `${ev.runtime}-${ev.start}`
        result.push({ type: ev.runtime as 'chart' | 'mermaid', code: ev.code, key })
        pos = endInBody
        continue
      }

      if (ev.kind === 'block') {
        if (!ev.block.hidden) {
          result.push({ type: 'block', block: ev.block })
        }
      } else {
        const key = `embed-${ev.start}`
        switch (ev.embedType) {
          case 'file':
            result.push({ type: 'embed-file', relPath: ev.params, key })
            break
          case 'csv':
            result.push({ type: 'embed-csv', relPath: ev.params, key })
            break
          case 'api': {
            const apiMatch = ev.params.match(/^(GET|POST)\s+(\S+)$/i)
            if (apiMatch) {
              result.push({ type: 'embed-api', method: apiMatch[1].toUpperCase(), url: apiMatch[2], key })
            }
            break
          }
          case 'issues':
            result.push({ type: 'embed-issues', filter: ev.params, key })
            break
          case 'env':
            result.push({ type: 'embed-env', varName: ev.params.trim(), key })
            break
        }
      }

      pos = endInBody
    }

    if (pos < body.length) {
      const html = renderProse(body.slice(pos))
      if (html) result.push({ type: 'prose', html, key: `prose-${pos}` })
    }

    return result
  }, [content])


  const idleState = { status: 'idle' as const, output: [], exitCode: null, duration: null, pid: null }

  const handleTrust = useCallback(() => {
    if (!folderPath) return
    window.fern.setApiTrust(folderPath, true).then(() => setApiTrusted(true))
  }, [folderPath])

  const handleDeny = useCallback(() => {
    if (!folderPath) return
    window.fern.setApiTrust(folderPath, false).then(() => setApiTrusted(false))
  }, [folderPath])

  return (
    <div className="preview-scroll" ref={scrollRef}>
      <div className="preview-pane" ref={previewRef}>
        {frontmatterTags.length > 0 && (
          <div className="frontmatter-tags">
            {frontmatterTags.map((tag) => (
              <span key={tag} className="frontmatter-tag">{tag}</span>
            ))}
          </div>
        )}
        {segments.map((seg) => {
          if (seg.type === 'prose') {
            return (
              <div
                key={seg.key}
                className="preview-prose"
                dangerouslySetInnerHTML={{ __html: seg.html }}
              />
            )
          }

          if (seg.type === 'chart') {
            return (
              <ErrorBoundary key={seg.key} label="this chart">
                <ChartSegment code={seg.code} />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'mermaid') {
            return (
              <ErrorBoundary key={seg.key} label="this diagram">
                <MermaidSegment code={seg.code} />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'embed-file') {
            if (!folderPath) return null
            return (
              <ErrorBoundary key={seg.key} label={`file embed (${seg.relPath})`}>
                <FileEmbed workspacePath={folderPath} relPath={seg.relPath} />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'embed-csv') {
            if (!folderPath) return null
            return (
              <ErrorBoundary key={seg.key} label={`CSV embed (${seg.relPath})`}>
                <CsvEmbed workspacePath={folderPath} relPath={seg.relPath} />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'embed-api') {
            return (
              <ErrorBoundary key={seg.key} label="this API embed">
                <ApiEmbed
                  method={seg.method}
                  url={seg.url}
                  workspacePath={folderPath}
                  cacheDuration={embedCacheDuration}
                  trusted={apiTrusted}
                  onTrust={handleTrust}
                  onDeny={handleDeny}
                />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'embed-issues') {
            return (
              <ErrorBoundary key={seg.key} label="this issues embed">
                <IssuesEmbed
                  filter={seg.filter}
                  workspacePath={folderPath}
                  cacheDuration={embedCacheDuration}
                />
              </ErrorBoundary>
            )
          }

          if (seg.type === 'embed-env') {
            return (
              <ErrorBoundary key={seg.key} label="this env embed">
                <span style={{ display: 'inline' }}>
                  <EnvEmbed varName={seg.varName} envVars={envVars} />
                </span>
              </ErrorBoundary>
            )
          }

          if (seg.type === 'block') {
            const { block } = seg

            if (block.runtime === 'http' || block.runtime === 'https') {
              return (
                <ErrorBoundary key={block.id} label="this HTTP block">
                  <div className="preview-block-outer">
                    <HttpBlock code={block.code} onChange={(newCode) => onBlockChange(block, newCode)} />
                  </div>
                </ErrorBoundary>
              )
            }

            return (
              <ErrorBoundary key={block.id} label="this code block">
                <div className="preview-block-outer">
                  <CodeBlock
                    id={block.id}
                    runtime={block.runtime}
                    code={block.code}
                    runnable={block.runnable}
                    blockId={block.blockId}
                    state={blockStates[block.id] ?? idleState}
                    onRun={() => runBlock(block.id, block.code, block.runtime, block.blockId)}
                    onStop={() => stopBlock(block.id)}
                    onClearOutput={() => clearBlock(block.id)}
                    onMakeRunnable={() => onMakeRunnable(block)}
                    pinnedOutput={getPinned?.(block.id) ?? null}
                    onPin={(output) => onPin?.(block.id, output)}
                    onUnpin={() => onUnpin?.(block.id)}
                    isRunAllPaused={runAllPausedAt === block.id}
                    onResolveRunAll={onResolveRunAll}
                  />
                </div>
              </ErrorBoundary>
            )
          }

          return null
        })}
      </div>

      <style>{`
        .preview-scroll {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-app);
        }
        .preview-pane {
          padding: 80px 96px 120px;
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-primary);
          max-width: 900px;
          margin: 0 auto;
        }
        .preview-block-outer {
          margin: 0;
        }
        .preview-prose h1 {
          font-size: 24px; font-weight: 600; margin: 0 0 8px;
          color: var(--text-primary); letter-spacing: -0.01em; line-height: 1.3;
        }
        .preview-prose h2 {
          font-size: 20px; font-weight: 600; margin: 40px 0 8px;
          color: var(--text-primary); line-height: 1.3;
        }
        .preview-prose h3 {
          font-size: 16px; font-weight: 600; margin: 28px 0 6px;
          color: var(--text-primary); line-height: 1.4;
        }
        .preview-prose p { margin-bottom: 16px; color: var(--text-primary); }
        .preview-prose code {
          font-family: var(--font-mono);
          font-size: 0.85em;
          background: var(--bg-hover);
          padding: 0.1em 0.35em;
          border-radius: 3px;
          color: var(--color-red);
        }
        .preview-prose pre {
          background: var(--bg-code);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 16px; overflow-x: auto; margin: 16px 0;
        }
        .preview-prose pre code {
          background: none; padding: 0; color: var(--text-primary);
          font-size: 13px; line-height: 1.6;
        }
        .preview-prose blockquote {
          border-left: 3px solid var(--border-strong); margin: 16px 0;
          padding: 8px 16px; color: var(--text-secondary);
          background: var(--bg-sidebar); border-radius: 0 4px 4px 0;
        }
        .preview-prose blockquote p { margin-bottom: 0; color: var(--text-secondary); }
        .preview-prose ul, .preview-prose ol { padding-left: 24px; margin-bottom: 16px; }
        .preview-prose li { margin-bottom: 6px; color: var(--text-primary); }
        .preview-prose a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .preview-prose hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
        .preview-prose table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .preview-prose th {
          background: var(--bg-hover); padding: 8px 12px; text-align: left;
          font-weight: 500; border-bottom: 1px solid var(--border-strong); font-family: var(--font-sans);
        }
        .preview-prose td { padding: 8px 12px; border-bottom: 1px solid var(--border); font-family: var(--font-sans); }
        .preview-prose strong { color: var(--text-primary); font-weight: 600; }
        .preview-prose img { max-width: 100%; border-radius: 6px; }

        /* ── Frontmatter tags ── */
        .frontmatter-tags {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;
        }
        .frontmatter-tag {
          font-size: 11px; font-weight: 500;
          color: var(--accent);
          background: var(--accent-bg);
          padding: 2px 8px; border-radius: 12px;
          font-family: var(--font-sans);
        }

        /* ── Mermaid diagrams ── */
        .mermaid-diagram {
          background: var(--bg-code);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px;
          margin: 8px 0;
          overflow-x: auto;
        }
        .mermaid-diagram svg { display: block; height: auto; }
        .mermaid-error {
          border-left: 3px solid var(--color-red) !important;
          padding-left: 12px !important;
        }
        .mermaid-error code { color: var(--color-red); }

        /* ── Chart blocks ── */
        .chart-block-wrapper {
          background: var(--bg-code);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin: 1.2em 0;
          max-width: 100%;
        }
        .chart-error {
          background: var(--bg-code);
          border: 1px solid var(--border);
          border-left: 3px solid var(--color-red);
          border-radius: 6px;
          padding: 12px 16px;
          margin: 1.2em 0;
          font-size: 13px;
          color: var(--color-red);
        }

        /* ── Inline text colours ── */
        .preview-prose .c-muted  { color: var(--text-muted); }
        .preview-prose .c-red    { color: var(--color-red); }
        .preview-prose .c-orange { color: var(--color-amber); }
        .preview-prose .c-yellow { color: #A07030; }
        .preview-prose .c-green  { color: var(--accent); }
        .preview-prose .c-blue   { color: var(--color-blue); }
        .preview-prose .c-purple { color: #6040A0; }
      `}</style>
    </div>
  )
}
