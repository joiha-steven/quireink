// Provides the admin language + strings to all admin client components.
// Language is held in state (seeded by the server `lang` prop) so the settings
// picker can switch the whole admin UI INSTANTLY, before the save round-trip.
// When the server re-renders with a new prop (after save + refresh), we re-sync.
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SiteLang } from '@/types'
import { adminT, type AdminStrings } from '@/i18n/admin-i18n'

type Ctx = { lang: SiteLang; t: AdminStrings; setLang: (l: SiteLang) => void }

const AdminI18nContext = createContext<Ctx | null>(null)

export function AdminI18nProvider({ lang, children }: { lang: SiteLang; children: ReactNode }) {
  const [current, setCurrent] = useState<SiteLang>(lang)
  // Re-sync when the server sends a newer language (post-save refresh). React's
  // sanctioned "adjust state on prop change during render" pattern (no effect).
  const [prevLang, setPrevLang] = useState<SiteLang>(lang)
  if (lang !== prevLang) {
    setPrevLang(lang)
    setCurrent(lang)
  }
  return (
    <AdminI18nContext.Provider value={{ lang: current, t: adminT(current), setLang: setCurrent }}>
      {children}
    </AdminI18nContext.Provider>
  )
}

function useCtx(): Ctx {
  const ctx = useContext(AdminI18nContext)
  if (!ctx) throw new Error('useAdminT must be used within AdminI18nProvider')
  return ctx
}

// Strings for the current admin language.
export function useAdminT(): AdminStrings {
  return useCtx().t
}

// Current admin language (for date formatting etc.).
export function useAdminLang(): SiteLang {
  return useCtx().lang
}

// Switch the admin UI language instantly (optimistic; persisted on save).
export function useSetAdminLang(): (l: SiteLang) => void {
  return useCtx().setLang
}
