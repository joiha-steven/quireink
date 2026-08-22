// Theme system with 4 modes: light, dark, system (OS), time (dark 18:00-06:00).
// The chosen MODE is persisted; the RESOLVED light/dark is applied as a class
// on <html>. A no-FOUC inline script (in the root layout) sets the initial
// class before paint, so this provider only keeps it in sync afterwards.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system' | 'time'

const STORAGE_KEY = 'theme'

// Is it "night" by clock? Dark from 18:00 to 06:00.
function isNightHour(): boolean {
  const h = new Date().getHours()
  return h >= 18 || h < 6
}

// Resolve a mode to an actual light/dark choice.
function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return isNightHour() ? 'dark' : 'light'
}

function apply(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolve(mode) === 'dark')
}

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void }
const ThemeContext = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init from localStorage (the no-FOUC script already set the class).
  // Mode-dependent UI only shows inside the open dropdown, so no hydration issue.
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system'
  })

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
    apply(m)
  }, [])

  // Keep the class in sync for dynamic modes (OS change, clock crossing 18/06).
  useEffect(() => {
    apply(mode)
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => apply('system')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    if (mode === 'time') {
      const id = setInterval(() => apply('time'), 60_000)
      return () => clearInterval(id)
    }
  }, [mode])

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
