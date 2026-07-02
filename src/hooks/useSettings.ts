import { useState, useCallback, useEffect } from 'react'
import type { FernSettings } from '../types/fern.d'

const DEFAULT_SETTINGS: FernSettings = {
  vimMode: false,
  fontSize: 15,
  lineHeight: 1.7,
  autosaveDelay: 800,
  showWordCount: true,
  showOutline: true,
  embedCacheDuration: 30,
  theme: 'system',
  spellCheck: true,
}

export function useSettings() {
  const [settings, setSettings] = useState<FernSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.fern.getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  const updateSetting = useCallback(async (patch: Partial<FernSettings>) => {
    const updated = await window.fern.setSettings(patch)
    setSettings(updated)
    return updated
  }, [])

  return { settings, updateSetting, settingsLoaded: loaded }
}
