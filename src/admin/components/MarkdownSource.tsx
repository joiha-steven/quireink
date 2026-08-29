// The markdown source view: a textarea you type in, over a mirror that dims the syntax.
//
// WHY A MIRROR. A `<textarea>` renders one uniform run of text and nothing can style a part
// of it — there is no way to reach `##` or `---` from CSS. So the text is drawn twice: a
// `<pre>` underneath holding the same characters with the markers wrapped, and the textarea
// on top with its own text made transparent. The reader sees the mirror; the caret,
// selection, undo, spellcheck and every keystroke belong to the textarea, which stays the
// only source of truth. If `mark()` below ever threw, the words would still be there — the
// mirror is decorative and `aria-hidden`.
//
// THE TWO BOXES MUST MEASURE IDENTICALLY or the caret drifts from the glyph it is sitting
// after. That is why neither element carries its own metrics here: `.md-box` in `admin.css`
// sets the font, size, leading, padding, wrapping and tab size for both, and there is no
// second place to change one of them in.
//
// NO SCROLL SYNC, and that is not an oversight. `Editor.tsx` grows the textarea to its own
// `scrollHeight` on every change, so the box never scrolls internally — the page does. A
// mirror pinned to the same box therefore cannot drift. If that autogrow is ever removed,
// this needs an `onScroll` that copies `scrollTop`/`scrollLeft`, and the caret will visibly
// separate from the text until it does.
import { useMemo, type RefObject } from 'react'

/**
 * `&`, `<`, `>` and nothing else.
 *
 * Quotes are left alone deliberately: this text lands in a text node, never in an attribute,
 * and every entity this produces (`&amp;` `&lt;` `&gt;`) is free of the punctuation the
 * marker rules below match on. Escaping quotes as `&#39;` would put a `#` into the string
 * and the heading rule would dim it.
 */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The dim wrapper. `<i>` for one reason: it is the shortest tag, and this runs per keystroke. */
const dim = (s: string | undefined): string => (s ? `<i>${s}</i>` : '')

/**
 * The INLINE markers, in one pass.
 *
 * One combined expression rather than a chain of `.replace()` calls, because a chain runs the
 * second pattern over HTML the first produced — and `<i>` contains no marker characters only by
 * luck. `String.replace` scans the ORIGINAL string, so a single alternation cannot re-enter its
 * own output. It also settles precedence for free: a code span is listed first, so the asterisks
 * inside `` `a * b` `` are never reached by the emphasis rule. Applied to already-escaped text,
 * which is safe because every character these rules match is ASCII punctuation.
 *
 * ⚠️ NO BACKREFERENCES, and the first draft is why. Written as `(\*\*|__)(...)\1`, the `\1`
 * looks local and is not: inside a combined alternation the number is ABSOLUTE, so it pointed at
 * the code span's backticks eleven groups earlier. In this branch that group never participates,
 * an unmatched backreference matches the empty string, and the pattern quietly became "`**`,
 * then the shortest run ending in a non-space" — which is why `**Spacing**` came out as
 * `**S**pacing**`. Maths and strikethrough had the same bug.
 *
 * So each rule closes itself, and the rules OWN their group offsets: `RULES` is walked to build
 * both the expression and the index of where each one's groups start, so inserting a rule in
 * the middle cannot silently renumber the ones after it.
 */
type Rule = {
  /** Source, with every group capturing — the count has to match `render`. */
  src: string
  groups: number
  /** Given this rule's own groups, the HTML for the whole match. */
  render: (g: (string | undefined)[]) => string
}

const RULES: Rule[] = [
  // The one exception to the no-backreference rule, and it is safe only because this is the
  // FIRST rule: the reference and its own first group are the same number. A fence is
  // variable-length (one backtick or two), so it cannot be closed by a literal. Do not move it.
  { src: '(`+)([^`]*?)\\1', groups: 2, render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[0]) },
  { src: '(!?\\[)([^\\]]*)(\\]\\()([^)]*)(\\))', groups: 5,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) + dim(g[3]) + dim(g[4]) },
  { src: '(\\[\\^)([^\\]]+)(\\])', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
  { src: '(==)([^=]+?)(==)(#[a-z]+)?', groups: 4,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) + dim(g[3]) },
  // Display before inline, or a display formula is read as an empty inline one twice.
  { src: '(\\$\\$)([^$\\n]+?)(\\$\\$)', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
  { src: '(\\$)([^$\\n]+?)(\\$)', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
  { src: '(\\*\\*|__)(?=\\S)([\\s\\S]*?\\S)(\\*\\*|__)', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
  // The lookarounds keep snake_case and file_name.txt out of it: a delimiter has to sit
  // against whitespace or punctuation on the outside, which a mid-word underscore never does.
  { src: '(?<![\\w*_])([*_])(?=\\S)([^*_\\n]*?\\S)([*_])(?![\\w*_])', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
  { src: '(~~)(?=\\S)([\\s\\S]*?\\S)(~~)', groups: 3,
    render: (g) => dim(g[0]) + (g[1] ?? '') + dim(g[2]) },
]

const INLINE = new RegExp(RULES.map((r) => r.src).join('|'), 'g')
/** Where each rule's groups begin in the combined match, computed rather than counted. */
const OFFSETS = RULES.reduce<number[]>((acc, _rule, i) => [...acc, (acc[i - 1] ?? 0) + (RULES[i - 1]?.groups ?? 0)], [])

function inlineMarks(line: string): string {
  return line.replace(INLINE, (whole, ...rest: unknown[]) => {
    const g = rest.slice(0, OFFSETS[OFFSETS.length - 1]! + RULES[RULES.length - 1]!.groups) as (string | undefined)[]
    for (let i = 0; i < RULES.length; i += 1) {
      const at = OFFSETS[i]!
      // A rule matched exactly when its FIRST group participated.
      if (g[at] !== undefined) return RULES[i]!.render(g.slice(at, at + RULES[i]!.groups))
    }
    return whole as string
  })
}

/** `---`, `***`, `___` on a line of their own. Dimmed whole: the line IS the marker. */
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/
/** A fence, with whatever language follows it. */
const FENCE = /^(\s*)(```+|~~~+)(.*)$/
/** `#` through `######`, and the space after. */
const HEADING = /^(\s*)(#{1,6} )/
/** One or more `>` — escaped by the time this runs. */
const QUOTE = /^(\s*)((?:&gt; ?)+)/
/** A bullet or a number. The trailing space is part of the marker. */
const BULLET = /^(\s*)([-*+] |\d+[.)] )/

/**
 * One line of source, with its markers wrapped.
 *
 * Line structure first, then inline — a heading's `##` is a different thing from an emphasis
 * `*`, and running the inline pass over a fence's info string would dim the wrong halves of
 * a language name like `c_sharp`. Inside a fence nothing inline is marked at all, which is
 * why `mark()` below tracks the fence state rather than treating each line alone.
 */
function line(raw: string, inFence: boolean): { html: string; fence: boolean } {
  const s = esc(raw)
  const fence = FENCE.exec(s)
  if (fence) {
    return { html: (fence[1] ?? '') + dim((fence[2] ?? '') + (fence[3] ?? '')), fence: !inFence }
  }
  if (inFence) return { html: s, fence: true }
  if (RULE.test(s)) return { html: dim(s), fence: false }

  for (const re of [HEADING, QUOTE, BULLET]) {
    const m = re.exec(s)
    if (m) {
      return { html: (m[1] ?? '') + dim(m[2] ?? '') + inlineMarks(s.slice(m[0].length)), fence: false }
    }
  }
  // A table row: every pipe is structure. Cheaper and more honest than parsing the table,
  // and a pipe outside one is rare enough that dimming it costs nothing.
  if (s.trimStart().startsWith('|')) return { html: s.replace(/\|/g, () => dim('|')), fence: false }
  return { html: inlineMarks(s), fence: false }
}

/** The whole source, marked. Exported for the test, which is the only other caller. */
export function mark(source: string): string {
  let fence = false
  return source.split('\n').map((raw) => {
    const out = line(raw, fence)
    fence = out.fence
    return out.html
  }).join('\n')
}

type Props = {
  value: string
  onChange: (next: string) => void
  onDirty: () => void
  taRef: RefObject<HTMLTextAreaElement | null>
}

export function MarkdownSource({ value, onChange, onDirty, taRef }: Props) {
  // Only when the text changes, not on every parent render: this walks every line.
  const html = useMemo(() => mark(value), [value])
  return (
    <div className="relative">
      {/* A trailing newline so the mirror's last line has height while the caret sits on it. */}
      <pre className="md-box md-mirror" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `${html}\n` }} />
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          onDirty()
        }}
        spellCheck={false}
        className="md-box md-source relative min-h-[60vh] w-full resize-none overflow-hidden"
      />
    </div>
  )
}
