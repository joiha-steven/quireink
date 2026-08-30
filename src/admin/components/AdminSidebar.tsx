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
import Link from '@/admin/router'
import { usePathname } from '@/admin/router'
import { useEffect, useState, type ReactNode } from 'react'
import type { SiteLang } from '@/types'
import { useAdminT } from './I18nProvider'
import { SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE, SIDEBAR_NAV_QUIET, SIDEBAR_UTIL } from './headerActions'
import { CacheButton } from './CacheButton'
import { BrandMark, BrandWord } from './Wordmark'
import { openPalette } from './CommandPalette'
import { chordFor, printChord, tip } from './editorKeys'
import { ThemeToggle } from '@/admin/ui/ThemeToggle'
import {
  IconHome, IconAnalytics, IconContent, IconComment, IconMedia, IconNewsletter, IconTrash, IconSettings,
  IconLog, IconExternal, IconCache, IconSignOut, IconChevronLeft, IconHelp, IconGlyphs, IconMore, IconAssistant,
  IconSearch,
} from './navIcons'

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
 * Whether the rail draws icons BESIDE ITS LABELS. OFF by default since 2026-08-15, at the
 * owner's instruction: the rail does not need them. Eleven outline
 * glyphs down the left edge are eleven things to look at before reading the word that was
 * always going to be the thing you read; the labels alone are shorter to scan and quieter.
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
}: {
  lang: SiteLang
  signOut: () => Promise<void>
}) {
  const t = useAdminT()
  const pathname = usePathname()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop rail
  const [icons, setIcons] = useState(false) // glyphs beside the labels
  const [more, setMore] = useState(false) // "everything else" group
  const close = () => setOpen(false)

  // Publish the current desktop rail width as a CSS var so fixed-position chrome
  // (e.g. the settings save bar) can offset past the sidebar at any collapse state.
  const applyWidthVar = (c: boolean) =>
    document.documentElement.style.setProperty('--admin-nav-w', c ? '4.5rem' : '13rem')

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
      setIcons(localStorage.getItem(ICONS_KEY) === '1')
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

  /**
   * Four destinations, and everything else one click further (ADR 0024 step 6).
   *
   * The rail held eleven rows, which is eleven decisions before the one that matters. These
   * four are what the owner is here to do: see how it went, write, put a picture in, send it
   * out. **Analytics is not among them and that is the point** — the numbers moved onto the
   * home screen, so the rail no longer offers a second door to them; the full screen is still
   * one click from the cards that show them.
   */
  const primary = [
    { href: '/admin', label: t.navHome, icon: <IconHome /> },
    { href: '/admin/content', label: t.navWrite, icon: <IconContent /> },
    { href: '/admin/media', label: t.navMedia, icon: <IconMedia /> },
    { href: '/admin/newsletter', label: t.navNewsletter, icon: <IconNewsletter /> },
  ]

  // Everything that is not writing is secondary. Not removed — moved.
  //
  // The assistant is FIRST here and not in the four above, which is where it was put on
  // 2026-08-23 and where the tour caught it on 2026-08-24: `the rail is four` failed with
  // "the rail offers 5 destinations at rest". The rule is not a formality — the rail held
  // eleven rows once, and every addition since has had an argument as good as this one.
  // Promoting it is the owner's call to make, not a side effect of building it.
  const secondary = [
    { href: '/admin/assistant', label: t.navAssistant, icon: <IconAssistant /> },
    { href: '/admin/analytics', label: t.navAnalytics, icon: <IconAnalytics /> },
    { href: '/admin/comments', label: t.commentsNavTitle, icon: <IconComment /> },
    { href: '/admin/trash', label: t.navTrash, icon: <IconTrash /> },
    { href: '/admin/settings', label: t.navSettings, icon: <IconSettings /> },
    { href: '/admin/log', label: t.navLog, icon: <IconLog /> },
    { href: '/admin/help', label: t.navHelp, icon: <IconHelp /> },
  ]

  const isActive = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)

  const inSecondary = secondary.some((l) => isActive(l.href))
  // Opened by the owner, or by ARRIVING somewhere inside it: a rail that hides the page you
  // are on tells you nothing about where you are. Kept as state rather than derived, so the
  // control still closes the group while standing on one of its pages.
  useEffect(() => {
    if (inSecondary) setMore(true)
  }, [inSecondary])

  // `c` = render collapsed (icon-only). Mobile drawer always passes false.
  const rowClass = (c: boolean, active = false): string =>
    // The active row takes the QUIET base: a highlighted row has nothing to gain from a
    // hover state — you are already there — and the grey one would paint over the mark.
    `${active ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV} ${c ? 'justify-center' : 'gap-3'} ${active ? SIDEBAR_NAV_ACTIVE : ''}`

  const navLink = (l: { href: string; label: string; icon: ReactNode }, c: boolean): ReactNode => (
    <Link
      key={l.href}
      href={l.href}
      onClick={close}
      aria-current={isActive(l.href) ? 'page' : undefined}
      title={c ? l.label : undefined}
      className={rowClass(c, isActive(l.href))}
    >
      {(c || icons) && l.icon}
      {!c && <span className="truncate">{l.label}</span>}
    </Link>
  )

  const navItems = (c: boolean): ReactNode => (
    <>
      {/* SEARCH IS NOT A DESTINATION, so it is not a nav row: it wears the control class the
          footer's switches wear, sits above the rail rather than in it, and is separated by a
          rule. The same distinction that moved "Show icons" out of the drawer.
          It exists because ⌘K cannot be discovered. Printing the chord ON the control is how
          a mouse teaches a keyboard: click it once, read what it says, and the second time
          your hands do it without the mouse. Collapsed, the glyph is all there is room for and
          the chord lives in the tooltip. */}
      <button
        type="button"
        onClick={() => { close(); openPalette() }}
        title={c ? tip(t.paletteTitle, 'palette') : undefined}
        className={`${SIDEBAR_UTIL} mb-1 border-b border-neutral-200 pb-2 dark:border-neutral-800 ${c ? 'justify-center' : 'justify-between gap-2.5'}`}
      >
        <span className={`flex items-center ${c ? '' : 'gap-2.5'}`}>
          <IconSearch />
          {!c && <span className="truncate">{t.paletteTitle}</span>}
        </span>
        {!c && (
          <span className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {printChord(chordFor('palette'))}
          </span>
        )}
      </button>

      {primary.map((l) => navLink(l, c))}

      {/* The one row in this column that names no destination, so it is a button rather than
          a Link, and the chevron says which way it will move. */}
      <button
        type="button"
        onClick={() =>
          setMore((v) => {
            const next = !v
            localStorage.setItem(MORE_KEY, next ? '1' : '0')
            return next
          })
        }
        aria-expanded={more}
        title={c ? t.navMore : undefined}
        className={`${rowClass(c)} ${!c ? 'justify-between' : ''}`}
      >
        <span className={`flex min-w-0 items-center ${c ? '' : 'gap-3'}`}>
          {(c || icons) && <IconMore />}
          {!c && <span className="truncate">{t.navMore}</span>}
        </span>
        {!c && (
          <span className={`grid place-items-center transition-transform ${more ? 'rotate-90' : '-rotate-90'}`}>
            <IconChevronLeft />
          </span>
        )}
      </button>

      {more && (
        // Indented by a rule rather than by padding: `SIDEBAR_NAV` is the one row string every
        // item in this column shares (`headerActions.ts`), and a per-item `pl-6` here is how
        // that rule stops being true. Collapsed, there is nothing to indent — the rail is
        // 72px of centred glyphs — so the wrapper only draws on the wide rail.
        <div className={c ? 'contents' : 'ml-3 flex flex-col gap-1 border-l border-neutral-200 pl-1 dark:border-neutral-800'}>
          {secondary.map((l) => navLink(l, c))}
          <a href="/" target="_blank" rel="noopener" onClick={close} title={c ? t.navViewBlog : undefined} className={rowClass(c)}>
            {(c || icons) && <IconExternal />}
            {!c && <span className="truncate">{t.navViewBlog}</span>}
          </a>
        </div>
      )}
    </>
  )

  // Footer controls: appearance (light/dark) + cache, then Sign out alone under a
  // divider so it reads as the "account" cluster (never confused with collapse).
  //
  // These wear SIDEBAR_UTIL, not SIDEBAR_NAV — they are controls, not destinations, and
  // dressed as nav rows they read as four more pages, one of them named "Light", which is
  // what made the rail read as subtly wrong on 2026-08-17. Their glyphs FOLLOW the "Show
  // icons" switch, corrected the same night when hiding the nav icons left Light, Clear
  // cache and Sign out still carrying theirs — one switch, one answer for the rail. The
  // collapsed rail still draws them: with no labels, glyphs are all a rail can be.
  const utilClass = (c: boolean): string => `${SIDEBAR_UTIL} ${c ? 'justify-center' : 'gap-2.5'}`
  const controls = (c: boolean): ReactNode => (
    <>
      {/* `variant='text'` in BOTH states, with the word dropped when collapsed. The rail needs
          one row object, and `variant='icon'` is the public header's — it ignores the row class
          and drew this line 4px left of the two under it. */}
      <ThemeToggle lang={lang} variant="text" showIcon={c || icons} showLabel={!c} triggerClassName={utilClass(c)} />
      {/* The icon switch, between the two other preferences about this machine. It was a
          footer row once, dressed in `SIDEBAR_NAV` — which is what made it read as a fifth
          page rather than as a control, and what sent it into the secondary drawer. Here it
          wears `SIDEBAR_UTIL` like the light switch above it, so the three things that change
          how the rail LOOKS on this machine sit together and none of them looks like a
          destination. Not in Settings (nothing about the blog changes), and never on the
          collapsed rail, where it would be an unlabelled glyph offering to remove the
          glyphs. */}
      {!c && (
        <button type="button" onClick={toggleIcons} className={utilClass(false)}>
          {icons && <IconGlyphs />}
          <span className="truncate">{icons ? t.navIconsHide : t.navIconsShow}</span>
        </button>
      )}
      <CacheButton className={utilClass(c)} icon={c || icons ? <IconCache /> : null} collapsed={c} />
      <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
        <form action={signOut} className="contents">
          <button className={utilClass(c)} title={c ? t.signOut : undefined}>
            {(c || icons) && <IconSignOut />}
            {!c && <span className="truncate">{t.signOut}</span>}
          </button>
        </form>
      </div>
    </>
  )

  // Wordmark, plus the compact collapse/expand button (desktop top row only). The
  // chevron points the direction it will move the rail; rotates when collapsed.
  const wordmark = (c: boolean): ReactNode => (
    <Link href="/admin" onClick={close} className="flex h-10 items-center px-3 leading-none">
      {c ? <BrandMark /> : <BrandWord />}
    </Link>
  )

  const collapseBtn = (
    <button
      type="button"
      onClick={toggleCollapsed}
      title={collapsed ? t.navExpand : t.navCollapse}
      aria-label={collapsed ? t.navExpand : t.navCollapse}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
    >
      <span className={`grid place-items-center transition-transform ${collapsed ? 'rotate-180' : ''}`}>
        <IconChevronLeft />
      </span>
    </button>
  )

  return (
    <>
      {/* Desktop: sticky full-height left column; width animates on collapse */}
      <aside
        // `z-30`, because `sticky` makes the rail its own stacking context: without a
        // z-index the CONTENT — a later sibling — painted over the theme menu that opens
        // from the rail's footer, and the menu read as cut off behind a media card.
        className={`sticky top-0 z-30 h-screen shrink-0 flex-col border-r border-neutral-200/80 bg-white px-3 py-5 transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-900 hidden lg:flex ${
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-52'
        }`}
      >
        {/* Top: wordmark + collapse control. Stacked when collapsed (no room for a row). */}
        <div className={collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between'}>
          {wordmark(collapsed)}
          {collapseBtn}
        </div>
        <nav className="mt-6 flex flex-col gap-1">{navItems(collapsed)}</nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-neutral-200 pt-4 dark:border-neutral-800">{controls(collapsed)}</div>
      </aside>

      {/* Mobile: top bar + drawer (always icon+label) */}
      <header className={`sticky top-0 z-20 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 flex lg:hidden`}>
        {wordmark(false)}
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
      </header>
      {open && (
        <>
          <button type="button" aria-label={t.navHome} onClick={close} className="fixed inset-0 top-[65px] z-20 bg-black/20 lg:hidden" />
          <nav className="fixed inset-x-3 top-[72px] z-30 scroll-fade max-h-[calc(100dvh-84px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
            {navItems(false)}
            <span className="my-1 block h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
            {controls(false)}
          </nav>
        </>
      )}
    </>
  )
}
