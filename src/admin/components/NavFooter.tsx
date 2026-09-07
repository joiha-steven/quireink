// The rail's foot: one strip of icon keys, and the owner's own menu at the end of it.
//
// It was six full-width rows carrying words — Collapse sidebar, Rearrange sidebar, Light,
// Hide icons, Clear cache, Sign out — stacked under four destinations in a column where a
// full-width row with a word in it is exactly what a PLACE looks like. "Light" was the
// clearest symptom: read down the rail it is a page you can go to, and it is a theme.
//
// So the register changes with the shape. A control that fits in its own glyph becomes one,
// they sit on ONE row instead of six, and the tooltip carries the word. What is left is a
// strip that could not be mistaken for the list above it — which is the whole point, and is
// also 128px of rail given back to nothing.
//
// TWO THINGS DID NOT BECOME GLYPHS, and the reason is the same for both: they are rare and
// they are wordy. Rearranging the rail and switching its icons off are preferences somebody
// sets once and then does not think about for a month, and an unlabelled glyph for either
// would be a puzzle standing permanently on the screen. They live in the avatar's menu with
// Account and Sign out, which is where a tool's own settings are looked for.
import { useEffect, useState, type ReactNode } from 'react'
import Link from '@/admin/router'
import type { SiteLang } from '@/types'
import { ThemeToggle } from '@/admin/ui/ThemeToggle'
import { CacheButton } from './CacheButton'
import { IconCache, IconChevronLeft, IconPerson } from './navIcons'
import { SIDEBAR_ICON } from './headerActions'
import { useAdminT } from './I18nProvider'

/** Where the avatar's menu sends the owner. The Account tab, by the URL ADR 0041 kept working. */
const ACCOUNT_HREF = '/admin/settings?tab=account'

export function RailStrip({
  ids, collapsed, lang, iconsOn, avatar, onCollapse, onIcons, onArrange, signOut, close, destination,
}: {
  /** The footer zone's stored order. Ids it does not know are handed to `destination`. */
  ids: string[]
  collapsed: boolean
  lang: SiteLang
  iconsOn: boolean
  /** The owner's portrait, or '' — the glyph stands in, and the ring is drawn either way. */
  avatar: string
  onCollapse: () => void
  onIcons: () => void
  onArrange: () => void
  signOut: () => Promise<void>
  close: () => void
  destination: (id: string) => ReactNode
}) {
  const t = useAdminT()
  const key = (id: string): ReactNode => {
    switch (id) {
      case 'collapse':
        return (
          <button
            key={id}
            type="button"
            onClick={onCollapse}
            title={collapsed ? t.navExpand : t.navCollapse}
            aria-label={collapsed ? t.navExpand : t.navCollapse}
            className={SIDEBAR_ICON}
          >
            <span className={`grid place-items-center transition-transform ${collapsed ? 'rotate-180' : ''}`}>
              <IconChevronLeft />
            </span>
          </button>
        )
      case 'theme':
        // `variant='text'` with the word dropped: the text variant is the one whose menu opens
        // UPWARD and inside the rail. The icon variant's menu drops downward off a header,
        // which from the foot of a full-height column would open below the window.
        return <ThemeToggle key={id} lang={lang} variant="text" showIcon showLabel={false} triggerClassName={SIDEBAR_ICON} />
      case 'cache':
        return <CacheButton key={id} className={SIDEBAR_ICON} icon={<IconCache />} collapsed />
      // Both moved into the menu below. A stored order that still lists them draws nothing
      // here rather than drawing them twice.
      case 'icons':
      case 'signout':
        return null
      default:
        return <span key={id} className="contents">{destination(id)}</span>
    }
  }
  return (
    <div className={`flex flex-wrap items-center gap-1 ${collapsed ? 'justify-center' : ''}`}>
      {ids.map(key)}
      <div className={collapsed ? '' : 'ml-auto'}>
        <OwnerMenu
          avatar={avatar}
          iconsOn={iconsOn}
          collapsed={collapsed}
          onIcons={onIcons}
          onArrange={onArrange}
          signOut={signOut}
          close={close}
        />
      </div>
    </div>
  )
}

function OwnerMenu({ avatar, iconsOn, collapsed, onIcons, onArrange, signOut, close }: {
  avatar: string
  iconsOn: boolean
  collapsed: boolean
  onIcons: () => void
  onArrange: () => void
  signOut: () => Promise<void>
  close: () => void
}) {
  const t = useAdminT()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const item = 'flex w-full items-center px-3 py-2 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.tabAccount}
        title={t.tabAccount}
        data-nav-owner
        className={`${SIDEBAR_ICON} overflow-hidden rounded-full ring-1 ring-neutral-300 dark:ring-neutral-700`}
      >
        {avatar
          ? <img src={avatar} alt="" className="h-full w-full object-cover" />
          : <IconPerson />}
      </button>
      {open && (
        <>
          {/* A DIV, not a button. As a button it was focusable and `aria-hidden` at the
              same time: Tab landed on an invisible, unnamed control while a screen reader
              was told it did not exist, which is the shape axe calls `aria-hidden-focus`.
              Escape and picking a row both close the menu, so the scrim is for the pointer
              alone and has nothing to say to anyone else. */}
          <div className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          {/* UPWARD, and OPENING RIGHT in both rail states.
              ⚠️ It was `right-0` on the open rail, which anchors a 208px menu to the right
              edge of a button that sits at the right edge of a 208px rail — so it ran from
              x=-12 to x=196 and hung twelve pixels off the left of the WINDOW, measured. The
              rail is against the left edge of the screen; there is nothing to the left of it
              to open into. `left-0` runs the menu into the page, where there is always room,
              and the viewport cap is the belt for the phone drawer, where the strip can sit
              near the right edge instead. */}
          <div className="absolute bottom-full left-0 z-50 mb-2 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <Link href={ACCOUNT_HREF} onClick={() => { setOpen(false); close() }} className={item}>
              {t.tabAccount}
            </Link>
            {/* The same handle the in-mode control carries, so "the way IN to arrange mode"
                stays one thing a test can ask for wherever it has been moved to. */}
            <button type="button" data-nav-arrange="off" onClick={() => { setOpen(false); onArrange() }} className={item}>
              {t.navArrange}
            </button>
            {/* Never offered on the collapsed rail, where switching the glyphs off would
                leave a column of nothing at all. */}
            {!collapsed && (
              <button type="button" onClick={() => { setOpen(false); onIcons() }} className={item}>
                {iconsOn ? t.navIconsHide : t.navIconsShow}
              </button>
            )}
            <form action={signOut} className="contents">
              <button className={`${item} border-t border-neutral-100 dark:border-neutral-800`}>{t.signOut}</button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
