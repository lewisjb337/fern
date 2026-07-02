import React, { useEffect, useRef, useState } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { vim } from '@replit/codemirror-vim'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import { SlashMenu, filterItems, type SlashItem } from './SlashMenu'

interface EditorProps {
  content: string
  onChange: (value: string) => void
  vimMode?: boolean
  fontSize?: number
  lineHeight?: number
  spellCheck?: boolean
  folderPath?: string | null
  isDark?: boolean
}

function makeHighlight(dark: boolean) {
  const heading = dark ? '#E9E9E7' : '#37352F'
  const strong  = dark ? '#E9E9E7' : '#37352F'
  const link    = dark ? '#5DC09E' : '#1A5C43'
  const url     = dark ? '#4DAB8C' : '#2F7C5F'
  const code    = dark ? '#FF8A80' : '#EB5757'
  const codeBg  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(135,131,120,0.15)'
  const muted   = dark ? '#6B6B6B' : '#9A9589'
  const punct   = dark ? '#555555' : '#C7C4BD'
  return HighlightStyle.define([
    { tag: tags.heading1, fontWeight: '700', fontSize: '1.875em', color: heading, lineHeight: '1.3' },
    { tag: tags.heading2, fontWeight: '600', fontSize: '1.5em',   color: heading, lineHeight: '1.35' },
    { tag: tags.heading3, fontWeight: '600', fontSize: '1.25em',  color: heading, lineHeight: '1.4' },
    { tag: tags.strong, fontWeight: '600', color: strong },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.link, color: link, textDecoration: 'underline' },
    { tag: tags.url, color: url },
    { tag: tags.monospace, fontFamily: "'JetBrains Mono', 'Menlo', monospace", fontSize: '0.875em', color: code, background: codeBg, borderRadius: '3px', padding: '0.1em 0.3em' },
    { tag: tags.comment, color: muted },
    { tag: tags.keyword, color: '#E5C07B' },
    { tag: tags.string, color: '#98C379' },
    { tag: tags.processingInstruction, color: muted },
    { tag: tags.punctuation, color: punct },
  ])
}

function makeTheme(fontSize: number, lineHeight: number, dark: boolean) {
  const text    = dark ? '#E9E9E7' : '#37352F'
  const cursor  = dark ? '#E9E9E7' : '#37352F'
  const placeholder = dark ? '#555555' : '#C7C4BD'
  return EditorView.theme({
    '&': {
      background: 'transparent',
      color: text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      fontSize: `${fontSize}px`,
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': {
      padding: '0 0 40px',
      lineHeight: `${lineHeight}`,
      caretColor: 'var(--accent)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontWeight: '400',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    },
    '.cm-line': { padding: '0' },
    '.cm-cursor': { borderLeftColor: cursor, borderLeftWidth: '1.5px' },
    '.cm-selectionBackground': { background: 'rgba(26,92,67,0.18) !important' },
    '&.cm-focused .cm-selectionBackground': { background: 'rgba(26,92,67,0.28) !important' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { background: 'transparent' },
    '.cm-scroller': { overflow: 'auto', height: '100%' },
    '.cm-placeholder': {
      color: placeholder,
      fontStyle: 'normal',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      fontSize: `${fontSize}px`,
    },
  })
}

interface SlashState {
  query: string
  from: number
  coords: { left: number; bottom: number }
}

export function Editor({ content, onChange, vimMode = false, fontSize = 15, lineHeight = 1.7, spellCheck = true, folderPath, isDark = false }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  // Set to true during programmatic content replacement (tab switch) so the
  // updateListener doesn't treat it as a user edit and mark the file dirty.
  const isProgrammaticUpdate = useRef(false)

  const [dropOver, setDropOver] = useState(false)
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const slashMenuRef = useRef<SlashState | null>(null)
  slashMenuRef.current = slashMenu
  const slashIndexRef = useRef(0)
  slashIndexRef.current = slashIndex

  // Compartments for hot-swappable extensions
  const vimCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const highlightCompartment = useRef(new Compartment())

  function applySlashItem(item: SlashItem) {
    const menu = slashMenuRef.current
    const view = viewRef.current
    if (!menu || !view) return
    const cursor = view.state.selection.main.head
    view.dispatch({
      changes: { from: menu.from, to: cursor, insert: item.template },
      selection: { anchor: menu.from + item.cursorAt },
    })
    setSlashMenu(null)
    setSlashIndex(0)
    view.focus()
  }

  useEffect(() => {
    if (!editorRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isProgrammaticUpdate.current) onChangeRef.current(update.state.doc.toString())

      const state = update.state
      const cursor = state.selection.main.head
      const line = state.doc.lineAt(cursor)
      const prefix = line.text.slice(0, cursor - line.from)
      const match = prefix.match(/\/(\w*)$/)

      if (match) {
        const slashPos = cursor - match[0].length
        const coords = update.view.coordsAtPos(slashPos)
        if (coords) {
          const newQuery = match[1]
          setSlashMenu((prev) => {
            if (prev?.query !== newQuery) setSlashIndex(0)
            return { query: newQuery, from: slashPos, coords: { left: coords.left, bottom: coords.bottom } }
          })
        }
      } else {
        setSlashMenu(null)
      }
    })

    const slashKeymap = keymap.of([
      {
        key: 'ArrowDown',
        run: () => {
          if (!slashMenuRef.current) return false
          const items = filterItems(slashMenuRef.current.query)
          setSlashIndex((i) => Math.min(i + 1, items.length - 1))
          return true
        },
      },
      {
        key: 'ArrowUp',
        run: () => {
          if (!slashMenuRef.current) return false
          setSlashIndex((i) => Math.max(i - 1, 0))
          return true
        },
      },
      {
        key: 'Enter',
        run: () => {
          if (!slashMenuRef.current) return false
          const items = filterItems(slashMenuRef.current.query)
          const item = items[slashIndexRef.current]
          if (item) applySlashItem(item)
          return !!item
        },
      },
      {
        key: 'Escape',
        run: () => {
          if (!slashMenuRef.current) return false
          setSlashMenu(null)
          return true
        },
      },
    ])

    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        vimCompartment.current.of(vimMode ? vim() : []),
        slashKeymap,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        search({ top: false }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        highlightCompartment.current.of(syntaxHighlighting(makeHighlight(isDark))),
        themeCompartment.current.of(makeTheme(fontSize, lineHeight, isDark)),
        EditorView.lineWrapping,
        updateListener,
        EditorState.tabSize.of(2),
        placeholder('Start writing… or type / for commands'),
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    // Spell check
    view.contentDOM.setAttribute('spellcheck', spellCheck ? 'true' : 'false')
    view.contentDOM.setAttribute('lang', 'en')

    // Emit scroll events for outline active-section tracking
    // Scroll happens on the outer wrapper (cm-scroller is overflow:visible)
    const wrapper = wrapperRef.current
    const editorHost = editorRef.current
    const onScroll = () => {
      try {
        const scrollTop = wrapper ? wrapper.scrollTop : 0
        // Offset by the editor host's top position within the wrapper
        const editorOffsetTop = editorHost ? editorHost.offsetTop : 0
        // +90 offset so headings jumped to with 80px margin are still detected as active
        const editorScrollPos = Math.max(0, scrollTop - editorOffsetTop + 90)
        const block = view.lineBlockAtHeight(editorScrollPos)
        const lineNum = view.state.doc.lineAt(block.from).number
        window.dispatchEvent(new CustomEvent('fern:visible-line', { detail: { line: lineNum } }))
      } catch {}
    }
    wrapper?.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      wrapper?.removeEventListener('scroll', onScroll)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external content changes (file switch)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      isProgrammaticUpdate.current = true
      view.dispatch({ changes: { from: 0, to: current.length, insert: content } })
      isProgrammaticUpdate.current = false
      setSlashMenu(null)
    }
  }, [content])

  // Hot-swap vim mode without recreating the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: vimCompartment.current.reconfigure(vimMode ? vim() : []) })
  }, [vimMode])

  // Hot-swap theme (font size / line height / dark mode)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: [
      themeCompartment.current.reconfigure(makeTheme(fontSize, lineHeight, isDark)),
      highlightCompartment.current.reconfigure(syntaxHighlighting(makeHighlight(isDark))),
    ]})
  }, [fontSize, lineHeight, isDark])

  // Sync spellcheck setting
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.contentDOM.setAttribute('spellcheck', spellCheck ? 'true' : 'false')
  }, [spellCheck])

  // Jump-to-line from outline clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const { line } = (e as CustomEvent<{ line: number }>).detail
      const view = viewRef.current
      const wrapper = wrapperRef.current
      const editorHost = editorRef.current
      if (!view || !wrapper || !editorHost) return
      const clamped = Math.max(1, Math.min(line, view.state.doc.lines))
      const lineInfo = view.state.doc.line(clamped)
      // Use the block's top in CodeMirror's internal coordinate space,
      // then offset by the editor host's position within the wrapper.
      const block = view.lineBlockAt(lineInfo.from)
      const editorOffsetTop = editorHost.offsetTop
      const targetScrollTop = editorOffsetTop + block.top - 80
      wrapper.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
      // Immediately update the outline highlight to the correct heading
      window.dispatchEvent(new CustomEvent('fern:visible-line', { detail: { line: clamped } }))
    }
    window.addEventListener('fern:jump-to-line', handler)
    return () => window.removeEventListener('fern:jump-to-line', handler)
  }, [])

  // Open in-editor search panel on demand (command palette / shortcut)
  useEffect(() => {
    const handler = () => {
      const view = viewRef.current
      if (!view) return
      openSearchPanel(view)
    }
    window.addEventListener('fern:open-search', handler)
    return () => window.removeEventListener('fern:open-search', handler)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    const hasImage = Array.from(e.dataTransfer.items).some((i) => i.type.startsWith('image/'))
    if (!hasImage) return
    e.preventDefault()
    setDropOver(true)
  }

  const handleDragLeave = () => setDropOver(false)

  const handleDrop = async (e: React.DragEvent) => {
    setDropOver(false)
    const imageFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length || !folderPath) return
    e.preventDefault()
    for (const file of imageFiles) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = (file as any).path as string
      if (!src) continue
      const dest = folderPath.replace(/[\\/]+$/, '') + '/assets/' + file.name
      await window.fern.copyFile(src, dest)
      const ref = `![${file.name.replace(/\.[^.]+$/, '')}](assets/${file.name})`
      const view = viewRef.current
      if (view) {
        const cursor = view.state.selection.main.head
        view.dispatch({ changes: { from: cursor, insert: ref + '\n' } })
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="editor-wrapper"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropOver && (
        <div className="editor-drop-overlay">
          Drop image to insert
        </div>
      )}
      <div className="editor-column">
        <div className="editor-cm-host" ref={editorRef} />
      </div>

      {slashMenu && (
        <SlashMenu
          query={slashMenu.query}
          coords={slashMenu.coords}
          selectedIndex={slashIndex}
          onSelect={applySlashItem}
          onChangeIndex={setSlashIndex}
        />
      )}

      <style>{`
        .editor-wrapper {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-app);
          position: relative;
        }
        .editor-drop-overlay {
          position: absolute;
          inset: 0;
          border: 2px dashed var(--accent);
          border-radius: 6px;
          background: var(--accent-bg);
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: var(--accent);
          z-index: 10;
          font-family: var(--font-sans);
        }
        .editor-column {
          max-width: 720px;
          margin: 0 auto;
          padding: 96px 56px 64px;
        }
        .editor-cm-host {
          min-height: 300px;
        }
        .editor-cm-host .cm-editor {
          height: auto;
          min-height: 200px;
        }
        .editor-cm-host .cm-scroller {
          overflow: visible !important;
        }
      `}</style>
    </div>
  )
}
