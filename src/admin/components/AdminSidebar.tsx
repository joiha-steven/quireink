// Admin navigation as a LEFT SIDEBAR that collapses between icon+label and icon-only,
// persisted in localStorage. Below 1024px it is a slim top bar with a hamburger drawer.
//
// THE RAIL WAITS FOR 1024, NOT 768, and that is a measurement. At `md` it cost 208px, which
// made unfolding a phone a step BACKWARDS — measured 2026-08-28 on Settings: a Galaxy Z Fold
// upright and open is 673px and gave the form all of it; turned landscape it is 841px, the
// rail arrives, and the form is left 633. A 768px tablet fared worst at 560. The admin is
// forms and tables, so content width IS the product. At `lg` the sums turn: 1024 less the rail
// is 816, and below that the rail is one tap away in the drawer.
//
// FROM 1024 TO 1279 IT ARRIVES ALREADY SHUT (see NARROW below). The `lg` decision only asked
// WHETHER a rail belongs on screen, never how WIDE. In that band the answer is 72px, not 208:
// an iPad landscape and a foldable opened both sit there, and the icon rail hands back 136px
// without hiding the map behind a hamburger.
//
// Every nav item shares SIDEBAR_NAV so the rail reads as one set; monochrome by design. The
// collapse control sits at the TOP beside the wordmark as a chrome button, not a nav row, so
// it cannot be mistaken for Sign out — which sits alone in the footer under its own divider.
import { usePathname } from '@/admin/router'
import { useEffect, useState } from 'react'
import type { SiteLang, NavOrder } from '@/types'
import { useAdminT } from './I18nProvider'
import { secondaryNav } from './navDestinations'
import { useNavColumn } from './NavColumn'
import { OVERLAY } from './sheet'

const STORE_KEY = 'quireink-admin-nav-collapsed'
/**
 * The band where the rail costs more than it returns: wide enough that a rail belongs on
 * screen at all (the `lg` decision at the top of this file), but not wide enough to spend
 * 208px of it on words. An iPad in landscape and a foldable opened and turned both land here.
 *
 * Measured on the Settings screen: at 1024 the full rail leaves the form 816px and the icon
 * rail leaves it 952. That 136px is the whole reason this exists.
 *
 * It forces the rail shut WITHOUT writing localStorage. The stored value is what the owner
 * chose, and a window that happens to be 1100px wide is not them changing their mind; leaving
 * the band puts their own choice back. Clicking the control inside the band still persists,
 * because that IS them changing their mind.
 */
export const NARROW = '(min-width: 64rem) and (max-width: 79.9375rem)'
/**
 * Whether the rail draws icons BESIDE ITS LABELS. **ON by default since 2026-09-07**; the
 * switch stays, so a rail of pure words is one click away.
 *
 * It was OFF from 2026-08-15 on the argument that eleven outline glyphs are eleven things to
 * look at before the word you were going to read anyway. What retired that argument is the
 * rail it produced, measured 2026-09-07: after ADR 0024 the rail holds FOUR destinations and
 * a group, not eleven, and every row is 40px of 14px grey `oklch(0.556)` — one size, one
 * weight, one ink, nothing on the column but text. Four glyphs are not clutter; they are the
 * only thing on that rail a person can recognise without reading it.
 *
 * ⚠️ Beside its LABELS, which is why the collapsed rail ignores it and always draws them. A
 * collapsed rail has no labels — icons are the only thing it can be. The first version of this
 * read the setting as "no icons anywhere", so it had to hide the collapse control too, and the
 * owner's next words were that he could not find it. The two are separate wishes: one is about
 * how the rail reads, the other is about getting 208px back.
 *
 * A DEVICE preference, so it lives in localStorage beside the collapse state rather than in
 * site settings — the same reason the collapse state is not a setting. Nothing about the blog
 * changes; this is how one person's rail looks on one machine.
 */
const ICONS_KEY = 'quireink-admin-nav-icons'
/**
 * Whether "Everything else" stands open. The rule: an EXPLICIT toggle persists across
 * sessions in both directions — closed stays closed on the next visit, open stays open. Arriving on a page inside the group still opens it for the visit (a
 * rail that hides where you are is worse than a long one), but that visit-driven opening
 * is never WRITTEN: only the owner's own click on the row records a preference.
 */
const MORE_KEY = 'quireink-admin-nav-more'

export function AdminSidebar({
  lang,
  signOut,
  aiConfigured = false,
  navOrder,
}: {
  lang: SiteLang
  signOut: () => Promise<void>
  /** A model is plugged in, so the assistant is somewhere the owner goes. */
  aiConfigured?: boolean
  /** The owner's own running order for these rows (`content/nav-order.ts`). */
  navOrder: NavOrder
}) {
  const t = useAdminT()
  const pathname = usePathname()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop rail
  const [icons, setIcons] = useState(true) // glyphs beside the labels; see ICONS_KEY
  const [more, setMore] = useState(false) // "everything else" group
  const close = () => setOpen(false)

  // Publish the current desktop rail width as a CSS var so fixed-position chrome
  // (e.g. the settings save bar) can offset past the sidebar at any collapse state.
  // 4.5rem shut · 13rem open · 16rem while arranging — the three widths the aside's own class
  // list carries, and they have to be the same three numbers. Fixed chrome (the settings save
  // bar) offsets past the rail by this variable, so a rail that is 16rem wide while the
  // variable still says 13 puts that bar 48px into the rail it is supposed to clear.
  const applyWidthVar = (c: boolean, arranging = false) =>
    document.documentElement.style.setProperty('--admin-nav-w', c ? '4.5rem' : arranging ? '16rem' : '13rem')

  // Restore the desktop collapsed state after mount (client-only; server renders
  // expanded so hydration matches, then we sync). Deferred a microtask so the
  // setState isn't in the effect body.
  useEffect(() => {
    const mq = matchMedia(NARROW)
    // ONE place decides the rail's width, so the restore and the band cannot race: folding
    // this into the same effect is why there is no second `setCollapsed` anywhere.
    const apply = () => {
      const c = mq.matches || localStorage.getItem(STORE_KEY) === '1'
      setCollapsed(c)
      applyWidthVar(c)
    }
    Promise.resolve().then(() => {
      // ABSENT means default, which is now ON — so the test is against '0', not for '1'.
      // Reading `=== '1'` with the default flipped would have shown icons for one frame and
      // then taken them away on every load by anyone who had never touched the switch.
      setIcons(localStorage.getItem(ICONS_KEY) !== '0')
      apply()
      if (localStorage.getItem(MORE_KEY) === '1') setMore(true)
    })
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  function toggleIcons() {
    setIcons((v) => {
      const next = !v
      localStorage.setItem(ICONS_KEY, next ? '1' : '0')
      return next
    })
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem(STORE_KEY, next ? '1' : '0')
      applyWidthVar(next)
      return next
    })
  }

  const secondary = secondaryNav(t, aiConfigured)

  const isActive = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)

  const inSecondary = secondary.some((l) => isActive(l.href))
  // Opened by the owner, or by ARRIVING somewhere inside it: a rail that hides the page you
  // are on tells you nothing about where you are. Kept as state rather than derived, so the
  // control still closes the group while standing on one of its pages.
  useEffect(() => {
    if (inSecondary) setMore(true)
  }, [inSecondary])

  // Every row this rail can draw, in the owner's order — the top row, the destinations and the
  // controls, each a renderer taking one argument: whether to draw collapsed.
  const column = useNavColumn({
    lang,
    signOut,
    aiConfigured,
    navOrder,
    icons,
    more,
    onMore: () => setMore((v) => {
      const next = !v
      localStorage.setItem(MORE_KEY, next ? '1' : '0')
      return next
    }),
    onIcons: toggleIcons,
    onCollapse: toggleCollapsed,
    close,
    isActive,
  })

  // Arrange mode changes the rail's WIDTH, so it has to change the variable too.
  useEffect(() => {
    applyWidthVar(collapsed, column.arranging)
  }, [collapsed, column.arranging])

  return (
    <>
      {/* Desktop: sticky full-height left column; width animates on collapse */}
      <aside
        // `z-30`, because `sticky` makes the rail its own stacking context: without a
        // z-index the CONTENT — a later sibling — painted over the theme menu that opens
        // from the rail's footer, and the menu read as cut off behind a media card.
        className={`admin-case sticky top-0 z-30 h-[100dvh] shrink-0 flex-col px-3 py-5 transition-[width] duration-200 hidden lg:flex ${
          // WIDER WHILE ARRANGING, and it is a measurement rather than a preference: the grip
          // and the two steppers take 62px off a 208px rail, which left "Everything else" as
          // "Ever…" and "Collapse sidebar" as "Collapse sid…". A row you cannot read is a row
          // you cannot place. 256px puts every label back and returns to 208 on the way out.
          collapsed ? 'lg:w-[4.5rem]' : column.arranging ? 'lg:w-64' : 'lg:w-52'
        }`}
      >
        {/* Top: the wordmark and the search, and NOTHING else — measured, not preferred.
            The collapse control was here too for a while and the row could not hold it: the
            wordmark, a 40px search button, its chord badge and a 36px chevron need more than the
            184px inside a 208px rail, and a flex row whose items cannot shrink does not wrap,
            it OVERFLOWS. What gave way was the MARK, which is the one thing on this row that
            is not chrome. Collapse now lives with the rail's other preferences, at the foot.
            `min-w-0` on the wordmark so this row can never do that again. */}
        {column.top(collapsed)}
        {/* `mt-6` only when there IS a top row: with the wordmark switched off the column
            starts at the top of the rail, and the gap would be air over nothing. */}
        {/* `min-h-0` + `overflow-y-auto`: the column is the only part of a height-locked rail
            that can grow, and in arrange mode it grows by a floor per zone and a taller row
            each. Without this the footer controls — including the way OUT of arrange mode —
            are pushed past the bottom of the glass on a 900px screen. */}
        <nav className={`flex min-h-0 flex-col gap-1 overflow-y-auto ${column.top(collapsed) ? 'mt-6' : ''}`}>{column.nav(collapsed)}</nav>
        {/* Collapse lives with the rail's other CONTROLS, at the foot: it is a preference
            about this rail on this device, the same kind of thing as "Show icons" sitting
            beside it — not a destination, and not chrome competing with the wordmark. It is
            also where the hand already goes to change how the rail looks. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-neutral-200 pt-4 dark:border-neutral-800">{column.controls(collapsed)}</div>
      </aside>

      {/* Mobile: top bar + drawer (always icon+label) */}
      <header className={`admin-bar sticky top-0 z-20 items-center justify-between border-b border-neutral-200/80 px-4 py-3 backdrop-blur dark:border-neutral-800 flex lg:hidden`}>
        {column.top(false)}
        <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label={t.navHome}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </header>
      {open && (
        <>
          <button type="button" aria-label={t.navHome} onClick={close} className="fixed inset-0 top-[65px] z-20 bg-black/20 lg:hidden" />
          <nav className={`fixed inset-x-3 top-[72px] z-30 scroll-fade max-h-[calc(100dvh-84px)] overflow-y-auto p-3 lg:hidden ${OVERLAY}`}>
            {column.nav(false)}
            <span className="my-1 block h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
            {column.controls(false)}
          </nav>
        </>
      )}
    </>
  )
}
