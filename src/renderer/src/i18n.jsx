import { createContext, useContext, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import { ES } from './i18n-es'

// UI language only. Client-facing output (PDF invoices, email drafts) is
// intentionally NOT translated — it always stays in English.

// Mirrors the current language outside React state so fmtDate() (a plain
// function, not a hook) can read it without needing a component to pass it in.
let current = localStorage.getItem('lang') || 'en'

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s })

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(current)

  const setLang = useCallback((l) => {
    current = l
    localStorage.setItem('lang', l)
    setLangState(l)
  }, [])

  // t('Save') → 'Guardar' in Spanish, or the English string itself otherwise.
  // Supports templates: t('Showing {n} bills', { n: 4 }).
  const t = useCallback((s, vars) => {
    let out = lang === 'es' ? (ES[s] ?? s) : s
    if (vars) {
      for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v)
    }
    return out
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

/** Returns `{ lang, setLang, t }` from the nearest LanguageProvider. */
export function useLang() {
  return useContext(LanguageContext)
}

// Locale-aware date-fns format for DISPLAYED dates (month/weekday names).
// Never use this for values that are stored or compared (e.g. 'yyyy-MM-dd').
export function fmtDate(date, pattern) {
  return format(date, pattern, current === 'es' ? { locale: esLocale } : undefined)
}
