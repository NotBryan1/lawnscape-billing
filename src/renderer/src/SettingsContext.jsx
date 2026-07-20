import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Business settings (name, phone, email, logo) loaded once from disk via
// window.api.settings and shared app-wide, so every page that stamps them
// onto an invoice reads the same values without its own fetch.

const DEFAULTS = { businessName: '', phone: '', email: '', logo: null }
const SettingsContext = createContext({ settings: DEFAULTS, reloadSettings: () => {} })

/** Loads settings on mount; call `reloadSettings()` after saving changes elsewhere (e.g. the Settings page). */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)

  const reloadSettings = useCallback(async () => {
    const s = await window.api.settings.get()
    if (s) setSettings(s)
  }, [])

  useEffect(() => { reloadSettings() }, [reloadSettings])

  return (
    <SettingsContext.Provider value={{ settings, reloadSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

/** Returns `{ settings, reloadSettings }` from the nearest SettingsProvider. */
export function useSettings() {
  return useContext(SettingsContext)
}
