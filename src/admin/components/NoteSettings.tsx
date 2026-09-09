// Right-hand settings panel of the note editor (ADR 0044): slug, date, status, and — for a
// clip — where the passage came from and the passage itself. No taxonomy, no images: a note
// is a page of a notebook, and these three fields are what a later tier sends back to the
// source as a Webmention, so they are fields rather than lines of prose.
import type { PostStatus } from '@/types'
import { Input } from '@/admin/ui/Input'
import { DateField } from '@/admin/ui/DateField'
import { useAdminT } from './I18nProvider'
import { CHECK, NOTE_TEXT } from './kit'

export type NoteDraft = {
  title: string
  slug: string
  /** A wall clock on the site's zone, as `<input type="datetime-local">` holds it. */
  date: string
  status: PostStatus
  sourceUrl: string
  sourceTitle: string
  quote: string
  content: string
}

type Props = {
  draft: NoteDraft
  update: (partial: Partial<NoteDraft>) => void
}

export function NoteSettings({ draft, update }: Props) {
  const t = useAdminT()
  return (
    <aside className="space-y-5">
      <Input
        label={t.slug}
        value={draft.slug}
        onChange={(e) => update({ slug: e.target.value })}
        placeholder={t.slugExample}
      />

      <DateField label={t.publishDate} value={draft.date} onChange={(date) => update({ date })} />

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.status}</span>
        <div className="flex gap-4 text-sm">
          {(['draft', 'published'] as PostStatus[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="status"
                className={CHECK}
                checked={draft.status === s}
                onChange={() => update({ status: s })}
              />
              {s === 'draft' ? t.statusDraft : t.statusPublished}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Input
          label={t.noteSourceUrl}
          value={draft.sourceUrl}
          onChange={(e) => update({ sourceUrl: e.target.value })}
          placeholder="https://"
          type="url"
        />
        <Input
          label={t.noteSourceTitle}
          value={draft.sourceTitle}
          onChange={(e) => update({ sourceTitle: e.target.value })}
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.noteQuote}</span>
          <textarea
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            rows={4}
            value={draft.quote}
            onChange={(e) => update({ quote: e.target.value })}
          />
        </label>
        <p className={NOTE_TEXT}>{t.noteSourceHint}</p>
      </div>
    </aside>
  )
}
