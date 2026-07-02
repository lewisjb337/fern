export const isMac = typeof navigator !== 'undefined'
  ? /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  : false

export const mod = isMac ? '⌘' : 'Ctrl'
export const modSymbol = isMac ? '⌘' : 'Ctrl+'

export function shortcut(key: string, shift = false): string {
  if (isMac) return shift ? `⌘⇧${key}` : `⌘${key}`
  return shift ? `Ctrl+Shift+${key}` : `Ctrl+${key}`
}
