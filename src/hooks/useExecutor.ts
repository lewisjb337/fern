import { useState, useEffect, useCallback, useRef } from 'react'

export type BlockStatus = 'idle' | 'running' | 'success' | 'error'

export interface BlockState {
  status: BlockStatus
  output: { text: string; stream: 'stdout' | 'stderr' }[]
  exitCode: number | null
  duration: number | null
  pid: number | null
}

export function useExecutor(folderPath: string | null) {
  const [blockStates, setBlockStates] = useState<Record<string, BlockState>>({})
  // Shared env persists across block runs in the same session
  const sessionEnv = useRef<Record<string, string>>({})
  // Accumulated stdout per block (for FERN_OUT_ env vars)
  const blockStdout = useRef<Record<string, string>>({})

  // Run-all pause state (blockId that errored and is awaiting user decision)
  const [runAllPausedAt, setRunAllPausedAt] = useState<string | null>(null)
  const pauseResolverRef = useRef<((action: 'continue' | 'stop') => void) | null>(null)

  // Pids currently known to be running, tracked outside blockStates so we
  // can still kill orphaned processes after a reset wipes the state that
  // would otherwise be the only place their pid was recorded.
  const activePids = useRef<Set<number>>(new Set())

  useEffect(() => {
    const removeListener = window.fern.onOutput(({ blockId, pid, chunk, stream }) => {
      if (pid > 0) activePids.current.add(pid)

      // Accumulate stdout for named block env vars
      if (stream === 'stdout') {
        blockStdout.current[blockId] = (blockStdout.current[blockId] ?? '') + chunk
      }

      setBlockStates((prev) => {
        const existing = prev[blockId] ?? {
          status: 'running' as BlockStatus,
          output: [],
          exitCode: null,
          duration: null,
          pid,
        }
        return {
          ...prev,
          [blockId]: {
            ...existing,
            output: [...existing.output, { text: chunk, stream }],
          },
        }
      })
    })
    return removeListener
  }, [])

  const runBlock = useCallback(
    async (blockId: string, code: string, runtime: string, namedId?: string | null): Promise<{ exitCode: number | null }> => {
      if (!folderPath) return { exitCode: null }

      // Clear previous stdout accumulation for this block
      blockStdout.current[blockId] = ''

      setBlockStates((prev) => ({
        ...prev,
        [blockId]: {
          status: 'running',
          output: [],
          exitCode: null,
          duration: null,
          pid: null,
        },
      }))

      let result: { exitCode: number | null; duration: number; pid: number }
      try {
        result = await window.fern.runBlock(
          blockId,
          code,
          runtime,
          folderPath,
          sessionEnv.current
        )
      } catch (err) {
        // ipcRenderer.invoke rejects instead of resolving with a failure
        // result if something throws before the main process attaches
        // process event listeners (e.g. child_process.spawn throwing
        // synchronously). Without this catch the block stays stuck on
        // "running" with no error shown.
        const message = err instanceof Error ? err.message : String(err)
        setBlockStates((prev) => ({
          ...prev,
          [blockId]: {
            ...prev[blockId],
            status: 'error',
            output: [...(prev[blockId]?.output ?? []), { text: `${message}\n`, stream: 'stderr' }],
            exitCode: 1,
            duration: 0,
            pid: null,
          },
        }))
        return { exitCode: 1 }
      }

      // After completion, store stdout as FERN_OUT_<namedId> if block has a named id
      if (namedId) {
        const stdout = blockStdout.current[blockId] ?? ''
        sessionEnv.current[`FERN_OUT_${namedId}`] = stdout.trim()
      }

      if (result.pid) activePids.current.delete(result.pid)

      setBlockStates((prev) => ({
        ...prev,
        [blockId]: {
          ...prev[blockId],
          status: result.exitCode === 0 ? 'success' : 'error',
          exitCode: result.exitCode,
          duration: result.duration,
          pid: result.pid,
        },
      }))

      return { exitCode: result.exitCode }
    },
    [folderPath]
  )

  const stopBlock = useCallback(async (blockId: string): Promise<void> => {
    const state = blockStates[blockId]
    if (state?.pid) {
      await window.fern.stopBlock(state.pid)
      setBlockStates((prev) => ({
        ...prev,
        [blockId]: { ...prev[blockId], status: 'error', exitCode: -1 },
      }))
    }
  }, [blockStates])

  const resolveRunAll = useCallback((action: 'continue' | 'stop') => {
    pauseResolverRef.current?.(action)
    setRunAllPausedAt(null)
  }, [])

  const runAllBlocks = useCallback(
    async (blocks: { id: string; code: string; runtime: string; namedId?: string | null }[]): Promise<void> => {
      for (const block of blocks) {
        const { exitCode } = await runBlock(block.id, block.code, block.runtime, block.namedId)

        if (exitCode !== 0 && exitCode !== null) {
          // Pause and wait for user to decide
          const decision = await new Promise<'continue' | 'stop'>((resolve) => {
            pauseResolverRef.current = resolve
            setRunAllPausedAt(block.id)
          })
          if (decision === 'stop') break
        }
      }
      setRunAllPausedAt(null)
    },
    [runBlock]
  )

  // Called whenever the active file changes (open/close/switch tabs). Clears
  // every block's state, cancels any in-flight Run All pause, and wipes the
  // session env. Block ids are `block-<charOffset>-<runtime>`, not scoped to
  // a file, so a full reset avoids state from one file leaking into another
  // at the same fence position.
  const resetBlocks = useCallback((_blockIds?: string[]) => {
    // Kill anything still running for the file we're leaving, otherwise it
    // keeps executing in the background and updates state for a block the
    // user can no longer see.
    for (const pid of activePids.current) {
      window.fern.stopBlock(pid)
    }
    activePids.current.clear()

    setBlockStates({})
    sessionEnv.current = {}
    blockStdout.current = {}
    if (pauseResolverRef.current) {
      pauseResolverRef.current('stop')
      pauseResolverRef.current = null
    }
    setRunAllPausedAt(null)
  }, [])

  const getBlockState = useCallback(
    (blockId: string): BlockState => {
      return blockStates[blockId] ?? {
        status: 'idle',
        output: [],
        exitCode: null,
        duration: null,
        pid: null,
      }
    },
    [blockStates]
  )

  const clearBlock = useCallback((blockId: string) => {
    setBlockStates((prev) => ({
      ...prev,
      [blockId]: { status: 'idle', output: [], exitCode: null, duration: null, pid: null },
    }))
  }, [])

  const getSessionEnv = useCallback(() => ({ ...sessionEnv.current }), [])

  return {
    blockStates,
    runBlock,
    stopBlock,
    runAllBlocks,
    resetBlocks,
    clearBlock,
    getBlockState,
    getSessionEnv,
    runAllPausedAt,
    resolveRunAll,
  }
}
