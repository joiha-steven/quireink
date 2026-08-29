// Controlled layout + menu + sidebar fields. Parent owns state + save.
import type { SiteSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { FeaturedField } from './FeaturedField'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, SEGMENT_TRACK, tabItemClass } from './kit'

const MENU_FIELD =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400'

type Props = {
  s: SiteSettings
  update: (p: Partial<SiteSettings>) => void
  posts: { slug: string; title: string }[]
  pages: { slug: string; title: string }[]
}

export function LayoutMenuFields({ s, update, posts, pages }: Props) {
  const t = useAdminT()
  const home = s.home

  return (
    <div className="space-y-5">
      {/* What `/` serves, and where the post list goes when it is no longer there. ADR 0014. */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.homeModeLabel}</span>
        <div className={SEGMENT_TRACK}>
          {(['list', 'page', 'front'] as const).map((v) => {
            const active = home.mode === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => update({ home: { ...home, mode: v } })}
                aria-pressed={active}
                className={tabItemClass(active, 'sm')}
              >
                {v === 'list' ? t.homeModeList : v === 'page' ? t.homeModePage : t.homeModeFront}
              </button>
            )
          })}
        </div>
        <p className={NOTE_TEXT}>{t.homeModeHint}</p>
      </div>

      {/* Both of the other modes move the post list, so both need somewhere to move it to.
          Only one of them needs a page. Asking either question while the homepage is still
          the list would be asking about nothing. */}
      {home.mode !== 'list' && (
        <div className="space-y-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
          {home.mode === 'page' && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.homePageLabel}</span>
              <select
                value={home.page}
                onChange={(e) => update({ home: { ...home, page: e.target.value } })}
                className={MENU_FIELD}
              >
                <option value="">{t.homePageNone}</option>
                {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
              <p className={NOTE_TEXT}>{t.homePageHint}</p>
            </div>
          )}
          <Input
            label={t.listPathLabel}
            note={t.listPathHint}
            value={home.listPath}
            onChange={(e) => update({ home: { ...home, listPath: e.target.value } })}
          />
        </div>
      )}

      {/* `note=`, not a `<p>` after the field. Both of these hand-placed their hint BELOW the
          control, which is the drift `ui/Input` grew a `note` slot to stop — the order is
          label, note, control — and it also left the sentence outside the inline row, so it
          ran the full width of the card under a 112px number box. */}
      <Input
        label={t.siteWidth}
        note={t.siteWidthHint}
        type="number"
        min={360}
        max={1600}
        value={s.contentWidth}
        onChange={(e) => update({ contentWidth: Number(e.target.value) })}
      />

      <Input
        label={t.postsPerPage}
        note={t.postsPerPageHint}
        type="number"
        min={1}
        max={100}
        value={s.postsPerPage}
        onChange={(e) => update({ postsPerPage: Number(e.target.value) })}
      />

      <div className="space-y-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.menuTitle}</span>
        {s.menu.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item.label}
              onChange={(e) => update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, label: e.target.value } : m)) })}
              placeholder={t.menuLabelField}
              className={MENU_FIELD}
            />
            <input
              value={item.href}
              onChange={(e) => update({ menu: s.menu.map((m, idx) => (idx === i ? { ...m, href: e.target.value } : m)) })}
              placeholder={t.menuHrefField}
              className={MENU_FIELD}
            />
            <button
              type="button"
              onClick={() => update({ menu: s.menu.filter((_, idx) => idx !== i) })}
              aria-label={t.delete}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              ×
            </button>
          </div>
        ))}
        <Button variant="secondary" type="button" onClick={() => update({ menu: [...s.menu, { label: '', href: '' }] })}>
          {t.menuAdd}
        </Button>
        <p className={NOTE_TEXT}>{t.menuHint}</p>
      </div>

      {/* Sidebar layout: one stacked rail (classic) vs two rails + a narrower column. */}
      <div className="space-y-2 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.sidebarLayoutLabel}</span>
        <div className={SEGMENT_TRACK}>
          {(['single', 'two'] as const).map((v) => {
            const active = s.sidebarLayout === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => update({ sidebarLayout: v })}
                aria-pressed={active}
                className={tabItemClass(active, 'sm')}
              >
                {v === 'single' ? t.sidebarLayoutSingle : t.sidebarLayoutTwo}
              </button>
            )
          })}
        </div>
        <p className={NOTE_TEXT}>{t.sidebarLayoutHint}</p>
      </div>

      {/* Sidebar blocks: featured picker + how many "most viewed" to show. */}
      <div className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.cardFeatured}</span>
        <FeaturedField posts={posts} value={s.featured} onChange={(featured) => update({ featured })} />
      </div>

      <div className="space-y-1.5">
        <Input
          label={t.mostViewedCount}
          note={t.mostViewedCountHint}
          type="number"
          min={0}
          max={10}
          value={s.mostViewedCount}
          onChange={(e) => update({ mostViewedCount: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
