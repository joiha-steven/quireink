// Provides the admin language + strings to all admin client components.
// Language is held in state (seeded by the server `lang` prop) so the settings
// picker can switch the whole admin UI INSTANTLY, before the save round-trip.
// When the server re-renders with a new prop (after save + refresh), we re-sync.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SiteLang } from '@/types'
import { adminStrings, adminStringsReady, loadAdminStrings, type AdminStrings } from '@/admin/admin-strings'

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
  /**
   * The dictionary arrives one tick after the language does, for every language but English.
   *
   * Ten of the eleven are fetched on demand (`admin-strings.ts`), and a render cannot await
   * anything, so the first frame after a switch is drawn in whatever is already held. The
   * counter is what makes the second frame happen: nothing else about the tree has changed
   * when a chunk lands, so without it React has no reason to look again.
   */
  const [arrived, setArrived] = useState(0)
  const ready = adminStringsReady(current)
  useEffect(() => {
    if (ready) return
    let live = true
    void loadAdminStrings(current).then(() => { if (live) setArrived((n) => n + 1) })
    return () => { live = false }
  }, [current, ready])
  void arrived
  return (
    <AdminI18nContext.Provider value={{ lang: current, t: adminStrings(current), setLang: setCurrent }}>
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

/**
 * A message that names a SETTINGS TAB, with the tab's own translated name filled in.
 *
 * ⚠️ THE STRINGS USED TO SPELL THE TAB OUT, and ADR 0041 renamed every tab underneath them.
 * Six messages in eleven languages went on saying "Settings → AI", "Settings → Integrations"
 * and "Settings → System" after those three tabs stopped existing — instructions that send an
 * owner looking for a word that is not on the screen. The tab name is now a `{tab}` hole and
 * this fills it from the same dictionary entry the tab strip reads, so the next rename moves
 * the messages with it.
 */
export function useTabbed(): (message: string, tab: string) => string {
  return (message, tab) => message.replace('{tab}', tab)
}
