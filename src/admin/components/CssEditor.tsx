// The box where this product stops having answers and hands you the pen.
//
// It was an eight-row `<textarea>`. That is fine for a two-line tweak and wrong for what
// this box actually IS here: Quire Ink ships no themes, so when the 155 settings run out,
// your own CSS is the whole of the remaining answer. A plain textarea makes that answer feel
// like a fallback. It is not a fallback; it is the door.
//
// Three things it now does, and each is here for a reason rather than for polish:
//
//   1. THE CONTRACT IS IN THE BOX. The variables and class names the software promises not
//      to rename (`content/appearance-contract.ts`) are listed beside the editor, one line
//      of explanation each, and clicking one writes it at the cursor. That list used to
//      exist only in `docs/appearance.md` on GitHub — which means the person most likely to
//      need it, sitting in the settings screen, was the person furthest from it.
//   2. IT SAYS WHAT IS WRONG. An unclosed brace is the single most common way a stylesheet
//      does nothing at all, and the old box gave no sign: you saved, the page did not
//      change, and nothing anywhere said why.
//   3. IT SAYS WHAT IT COSTS. This text ships inside every public page, on every request.
//      A number is the honest way to say that, and this product already puts a byte count
//      in front of the owner everywhere else it matters.
//
// No dependency and no syntax highlighting. A highlight overlay behind a textarea has to
// keep two layers in identical wrap for every font, zoom and word — and when it drifts it
// drifts by a character, which looks like a bug in the editor rather than in the overlay.
// Line numbers, a working Tab, and honest feedback are worth more here than colour.
import { useMemo, useRef, useState } from 'react'
import { PROMISED_SELECTORS, PROMISED_VARS } from '@/content/appearance-contract'
import { useAdminT } from './I18nProvider'

/** Unbalanced braces, ignoring anything inside a comment or a string. */
export function braceBalance(css: string): number {
  let depth = 0
  let i = 0
  while (i < css.length) {
    const c = css[i]!
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      i += 1
      while (i < css.length && css[i] !== c) i += css[i] === '\\' ? 2 : 1
      i += 1
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') depth -= 1
    // A stray `}` is already broken; report it as one problem rather than letting the
    // count go negative and cancel out against a later missing one.
    if (depth < 0) return -1
    i += 1
  }
  return depth
}

const bytes = (s: string): number => new TextEncoder().encode(s).length

export function CssEditor({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const t = useAdminT()
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const [showRef, setShowRef] = useState(false)

  const lines = useMemo(() => value.split('\n').length, [value])
  const depth = useMemo(() => braceBalance(value), [value])
  const size = useMemo(() => bytes(value), [value])

  /** Write text where the cursor is, and leave the cursor after it. */
  const insert = (text: string): void => {
    const el = area.current
    if (!el) return
    const from = el.selectionStart
    const to = el.selectionEnd
    onChange(value.slice(0, from) + text + value.slice(to))
    // After React has written the new value back in, or the caret lands in the old string.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(from + text.length, from + text.length)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Tab indents. Leaving the field on Tab is right for a form control and wrong for a
    // code field, where it is the key you press most.
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      insert('  ')
    }
  }

  const problem = depth !== 0
  const status = depth === 0
    ? `${lines} ${t.cssLines} · ${size.toLocaleString()} ${t.cssBytes}`
    : depth < 0 ? t.cssStrayBrace : `${t.cssUnclosed} ${depth}`

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-neutral-400 dark:border-neutral-700">
        {/* The gutter scrolls with the text rather than being painted into it, so a wrapped
            line keeps ONE number — which is what a line number means. */}
        <div
          ref={gutter}
          aria-hidden
          className="max-h-80 shrink-0 select-none overflow-hidden border-r border-neutral-200 bg-neutral-50 px-2 py-2 text-right font-mono text-xs leading-5 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
        >
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea
          ref={area}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop }}
          rows={10}
          spellCheck={false}
          data-css-editor
          placeholder={':root { --c-accent: #b4472a }\n\n.prose h2 { letter-spacing: -0.01em }'}
          className="max-h-80 min-h-40 w-full resize-y bg-white px-3 py-2 font-mono text-xs leading-5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          data-css-status
          className={`text-xs tabular-nums ${problem ? 'text-[var(--pen-edge)]' : 'text-neutral-500 dark:text-neutral-400'}`}
        >
          {status}
        </span>
        <button
          type="button"
          onClick={() => setShowRef((v) => !v)}
          data-css-reference
          aria-expanded={showRef}
          className="ml-auto text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
        >
          {showRef ? t.cssHideNames : t.cssShowNames}
        </button>
      </div>

      {showRef && (
        // The promise, where the person who needs it is standing. Every name here is one
        // `check:contract` proves still exists; nothing is offered that could quietly stop
        // being true.
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.cssNamesNote}</p>
          {PROMISED_VARS.map((group) => (
            <div key={group.group}>
              <h4 className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {group.group}
              </h4>
              <div className="flex flex-wrap gap-1">
                {group.vars.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insert(v.name)}
                    title={v.note}
                    className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[0.6875rem] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <h4 className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {t.cssStructure}
            </h4>
            <div className="flex flex-wrap gap-1">
              {PROMISED_SELECTORS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => insert(s.name)}
                  title={s.note}
                  className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[0.6875rem] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
