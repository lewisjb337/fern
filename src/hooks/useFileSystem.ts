import { useState, useCallback, useRef } from 'react'
import type { FileNode } from '../types/fern.d'

// Recursively update file paths after a rename/move
function renamePaths(nodes: FileNode[], oldPath: string, newPath: string): FileNode[] {
  const sep = oldPath.includes('\\') ? '\\' : '/'
  const prefix = oldPath + sep
  return nodes.map(node => {
    let p = node.path
    if (p === oldPath) p = newPath
    else if (p.startsWith(prefix)) p = newPath + sep + p.slice(prefix.length)
    const name = node.path === oldPath ? newPath.split(/[\\/]/).pop() ?? node.name : node.name
    return {
      ...node,
      path: p,
      name,
      children: node.children ? renamePaths(node.children, oldPath, newPath) : undefined,
    }
  })
}

// Migrate color keys after a rename/move
function migrateColors(colors: Record<string, string>, oldPath: string, newPath: string): Record<string, string> {
  const sep = oldPath.includes('\\') ? '\\' : '/'
  const prefix = oldPath + sep
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(colors)) {
    if (k === oldPath) result[newPath] = v
    else if (k.startsWith(prefix)) result[newPath + sep + k.slice(prefix.length)] = v
    else result[k] = v
  }
  return result
}

function getChildNames(nodes: FileNode[], targetPath: string): Set<string> {
  // If targetPath matches a folder in the tree, return its children's names
  function search(nodes: FileNode[]): Set<string> | null {
    for (const node of nodes) {
      if (node.path === targetPath && node.type === 'folder') {
        return new Set((node.children ?? []).map((c) => c.name.toLowerCase()))
      }
      if (node.children) {
        const found = search(node.children)
        if (found) return found
      }
    }
    return null
  }
  const result = search(nodes)
  // Fall back to root level
  if (!result) return new Set(nodes.map((n) => n.name.toLowerCase()))
  return result
}

export function useFileSystem() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [fileColors, setFileColorsState] = useState<Record<string, string>>({})
  const [writeError, setWriteError] = useState<string | null>(null)
  const folderPathRef = useRef<string | null>(null)
  folderPathRef.current = folderPath

  const refreshFiles = useCallback(async (fp?: string) => {
    const target = fp ?? folderPathRef.current
    if (!target) return
    const tree = await window.fern.listFiles(target)
    setFiles(tree)
  }, [])

  const loadFolder = useCallback(async (fp: string) => {
    setFolderPath(fp)
    folderPathRef.current = fp
    await window.fern.setLastFolder(fp)
    const [tree, colors] = await Promise.all([
      window.fern.listFiles(fp),
      window.fern.getFileColors(),
    ])
    setFiles(tree)
    setFileColorsState(colors)
  }, [])

  const openFolder = useCallback(async () => {
    const selected = await window.fern.openFolder()
    if (!selected) return selected
    await loadFolder(selected)
    return selected
  }, [loadFolder])

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    return window.fern.readFile(filePath)
  }, [])

  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    try {
      await window.fern.writeFile(filePath, content)
      setWriteError(null)
    } catch {
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath
      setWriteError(fileName)
      setTimeout(() => setWriteError(null), 3000)
    }
  }, [])

  const uniqueFileName = useCallback(
    (base = 'untitled', inFolder?: string): string => {
      const targetFolder = inFolder ?? folderPathRef.current ?? ''
      const existing = getChildNames(files, targetFolder)
      let name = `${base}.md`
      let i = 1
      while (existing.has(name.toLowerCase())) {
        name = `${base}-${i}.md`
        i++
      }
      return name
    },
    [files]
  )

  const uniqueFolderName = useCallback(
    (base = 'new-folder', inFolder?: string): string => {
      const targetFolder = inFolder ?? folderPathRef.current ?? ''
      const existing = getChildNames(files, targetFolder)
      let name = base
      let i = 1
      while (existing.has(name.toLowerCase())) {
        name = `${base}-${i}`
        i++
      }
      return name
    },
    [files]
  )

  const createFile = useCallback(
    async (fileName: string, content: string, targetFolder?: string): Promise<string | null> => {
      const fp = targetFolder ?? folderPathRef.current
      if (!fp) return null
      const filePath = await window.fern.createFile(fp, fileName, content)
      await refreshFiles()
      return filePath
    },
    [refreshFiles]
  )

  const createFolder = useCallback(
    async (name: string, parentPath?: string): Promise<string | null> => {
      const fp = parentPath ?? folderPathRef.current
      if (!fp) return null
      const sep = fp.includes('\\') ? '\\' : '/'
      const folderFullPath = `${fp.replace(/[\\/]+$/, '')}${sep}${name}`
      await window.fern.createFolder(folderFullPath)
      await refreshFiles()
      return folderFullPath
    },
    [refreshFiles]
  )

  const renameFile = useCallback(
    async (oldPath: string, newName: string): Promise<string | null> => {
      const lastSep = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
      const parentDir = oldPath.slice(0, lastSep)
      const sep = oldPath.includes('\\') ? '\\' : '/'
      const newPath = `${parentDir}${sep}${newName}`
      try {
        // Optimistic local rename so UI updates instantly
        setFiles(prev => renamePaths(prev, oldPath, newPath))
        setFileColorsState(prev => migrateColors(prev, oldPath, newPath))

        // Actual rename + color migration on disk; then sync real tree in background
        await window.fern.renameFile(oldPath, newPath)
        refreshFiles() // fire-and-forget to sync any fs discrepancies
        return newPath
      } catch (err) {
        console.error('Rename failed:', err)
        await refreshFiles() // revert optimistic update
        return null
      }
    },
    [refreshFiles]
  )

  const deleteFile = useCallback(
    async (filePath: string): Promise<void> => {
      await window.fern.deleteFile(filePath)
      await refreshFiles()
    },
    [refreshFiles]
  )

  const moveFile = useCallback(
    async (srcPath: string, dstFolderPath: string): Promise<string | null> => {
      const sep = srcPath.includes('\\') ? '\\' : '/'
      const fileName = srcPath.split(/[\\/]/).pop() ?? ''
      const dstPath = `${dstFolderPath.replace(/[\\/]+$/, '')}${sep}${fileName}`
      try {
        setFiles(prev => renamePaths(prev, srcPath, dstPath))
        setFileColorsState(prev => migrateColors(prev, srcPath, dstPath))
        await window.fern.moveFile(srcPath, dstPath)
        refreshFiles()
        return dstPath
      } catch (err) {
        console.error('Move failed:', err)
        await refreshFiles()
        return null
      }
    },
    [refreshFiles]
  )

  const showInFolder = useCallback(async (filePath: string): Promise<void> => {
    await window.fern.showInFolder(filePath)
  }, [])

  const setFileColor = useCallback(async (filePath: string, color: string | null): Promise<void> => {
    await window.fern.setFileColor(filePath, color)
    const colors = await window.fern.getFileColors()
    setFileColorsState(colors)
  }, [])

  return {
    folderPath,
    files,
    fileColors,
    writeError,
    openFolder,
    loadFolder,
    refreshFiles,
    readFile,
    writeFile,
    createFile,
    createFolder,
    renameFile,
    deleteFile,
    moveFile,
    showInFolder,
    setFileColor,
    uniqueFileName,
    uniqueFolderName,
  }
}
