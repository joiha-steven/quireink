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
  IconLog, IconExternal, IconCache, IconSignOut, IconChevronLeft, IconHelp,
} from './navIcons'

const STORE_KEY = 'quireink-admin-nav-collapsed'

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
      const c = localStorage.getItem(STORE_KEY) === '1'
      setCollapsed(c)
      applyWidthVar(c)
    })
  }, [editorMode])

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem(STORE_KEY, next ? '1' : '0')
      applyWidthVar(next)
      return next
    })
  }

  const links = [
    { href: '/admin', label: t.navHome, icon: <IconHome /> },
    { href: '/admin/analytics', label: t.navAnalytics, icon: <IconAnalytics /> },
    { href: '/admin/content', label: t.navDashboard, icon: <IconContent /> },
    { href: '/admin/comments', label: t.commentsNavTitle, icon: <IconComment /> },
    { href: '/admin/media', label: t.navMedia, icon: <IconMedia /> },
    { href: '/admin/newsletter', label: t.navNewsletter, icon: <IconNewsletter /> },
    { href: '/admin/trash', label: t.navTrash, icon: <IconTrash /> },
    { href: '/admin/settings', label: t.navSettings, icon: <IconSettings /> },
    { href: '/admin/log', label: t.navLog, icon: <IconLog /> },
    { href: '/admin/help', label: t.navHelp, icon: <IconHelp /> },
  ]

  const isActive = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)

  // `c` = render collapsed (icon-only). Mobile drawer always passes false.
  const rowClass = (c: boolean, active = false): string =>
    `${SIDEBAR_NAV} ${c ? 'justify-center' : 'gap-3'} ${active ? SIDEBAR_NAV_ACTIVE : ''}`

  const navItems = (c: boolean): ReactNode => (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={close}
          aria-current={isActive(l.href) ? 'page' : undefined}
          title={c ? l.label : undefined}
          className={rowClass(c, isActive(l.href))}
        >
          {l.icon}
          {!c && <span className="truncate">{l.label}</span>}
        </Link>
      ))}
      <a href="/" target="_blank" rel="noopener" onClick={close} title={c ? t.navViewBlog : undefined} className={rowClass(c)}>
        <IconExternal />
        {!c && <span className="truncate">{t.navViewBlog}</span>}
      </a>
    </>
  )

  // Footer controls: appearance (light/dark) + cache, then Sign out alone under a
  // divider so it reads as the "account" cluster (never confused with collapse).
  const controls = (c: boolean): ReactNode => (
    <>
      <ThemeToggle lang={lang} variant={c ? 'icon' : 'text'} triggerClassName={c ? undefined : rowClass(false)} />
      <CacheButton className={rowClass(c)} icon={<IconCache />} collapsed={c} />
      <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
        <form action={signOut} className="contents">
          <button className={rowClass(c)} title={c ? t.signOut : undefined}>
            <IconSignOut />
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
          <nav className="fixed inset-x-3 top-[72px] z-30 max-h-[calc(100dvh-84px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl md:hidden dark:border-neutral-800 dark:bg-neutral-900">
            {navItems(false)}
            <span className="my-1 block h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
            {controls(false)}
          </nav>
        </>
      )}
    </>
  )
}
