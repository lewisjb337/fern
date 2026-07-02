export interface CodeBlock {
  id: string              // unique React key (stable, position-based)
  blockId: string | null  // named id from id=<name> in info string
  runtime: string
  code: string
  runnable: boolean
  hidden: boolean
  startIndex: number
  endIndex: number
}

// All runtimes we can actually execute
export const RUNNABLE_RUNTIMES = new Set([
  'bash', 'sh',
  'node', 'javascript', 'js',
  'typescript', 'ts',
  'python', 'python3',
  'ruby', 'rb',
  'go',
  'deno',
  'bun',
  'php',
  'perl',
  'rust', 'rs',
  'powershell', 'pwsh',
  'http', 'https',
])

interface ParsedInfo {
  runtime: string
  runnable: boolean
  hidden: boolean
  blockId: string | null
}

function parseInfoString(info: string): ParsedInfo {
  const tokens = info.trim().split(/\s+/)
  // First token is always the language/runtime
  const runtime = (tokens[0] ?? '').toLowerCase()
  const runnable = tokens.includes('run') && RUNNABLE_RUNTIMES.has(runtime)
  const hidden = tokens.includes('hidden')
  const idToken = tokens.find((t) => t.startsWith('id='))
  const blockId = idToken ? idToken.slice(3) : null
  return { runtime, runnable, hidden, blockId }
}

// Parse every fenced code block (runnable or not)
export function parseAllBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  // Capture full info string (everything after ```)
  const pattern = /^```([^\n\r]*)\r?\n([\s\S]*?)^```/gm
  let match: RegExpExecArray | null

  while ((match = pattern.exec(markdown)) !== null) {
    const info = match[1] ?? ''
    const { runtime, runnable, hidden, blockId } = parseInfoString(info)

    blocks.push({
      id: `block-${match.index}-${runtime || 'plain'}`,
      blockId,
      runtime,
      code: match[2],
      runnable,
      hidden,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return blocks
}

// Convenience — only runnable blocks (for run-all, status bar)
export function parseRunBlocks(markdown: string): CodeBlock[] {
  return parseAllBlocks(markdown).filter((b) => b.runnable)
}

export function extractDocTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}
