// The composed front page's options. ADR 0014, part 2. Parent owns state + save.
//
// The ROW ORDER is not here, and that is the point: it is fixed in the renderer. This is a
// prepared layout with options, not a block composer, so every control below chooses whether
// a row appears, how big it is, or where its posts come from — never where it sits.
//
// Only rendered when the homepage mode is `front`. Asking twenty questions about a front
// page a site is not serving is how a settings screen becomes something people scroll past.

import type { FrontSettings, FrontStrip } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { CONTROL, NOTE_TEXT, SEGMENT_TRACK, tabItemClass } from './kit'

const FIELD = `${CONTROL} w-full`
const LABEL = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300'
const GROUP = 'space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800'

type Props = {
  front: FrontSettings
  onChange: (f: FrontSettings) => void
  posts: { slug: string; title: string }[]
  categories: string[]
}

/** A count and a column choice: the two numbers almost every row has. */
function RowSize({ count, columns, onCount, onColumns, max, t }: {
  count: number
  columns?: number
  onCount: (n: number) => void
  onColumns?: (n: number) => void
  max: number
  t: ReturnType<typeof useAdminT>
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        label={t.frontCount}
        type="number"
        min={1}
        max={max}
        value={count}
        onChange={(e) => onCount(Number(e.target.value))}
      />
      {onColumns && (
        <label className="space-y-1.5">
          <span className={LABEL}>{t.frontColumns}</span>
          <select value={columns} onChange={(e) => onColumns(Number(e.target.value))} className={FIELD}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

export function FrontFields({ front, onChange, posts, categories }: Props) {
  const t = useAdminT()
  const set = (patch: Partial<FrontSettings>) => onChange({ ...front, ...patch })

  // A category can hold at most one row. Offering the same one twice would produce a second
  // strip that is empty, because the first row has already used those posts.
  const taken = new Set(front.strips.map((s) => s.category))
  const free = categories.filter((c) => !taken.has(c))
  const editStrip = (i: number, patch: Partial<FrontStrip>) =>
    set({ strips: front.strips.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  return (
    <div className="space-y-5">
      {/* The one dial that moves the whole page. */}
      <div className="space-y-2">
        <span className={LABEL}>{t.frontKindLabel}</span>
        <div className={SEGMENT_TRACK}>
          {(['image', 'text'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ kind: v })}
              aria-pressed={front.kind === v}
              className={tabItemClass(front.kind === v, 'sm')}
            >
              {v === 'image' ? t.frontKindImage : t.frontKindText}
            </button>
          ))}
        </div>
        <p className={NOTE_TEXT}>{t.frontKindHint}</p>
      </div>

      {/* ----- the lead ----- */}
      <div className={GROUP}>
        <ToggleRow
          label={t.frontLead}
          desc={t.frontLeadHint}
          checked={front.lead.on}
          onChange={(on) => set({ lead: { ...front.lead, on } })}
        />
        {front.lead.on && (
          <div className="space-y-3 pl-1">
            <label className="space-y-1.5 block">
              <span className={LABEL}>{t.frontLeadSource}</span>
              <select
                value={front.lead.source}
                onChange={(e) => set({ lead: { ...front.lead, source: e.target.value as 'latest' | 'pinned' } })}
                className={FIELD}
              >
                <option value="latest">{t.frontLeadLatest}</option>
                <option value="pinned">{t.frontLeadPinned}</option>
              </select>
            </label>
            {front.lead.source === 'pinned' && (
              <select
                value={front.lead.slug}
                onChange={(e) => set({ lead: { ...front.lead, slug: e.target.value } })}
                className={FIELD}
              >
                <option value="">{t.frontLeadPickPost}</option>
                {posts.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
            )}
            <Input
              label={t.frontSecondary}
              type="number"
              min={0}
              max={3}
              value={front.lead.secondary}
              onChange={(e) => set({ lead: { ...front.lead, secondary: Number(e.target.value) } })}
            />
          </div>
        )}
      </div>

      {/* ----- the owner's own list ----- */}
      <div className={GROUP}>
        <ToggleRow
          label={t.frontFeaturedRow}
          desc={t.frontFeaturedHint}
          checked={front.featured.on}
          onChange={(on) => set({ featured: { ...front.featured, on } })}
        />
        {front.featured.on && (
          <RowSize
            t={t}
            max={12}
            count={front.featured.count}
            columns={front.featured.columns}
            onCount={(count) => set({ featured: { ...front.featured, count } })}
            onColumns={(columns) => set({ featured: { ...front.featured, columns } })}
          />
        )}
      </div>

      {/* ----- one row per category ----- */}
      <div className={GROUP}>
        <span className={LABEL}>{t.frontStrips}</span>
        <p className={NOTE_TEXT}>{t.frontStripsHint}</p>
        {front.strips.map((strip, i) => (
          <div key={strip.category} className="space-y-2 border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{strip.category}</span>
              <div className="flex gap-1">
                {/* Order is the owner's, so it is moved rather than dragged: two buttons are
                    the whole interaction and they work on a phone and with a keyboard. */}
                <Button
                  variant="ghost"
                  type="button"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...front.strips]
                    const prev = next[i - 1]!
                    next[i - 1] = next[i]!
                    next[i] = prev
                    set({ strips: next })
                  }}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => set({ strips: front.strips.filter((_, j) => j !== i) })}
                >
                  {t.removeSelection}
                </Button>
              </div>
            </div>
            <RowSize
              t={t}
              max={12}
              count={strip.count}
              columns={strip.columns}
              onCount={(count) => editStrip(i, { count })}
              onColumns={(columns) => editStrip(i, { columns })}
            />
          </div>
        ))}
        {front.strips.length < 8 && free.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value
              && set({ strips: [...front.strips, { category: e.target.value, count: 3, columns: 3 }] })}
            className={FIELD}
          >
            <option value="">{t.frontStripAdd}</option>
            {free.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* ----- what people are actually reading ----- */}
      <div className={GROUP}>
        <ToggleRow
          label={t.frontPopularRow}
          desc={t.frontPopularHint}
          checked={front.popular.on}
          onChange={(on) => set({ popular: { ...front.popular, on } })}
        />
        {front.popular.on && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t.frontCount}
              type="number"
              min={1}
              max={12}
              value={front.popular.count}
              onChange={(e) => set({ popular: { ...front.popular, count: Number(e.target.value) } })}
            />
            <label className="space-y-1.5">
              <span className={LABEL}>{t.frontWindow}</span>
              <select
                value={front.popular.days}
                onChange={(e) => set({ popular: { ...front.popular, days: Number(e.target.value) } })}
                className={FIELD}
              >
                <option value={7}>{t.frontWindow7}</option>
                <option value={30}>{t.frontWindow30}</option>
                <option value={0}>{t.frontWindowAll}</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* ----- and everything else ----- */}
      <div className={GROUP}>
        <ToggleRow
          label={t.frontLatestRow}
          desc={t.frontLatestHint}
          checked={front.latest.on}
          onChange={(on) => set({ latest: { ...front.latest, on } })}
        />
        {front.latest.on && (
          <RowSize
            t={t}
            max={24}
            count={front.latest.count}
            columns={front.latest.columns}
            onCount={(count) => set({ latest: { ...front.latest, count } })}
            onColumns={(columns) => set({ latest: { ...front.latest, columns } })}
          />
        )}
      </div>

      {/* ----- what each item says ----- */}
      <div className={GROUP}>
        <ToggleRow label={t.frontShowDate} desc="" checked={front.showDate}
          onChange={(showDate) => set({ showDate })} />
        <ToggleRow label={t.frontShowReading} desc="" checked={front.showReadingTime}
          onChange={(showReadingTime) => set({ showReadingTime })} />
        <ToggleRow label={t.frontTagLinks} desc={t.frontTagLinksHint} checked={front.tagLinks}
          onChange={(tagLinks) => set({ tagLinks })} />
      </div>
    </div>
  )
}
