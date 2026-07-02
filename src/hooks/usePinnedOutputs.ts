import { useState, useCallback, useEffect } from 'react'

export interface PinnedOutput {
  output: string
  pinnedAt: number
}

export function usePinnedOutputs(workspacePath: string | null, activeFile: string | null) {
  const [store, setStore] = useState<Record<string, Record<string, PinnedOutput>>>({})

  useEffect(() => {
    if (!workspacePath) return
    window.fern.getSnapshots(workspacePath).then((s) => {
      setStore(s as Record<string, Record<string, PinnedOutput>>)
    })
  }, [workspacePath, activeFile])

  const pinOutput = useCallback(async (blockKey: string, output: string) => {
    if (!workspacePath || !activeFile) return
    const pinnedAt = Date.now()
    await window.fern.setSnapshot(workspacePath, activeFile, blockKey, output, pinnedAt)
    setStore((prev) => ({
      ...prev,
      [activeFile]: { ...(prev[activeFile] ?? {}), [blockKey]: { output, pinnedAt } },
    }))
  }, [workspacePath, activeFile])

  const unpinOutput = useCallback(async (blockKey: string) => {
    if (!workspacePath || !activeFile) return
    await window.fern.clearSnapshot(workspacePath, activeFile, blockKey)
    setStore((prev) => {
      const fileSnaps = { ...(prev[activeFile] ?? {}) }
      delete fileSnaps[blockKey]
      return { ...prev, [activeFile]: fileSnaps }
    })
  }, [workspacePath, activeFile])

  const getPinned = useCallback((blockKey: string): PinnedOutput | null => {
    if (!activeFile) return null
    return store[activeFile]?.[blockKey] ?? null
  }, [store, activeFile])

  return { pinOutput, unpinOutput, getPinned }
}
