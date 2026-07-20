import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Light/dark theme, persisted to localStorage and applied as a `dark` class
// on <html> (Tailwind's dark-mode selector). main.jsx applies the saved
// theme before first paint separately, to avoid a flash of the wrong theme.

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Returns `{ theme, toggleTheme }` from the nearest ThemeProvider. */
export function useTheme() {
  return useContext(ThemeContext)
}
