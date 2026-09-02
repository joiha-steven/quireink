// The box where somebody else's service gets to run on this site.
//
// Quire Ink makes exactly zero third-party requests, and that is a promise about what the
// SOFTWARE does — not a rule imposed on the person whose site it is. Umami, Plausible,
// Cloudflare's beacon, a sign-in button: every one of them is handed to you as a snippet,
// and until now there was nowhere to put it. `customCss` cannot be the place, by
// construction — it strips `</style` precisely so a stylesheet can never become a script.
//
// Built on the same three ideas as `CssEditor`, for the same reasons, because this box is
// used the same way and by the same person:
//
//   1. IT SAYS WHERE IT LANDS. A snippet is written for one end of the document or the
//      other, and pasting the wrong one into the wrong end is the most common way it does
//      nothing. The label is the destination, not a generic "custom code".
//   2. IT SAYS WHAT IS WRONG. An unclosed `<script>` is this field's unclosed brace, and
//      it is worse: the browser swallows the rest of the page into the script and the site
//      goes blank, with nothing anywhere saying why.
//   3. IT SAYS WHAT IT COSTS. This text ships inside every public page, on every request.
//
// Not sanitised, and the note in the box says so. A field whose whole purpose is to carry
// a script cannot strip script tags; what it can do is be honest that it runs.
import { useMemo, useRef } from 'react'
import { useAdminT } from './I18nProvider'

/**
 * Elements that swallow the document when left unclosed.
 *
 * Only these two matter. An unclosed `<div>` is untidy and the parser recovers; an unclosed
 * `<script>` or `<style>` turns everything after it into script or stylesheet text, which is
 * why they are the pair worth counting. Self-closing and attribute noise are ignored on
 * purpose: this is a "did you forget the closing tag" check, not an HTML parser.
 */
const SWALLOWERS = ['script', 'style'] as const

/** How many of each swallowing element are left open. Negative = a stray closing tag. */
export function unclosed(html: string): { tag: string; depth: number } | null {
  for (const tag of SWALLOWERS) {
    const open = html.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'))?.length ?? 0
    const close = html.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0
    if (open !== close) return { tag, depth: open - close }
  }
  return null
}

const bytes = (s: string): number => new TextEncoder().encode(s).length

export function SnippetEditor({
  value,
  onChange,
  label,
  note,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  /** Where this snippet lands, in the owner's language. It IS the field's name. */
  label: string
  note: string
  placeholder: string
  className?: string
}) {
  const t = useAdminT()
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => value.split('\n').length, [value])
  const problem = useMemo(() => unclosed(value), [value])
  const size = useMemo(() => bytes(value), [value])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Tab indents, the same as the CSS box: leaving the field is right for a form control
    // and wrong for a code field, where Tab is the key you press most.
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const el = area.current
      if (!el) return
      const from = el.selectionStart
      const to = el.selectionEnd
      onChange(`${value.slice(0, from)}  ${value.slice(to)}`)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(from + 2, from + 2)
      })
    }
  }

  // EMPTY SAYS NOTHING. Both boxes ship empty on every install, and a count is a fact about
  // something that is there: "1 lines · 0 bytes" printed under an untouched field is a
  // measurement of nothing, twice, on a screen the owner meets before they have typed
  // anything. The note beside it already says what the field is for.
  // BYTES, and no line count. The CSS box counts lines because a stylesheet is written in
  // them; a tracking snippet is one line by construction, so the count would read "1 lines"
  // under almost every field this box will ever hold. Bytes is the number with a
  // consequence: this text ships inside every public page, on every request.
  const status = value === ''
    ? ''
    : problem === null
      ? `${size.toLocaleString()} ${t.cssBytes}`
      : problem.depth > 0
        ? `${t.snippetUnclosed} <${problem.tag}>`
        : `${t.snippetStray} </${problem.tag}>`

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</p>
      <div className="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-neutral-400 dark:border-neutral-700">
        {/* Scrolls with the text rather than being painted into it, so a wrapped line keeps
            ONE number — which is what a line number means. */}
        <div
          ref={gutter}
          aria-hidden
          className="max-h-64 shrink-0 select-none overflow-hidden border-r border-neutral-200 bg-neutral-50 px-2 py-2 text-right font-mono text-xs leading-5 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
        >
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea
          ref={area}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop }}
          rows={6}
          spellCheck={false}
          data-snippet-editor
          aria-label={label}
          placeholder={placeholder}
          className="max-h-64 min-h-28 w-full resize-y bg-white px-3 py-2 font-mono text-xs leading-5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {status && (
          <span
            data-snippet-status
            className={`text-xs tabular-nums ${problem ? 'text-[var(--pen-edge)]' : 'text-neutral-500 dark:text-neutral-400'}`}
          >
            {status}
          </span>
        )}
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{note}</span>
      </div>
    </div>
  )
}
