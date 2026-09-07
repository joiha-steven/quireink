// The rail's CONTENTS: every row it can draw, in whatever order the owner put them.
//
// Split from `AdminSidebar.tsx` when arrange mode arrived and that file passed its 400-line
// ceiling. The seam is the one the rail already had in its comments: `AdminSidebar` is the
// FRAME (the sticky column, the phone drawer, the collapse width, the media query), and this
// is what stands inside it. Only this file changes when a row is added or moved.
//
// ONE ROW, ONE DEFINITION. Every row is built by `row(id)` and drawn from there on the wide
// rail, on the collapsed rail, in the phone drawer, and — in arrange mode — inside the wrapper
// that makes it draggable. The rail defined some of its rows twice before this, and the second
// copy is how a control once ended up dressed as a destination.
//
// A HOOK, not a component, and it hands back RENDERERS rather than trees: the rail draws
// itself twice on every page (the sticky column, and the drawer that is always expanded), and
// both have to read one arrange state. As a component it would be two independent modes, and
// a row dragged in the drawer would leave the desktop rail where it was.
import Link from '@/admin/router'
import { Fragment, type ReactNode } from 'react'
import type { SiteLang, NavOrder } from '@/types'
import { useAdminT } from './I18nProvider'
import { SIDEBAR_GROUP, SIDEBAR_ICON, SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE, SIDEBAR_NAV_QUIET, SIDEBAR_UTIL } from './headerActions'
import { CacheButton } from './CacheButton'
import { ThemeToggle } from '@/admin/ui/ThemeToggle'
import {
  IconExternal, IconCache, IconSignOut, IconChevronLeft, IconGlyphs, IconMore, IconArrange,
} from './navIcons'
import { BrandMark, BrandWord } from './Wordmark'
import { primaryNav, secondaryNav, defaultNavOrder, type Destination } from './navDestinations'
import { useNavArrange, ZONES, type Zone } from './useNavArrange'
import { useNavDrag } from './useNavDrag'
import { Arrangeable, ZoneFloor, SwitchRow } from './NavArrange'
import { RailStrip } from './NavFooter'
import { SearchKey, SearchRow } from './NavSearch'
import { useToast } from '@/admin/ui/Toast'

export function useNavColumn({
  lang, signOut, aiConfigured, navOrder, avatar, icons, more, onMore, onIcons, onCollapse, close, isActive,
}: {
  lang: SiteLang
  signOut: () => Promise<void>
  aiConfigured: boolean
  /** The owner's portrait for the foot of the rail, or '' — `NavFooter` draws the fallback. */
  avatar: string
  /** What the server has stored; reconciled with the live rail inside `useNavArrange`. */
  navOrder: NavOrder
  icons: boolean
  more: boolean
  onMore: () => void
  onIcons: () => void
  onCollapse: () => void
  close: () => void
  isActive: (href: string) => boolean
}) {
  const t = useAdminT()
  const { notify } = useToast()
  const defaults = defaultNavOrder(aiConfigured)
  const arrange = useNavArrange(navOrder, defaults, (why) => notify(`${t.navArrangeFailed} (${why})`, 'error'))
  const showLogo = !arrange.isHidden('logo')
  const showSearch = !arrange.isHidden('search')

// Every part of the gesture — the slide, the probe and the window listeners — is in
  // `useNavDrag`.
  useNavDrag(arrange)

  const build = (c: boolean) => {
    // Arrange mode belongs to the OPEN rail: see the note at the top of `NavArrange.tsx`.
    const arranging = arrange.arranging && !c
    const rowClass = (active = false): string =>
      // The active row takes the QUIET base: a highlighted row has nothing to gain from a
      // hover state — you are already there — and the grey one would paint over the mark.
      //
      // `group` so the GLYPH can answer the pointer as well as the ground: 2px to the right
      // over 120ms, which is the smallest movement that reads as the row leaning towards the
      // page it opens. The row itself never moves — a label that shifts under the cursor is
      // the thing you were about to click moving away from you.
      `group ${active ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV} ${c ? 'justify-center' : 'gap-3'} ${active ? SIDEBAR_NAV_ACTIVE : ''}`
    /** The wrapper that lets a glyph lean. Never on the active row: it is already home. */
    const glyph = (node: ReactNode, active = false): ReactNode => (
      <span className={`flex shrink-0 transition-transform duration-[120ms] ${active ? '' : 'group-hover:translate-x-0.5'}`}>{node}</span>
    )
    const utilClass = `${SIDEBAR_UTIL} ${c ? 'justify-center' : 'gap-2.5'}`

    const navLink = (l: Destination): ReactNode => (
      <Link
        href={l.href}
        onClick={close}
        aria-current={isActive(l.href) ? 'page' : undefined}
        title={c ? l.label : undefined}
        className={rowClass(isActive(l.href))}
      >
        {(c || icons) && glyph(l.icon, isActive(l.href))}
        {!c && <span className="truncate">{l.label}</span>}
      </Link>
    )

    const byId = new Map<string, Destination>()
    for (const d of [...primaryNav(t, aiConfigured), ...secondaryNav(t, aiConfigured)]) byId.set(d.id, d)

    /**
     * One row, by id — the single definition every list draws from.
     *
     * Returns null for an id the rail no longer has. That cannot normally happen (the order is
     * reconciled against the live rail before anything is drawn), but it is exactly what a
     * hand-edited settings payload would carry, and a rail that throws is a rail nobody can
     * sign out of.
     */
    const row = (id: string): ReactNode => {
      const dest = byId.get(id)
      if (dest) return navLink(dest)
      switch (id) {
        case 'more':
          // The one row in this column that names no destination, so it is a button rather
          // than a Link, and the chevron says which way it will move.
          return (
            <button
              type="button"
              onClick={onMore}
              aria-expanded={more}
              title={c ? t.navMore : undefined}
              // AN EYEBROW, not a fifth destination. It names no page — it folds the rest of
              // the rail out — and at the destinations' 15px/500 it read as one more place to
              // go, which is what put a chevron and a glyph on a row that had to compete with
              // them for width. 12px uppercase settles both: it is visibly a heading, and the
              // label has room again in all eleven languages.
              className={`group ${c ? `${rowClass()} justify-center` : `${SIDEBAR_GROUP} justify-between gap-2`}`}
            >
              <span className={`flex min-w-0 items-center ${c ? '' : 'gap-2.5'}`}>
                {(c || icons) && glyph(<IconMore />)}
                {!c && <span className="truncate">{t.navMore}</span>}
              </span>
              {!c && (
                // The one row carrying TWO glyphs, so it is the one row that runs out of
                // width: with the rail's icons on (2026-09-07) its 184px of content holds a
                // 20px glyph, a 12px gap, the label, another 12px gap and a 20px chevron,
                // which left the English "Everything else" 96px for the 100px it needs.
                // The label is "Manage" now — three words was never a NAME, it was a
                // description of what was left over, and at 15px it clipped again.
                // The four pixels come back from the CHEVRON rather than from the label,
                // and that is the right place for them: a destination's glyph says WHAT the
                // row is and a state chevron says which way it will move, so they are not
                // peers and need not be drawn at one size. 16px in a 16px box, on an 8px gap.
                <span className={`grid h-4 w-4 shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4 transition-transform ${more ? 'rotate-90' : '-rotate-90'}`}>
                  <IconChevronLeft />
                </span>
              )}
            </button>
          )
        case 'viewBlog':
          return (
            <a href="/" target="_blank" rel="noopener" onClick={close} title={c ? t.navViewBlog : undefined} className={rowClass()}>
              {(c || icons) && glyph(<IconExternal />)}
              {!c && <span className="truncate">{t.navViewBlog}</span>}
            </a>
          )
        case 'collapse':
          return (
            <button type="button" onClick={onCollapse} title={c ? t.navExpand : t.navCollapse} aria-label={c ? t.navExpand : t.navCollapse} className={utilClass}>
              {(c || icons) && (
                <span className={`grid place-items-center transition-transform ${c ? 'rotate-180' : ''}`}>
                  <IconChevronLeft />
                </span>
              )}
              {!c && <span className="truncate">{t.navCollapse}</span>}
            </button>
          )
        case 'theme':
          // `variant='text'` in BOTH states, with the word dropped when collapsed. The rail
          // needs one row object, and `variant='icon'` is the public header's — it ignores the
          // row class and drew this line 4px left of the two under it.
          return <ThemeToggle lang={lang} variant="text" showIcon={c || icons} showLabel={!c} triggerClassName={utilClass} />
        case 'icons':
          // Never on the collapsed rail, where it would be an unlabelled glyph offering to
          // remove the glyphs.
          return c ? null : (
            <button type="button" onClick={onIcons} className={utilClass}>
              {icons && <IconGlyphs />}
              <span className="truncate">{icons ? t.navIconsHide : t.navIconsShow}</span>
            </button>
          )
        case 'cache':
          return <CacheButton className={utilClass} icon={c || icons ? <IconCache /> : null} collapsed={c} />
        case 'signout':
          return (
            <form action={signOut} className="contents">
              <button className={utilClass} title={c ? t.signOut : undefined}>
                {(c || icons) && <IconSignOut />}
                {!c && <span className="truncate">{t.signOut}</span>}
              </button>
            </form>
          )
        default:
          return null
      }
    }

    /** Every row in the column, top to bottom — what the steppers walk, and what an end means. */
    const walk = ZONES.flatMap((zone) => arrange.order[zone].map((id) => ({ id, zone })))

    /**
     * The switch into arrange mode — and, while it is on, the way back out and the way back
     * to the shipped order.
     *
     * Reset gets its OWN class rather than `SIDEBAR_UTIL`, which is `w-full`: beside a
     * flexed Done it kept asking for the whole width and its hover state hung over the edge
     * of the rail.
     */
    const arrangeControl = c ? null : (
      <div className="flex items-center gap-1">
        <button type="button" data-nav-arrange={arranging ? 'on' : 'off'} onClick={arrange.toggleArranging} className={`${utilClass} min-w-0 flex-1`}>
          {(c || icons || arranging) && <IconArrange />}
          <span className="truncate">{arranging ? t.navArrangeDone : t.navArrange}</span>
        </button>
        {arranging && (
          <button
            type="button"
            data-nav-reset
            onClick={arrange.reset}
            className="h-8 shrink-0 rounded-md px-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            {t.navArrangeReset}
          </button>
        )}
      </div>
    )

    const list = (zone: Zone): ReactNode => (
      <>
        {arrange.order[zone].map((id) => {
          const drawn = row(id)
          if (!drawn) return null
          // The mode switch rides UNDER THE COLLAPSE ROW, wherever the collapse row has been
          // put: the two are siblings — both are about this rail rather than about the blog —
          // and it is the row the hand already goes to when it wants the rail to look
          // different. It is not itself arrangeable: a control that can be dragged out of
          // reach while it is the thing doing the dragging is a door that closes behind you.
          const after = id === 'collapse' ? arrangeControl : null
          // A FRAGMENT, not a wrapper. `display:contents` looks like no element at all and is
          // not: it is still a node, so `aside nav > a` — which is how the rail's own guards
          // tell a primary destination from one inside the group — stopped matching anything
          // the moment rows were wrapped. Outside arrange mode the DOM is exactly what it was.
          if (!arranging) return <Fragment key={id}>{drawn}{after}</Fragment>
          const at = walk.findIndex((w) => w.id === id)
          return (
            <Arrangeable
              key={id}
              id={id}
              held={arrange.dragging === id}
              onGrab={arrange.setDragging}
              onNudge={arrange.nudge}
              first={at === 0}
              last={at === walk.length - 1}
            >
              {drawn}
            </Arrangeable>
          )
        }).flatMap((el, i) => (arranging && arrange.order[zone][i] === 'collapse' ? [el, <Fragment key="arrange-control">{arrangeControl}</Fragment>] : [el]))}
        {arranging && <ZoneFloor zone={zone} empty={arrange.order[zone].length === 0} />}
      </>
    )

    const wordmark: ReactNode = (
      // LEFT padding only, and only when the rail is open: every label in this rail starts 24px
      // from its edge, while the mark sat at 12px and alone hung off the left. Collapsed the
      // mark is centred in a 72px rail, where a one-sided pad would push it off centre.
      <Link href="/admin" onClick={close} className={`flex h-10 items-center leading-none ${c ? '' : 'pl-3'}`}>
        {c ? <BrandMark /> : <BrandWord />}
      </Link>
    )

    return {
      /**
       * The top row: the wordmark, and the search button beside it.
       *
       * Empty — and drawn by nobody — when the wordmark is off: search then rides in the
       * column as a row, and a top row holding one small button over an empty half is worse
       * than no top row at all.
       */
      top: !showLogo ? null : (
        // `data-nav-top` is the row's NAME, and it is here so a test can ask whether the row
        // exists rather than inferring it from what is inside it. The rearrange flow used to
        // read the wordmark's absence off `aside a[href="/admin"] svg` having no matches —
        // true only while the rail drew no icons, because the Home destination is a link to
        // the same href, and it started matching the moment icons came on by default
        // (2026-09-07). A structural fact deserves a structural handle.
        <div data-nav-top className={c ? 'flex flex-col items-center gap-2' : 'flex min-w-0 items-center justify-between gap-1'}>
          <span className="min-w-0 truncate">{wordmark}</span>
          {showSearch && <SearchKey collapsed={c} close={close} />}
        </div>
      ),
      /**
       * The destinations. In arrange mode the "Everything else" group is FORCED OPEN: its rows
       * are half of what is being arranged, and a folded group would hide them behind a toggle
       * whose own row is being dragged at the time.
       */
      nav: (
        <>
          {!showLogo && showSearch && <SearchRow collapsed={c} close={close} rowClass={rowClass()} />}
          {list('primary')}
          {(more || arranging) && (
            // Indented by a rule rather than by padding: `SIDEBAR_NAV` is the one row string
            // every item in this column shares (`headerActions.ts`), and a per-item `pl-6` here
            // is how that rule stops being true. Collapsed, there is nothing to indent.
            <div className={c ? 'contents' : 'ml-3 flex flex-col gap-1 border-l border-neutral-200 pl-1 dark:border-neutral-800'}>
              {list('more')}
            </div>
          )}
        </>
      ),
      /**
       * The foot. TWO SHAPES, and the split is the point of `NavFooter`.
       *
       * Reading, it is one strip of icon keys with tooltips: a control that fits in its own
       * glyph should be one, and six full-width labelled rows under four destinations put
       * "Light" in the column as though it were a page. Arranging, it is back to labelled
       * rows — a 32px glyph is not something a hand can pick up and place, and the whole
       * mode is about picking rows up.
       */
      controls: (
        <>
          {arranging ? list('footer') : (
            <RailStrip
              ids={arrange.order.footer}
              collapsed={c}
              lang={lang}
              iconsOn={icons}
              avatar={avatar}
              onCollapse={onCollapse}
              onIcons={onIcons}
              onArrange={arrange.toggleArranging}
              signOut={signOut}
              close={close}
              // A DESTINATION dragged down here becomes a key like the rest of the strip.
              // It keeps its glyph and its tooltip; what it loses is the label, which is the
              // trade the whole strip makes.
              destination={(id) => {
                const d = byId.get(id)
                return d ? (
                  <Link href={d.href} onClick={close} title={d.label} aria-label={d.label} className={SIDEBAR_ICON}>
                    {d.icon}
                  </Link>
                ) : null
              }}
            />
          )}
          {/* The two things on the top row cannot be dragged — a wordmark dropped into a
              column of destinations becomes one — so they are switches, and they appear only
              while arranging, next to everything else about how the rail is laid out. */}
          {arranging && (
            <div className="mt-1 flex flex-col gap-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
              <SwitchRow id="logo" label={t.navShowLogo} on={showLogo} onToggle={() => arrange.toggleHidden('logo')} />
              <SwitchRow id="search" label={t.navShowSearch} on={showSearch} onToggle={() => arrange.toggleHidden('search')} />
            </div>
          )}
        </>
      ),
    }
  }

  return {
    /** The frame needs this too: a rail being arranged is wider than one being read. */
    arranging: arrange.arranging,
    top: (c: boolean) => build(c).top,
    nav: (c: boolean) => build(c).nav,
    controls: (c: boolean) => build(c).controls,
  }
}
