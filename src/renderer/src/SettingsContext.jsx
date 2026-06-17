import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const DEFAULTS = { businessName: '', phone: '', email: '', logo: null }
const SettingsContext = createContext({ settings: DEFAULTS, reloadSettings: () => {} })

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

export function useSettings() {
  return useContext(SettingsContext)
}
