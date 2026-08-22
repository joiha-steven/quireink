// A tiny limited-markdown editor for the site footer: bold / italic / underline /
// link only (mirrors lib/inline-md). A textarea + a toolbar that wraps the current
// selection, plus a live preview rendered with the SAME function the site uses.
import { useRef } from 'react'
import { renderInlineMarkdown } from '@/render/inline-md'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const TB_BTN =
  'flex h-8 min-w-8 items-center justify-center rounded-lg border border-neutral-300 px-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'

export function FooterField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useAdminT()
  const ref = useRef<HTMLTextAreaElement>(null)

  // Wrap the current selection in `before`/`after`, keeping the inner text selected.
  function wrap(before: string, after: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value: v } = el
    onChange(v.slice(0, a) + before + v.slice(a, b) + after + v.slice(b))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, b + before.length)
    })
  }

  function link() {
    const url = window.prompt(t.promptLink)
    if (url === null) return
    wrap('[', `](${url || 'https://'})`)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => wrap('**', '**')} aria-label={t.tbBold} className={`${TB_BTN} font-bold`}>B</button>
        <button type="button" onClick={() => wrap('*', '*')} aria-label={t.tbItalic} className={`${TB_BTN} italic`}>I</button>
        <button type="button" onClick={() => wrap('++', '++')} aria-label={t.tbUnderline} className={`${TB_BTN} underline`}>U</button>
        <button type="button" onClick={link} aria-label={t.tbLink} className={TB_BTN}>{t.tbLink}</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        spellCheck={false}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
      />
      <p className={NOTE_TEXT}>{t.footerHint}</p>
      <div className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 dark:border-neutral-700">
        <p className={`${NOTE_TEXT} mb-1`}>{t.tbReview}</p>
        <div
          className="text-sm text-neutral-600 dark:text-neutral-300 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(value, { newTab: true }) }}
        />
      </div>
    </div>
  )
}
