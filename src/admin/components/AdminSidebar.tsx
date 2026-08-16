// Admin navigation as a LEFT SIDEBAR that collapses between icon+label and
// icon-only (desktop), persisted in localStorage. On mobile it's a slim top bar
// with a hamburger drawer (always icon+label). Every nav item shares SIDEBAR_NAV so
// the rail reads as one uniform set. Monochrome by design (admin tooling stays on
// the neutral scale — no hardcoded accent colors).
//
// LAYOUT INTENT: the collapse/expand control lives at the TOP next to the wordmark
// (a compact chrome button, NOT a nav row) so it can't be mistaken for Sign out;
// Sign out sits alone in the footer under its own divider (the "account" cluster).
// Palette selection is FRONTEND-ONLY now — the admin chrome only toggles light/dark.
import Link from '@/admin/router'
import { usePathname } from '@/admin/router'
import { useEffect, useState, type ReactNode } from 'react'
import type { SiteLang } from '@/types'
import { useAdminT } from './I18nProvider'
import { SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE } from './headerActions'
import { CacheButton } from './CacheButton'
import { BrandMark, BrandWord } from './Wordmark'
import { ThemeToggle } from '@/admin/ui/ThemeToggle'
import {
  IconHome, IconAnalytics, IconContent, IconComment, IconMedia, IconNewsletter, IconTrash, IconSettings,
  IconLog, IconExternal, IconCache, IconSignOut, IconChevronLeft, IconHelp, IconGlyphs, IconMore,
} from './navIcons'

const STORE_KEY = 'quireink-admin-nav-collapsed'
/**
 * Whether the rail draws icons BESIDE ITS LABELS. OFF by default since 2026-08-15, at the
 * owner's request: *"không cần icon bên sidebar, nó làm cho không cần thiết"*. Eleven outline
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

export function AdminSidebar({
  lang,
  signOut,
}: {
  lang: SiteLang
  signOut: () => Promise<void>
}) {
  const t = useAdminT()
  const pathname = usePathname()
  const editorMode = pathname.startsWith('/admin/editor') || pathname.startsWith('/admin/page-editor')
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
    if (editorMode) {
      document.documentElement.style.setProperty('--admin-nav-w', '0px')
      return
    }
    Promise.resolve().then(() => {
      const showIcons = localStorage.getItem(ICONS_KEY) === '1'
      const c = localStorage.getItem(STORE_KEY) === '1'
      setIcons(showIcons)
      setCollapsed(c)
      applyWidthVar(c)
    })
  }, [editorMode])

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

  // "mấy cái tính năng còn lại ngoài soạn thảo nội dung … chỉ là phụ." Not removed — moved.
  const secondary = [
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
    `${SIDEBAR_NAV} ${c ? 'justify-center' : 'gap-3'} ${active ? SIDEBAR_NAV_ACTIVE : ''}`

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
      {primary.map((l) => navLink(l, c))}

      {/* The one row in this column that names no destination, so it is a button rather than
          a Link, and the chevron says which way it will move. */}
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
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
  const controls = (c: boolean): ReactNode => (
    <>
      {/* `variant='text'` in BOTH states, with the word dropped when collapsed. The rail needs
          one row object, and `variant='icon'` is the public header's — it ignores the row class
          and drew this line 4px left of the two under it. */}
      <ThemeToggle lang={lang} variant="text" showIcon={c || icons} showLabel={!c} triggerClassName={rowClass(c)} />
      <CacheButton className={rowClass(c)} icon={c || icons ? <IconCache /> : null} collapsed={c} />
      {/* The icon switch, in the footer beside light/dark and Clear cache, because it is the
          same kind of thing: a preference about this rail on this machine. Not in Settings —
          nothing about the blog changes. Never shown collapsed, where it would be an unlabelled
          glyph offering to remove the glyphs. */}
      {!c && (
        <button type="button" onClick={toggleIcons} className={rowClass(false)}>
          {icons && <IconGlyphs />}
          <span className="truncate">{icons ? t.navIconsHide : t.navIconsShow}</span>
        </button>
      )}
      <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
        <form action={signOut} className="contents">
          <button className={rowClass(c)} title={c ? t.signOut : undefined}>
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
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent text-neutral-400 transition-colors hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-500 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
        className={`sticky top-0 h-screen shrink-0 flex-col border-r border-neutral-200/80 bg-white px-3 py-5 transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-900 ${editorMode ? 'hidden' : 'hidden md:flex'} ${
          collapsed ? 'md:w-[4.5rem]' : 'md:w-52'
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
      <header className={`sticky top-0 z-20 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 ${editorMode ? 'hidden' : 'flex md:hidden'}`}>
        {wordmark(false)}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
          <button type="button" aria-label={t.navHome} onClick={close} className="fixed inset-0 top-[65px] z-20 bg-black/20 md:hidden" />
          <nav className="fixed inset-x-3 top-[72px] z-30 scroll-fade max-h-[calc(100dvh-84px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl md:hidden dark:border-neutral-800 dark:bg-neutral-900">
            {navItems(false)}
            <span className="my-1 block h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
            {controls(false)}
          </nav>
        </>
      )}
    </>
  )
}
