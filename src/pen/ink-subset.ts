// The part of the pen one page actually wrote with.
//
// ADR 0027 took the ink out of `site.css` and linked its two sheets only on a page that
// carried a mark. That settled the inkless pages and left the marked ones paying for the whole
// case: measured 2026-10-03 on the showcase fixture, 31 of its 35 articles linked one sheet or
// both — 291 KB and 245 KB raw, 19.6 and 15.2 KB gzipped, every byte render-blocking — and the
// article the review opened wore 6 of the 120 dies in them. Forty grips, five inks, two modes
// and eleven dies multiply out to a sheet that is almost entirely about strokes a page lacks.
//
// So the page carries the strokes it has, and nothing else (ADR 0070). This file is the
// mechanism, and it is deliberately DUMB about the pen: it does not know what a die is or which
// grip deals which. It knows two things about CSS and nothing about ink:
//
//   1. WHICH RULES AN ELEMENT MATCHES. The elements are read off the page's HTML; a selector
//      that matches none of them is dropped.
//   2. WHICH OF THOSE RULES WIN. Of the rules that do match, one that loses EVERY declaration it
//      makes, on every element it matches, in both modes, is dropped too — it could not paint
//      anything if it stayed. This is the half that earns its keep: every highlight matches the
//      bare `mark` rule carrying the default yellow stroke, and on any variant with a die of its
//      own that stroke is outranked by the die's, so before this pass a one-highlight article
//      carried two strokes it could never show. Measured on the showcase: about a third of
//      the inlined bytes.
//
// What is left is the full sheet's own rules, in the sheet's order, with the sheet's
// declarations byte for byte — so an element ends up with exactly the values it had before,
// because each one comes from the same rule that set it before. Nothing here was taught the
// pen's current shape, so a new grip, a new ink or a rule that starts winning where it used to
// lose cannot be subset wrongly by a filter that learned the old one.
//
// THE CONSERVATIVE DIRECTION, every time a question is hard. A selector it cannot read is kept
// and never allowed to outrank anything. A declaration is only beaten by one with EXACTLY its
// property name, so `padding` is never taken to cover `padding-bottom` or the reverse — both
// stay. The ancestors (`.prose`, the embed's `.pen`) are assumed present, and `.dark` is
// decided both ways, because the server cannot know which mode the reader is in.
//
// Import-free, like the rest of this directory (`boundary.test.ts`).

/** One element the pen paints, by the three attributes its sheets select on. */
export type Inked = {
  readonly tag: 'mark' | 'u'
  readonly pen: string | null
  readonly ink: string | null
  readonly form: string | null
}

/**
 * Every distinct element a page asks the pen to paint, read off its HTML.
 *
 * The same scan `penSheetsFor` made before this file existed, and exact for the same reason:
 * rendered bodies are escaped output, so a literal "<mark" in somebody's prose arrives as
 * `&lt;mark` and cannot be read as a tag. The `[\s>]` guard keeps `<u` from matching `<ul>`.
 * Deduplicated, because a post that highlights forty phrases in yellow asks forty times for
 * the same thing and the cascade below should only answer once.
 */
export function inkedElements(html: string): Inked[] {
  const seen = new Map<string, Inked>()
  for (const m of html.matchAll(/<(mark|u)([\s>][^>]*)/g)) {
    const attrs = m[2]!
    const read = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null
    const el: Inked = { tag: m[1] as 'mark' | 'u', pen: read('data-pen'), ink: read('data-ink'), form: read('data-form') }
    seen.set(`${el.tag}|${el.pen}|${el.ink}|${el.form}`, el)
  }
  return [...seen.values()]
}

/**
 * One test on the element a selector ends at. `value: null` means "present at all"; `absent`
 * is the `:not([attr])` the yellow and graphite defaults are written with.
 */
type Test = { readonly attr: 'pen' | 'ink' | 'form'; readonly value: string | null; readonly absent: boolean }

/**
 * A selector, reduced to what it asks: the element's tag and tests, whether it only applies
 * under `.dark`, and its specificity as one comparable number. `null` when it could not be read.
 */
type Selector = {
  readonly tag: string
  readonly tests: readonly Test[]
  readonly dark: boolean
  readonly weight: number
} | null

const ATTRS: Record<string, Test['attr']> = { 'data-pen': 'pen', 'data-ink': 'ink', 'data-form': 'form' }

/**
 * `.dark .prose mark:not([data-ink])[data-pen="7"]` → tag `mark`, two tests, dark, and a
 * weight of (0,4,1). Ancestors may only be plain classes; the last compound may only be a tag
 * followed by the three data attributes, bare, with a value, or under `:not()`. Anything else
 * is `null`, and `null` is kept.
 *
 * The weight packs specificity as `classes × 1000 + tags`: a pen selector has at most a
 * handful of each, so the packing cannot carry, and comparing two numbers is comparing the
 * two (b, c) pairs. Nothing in these sheets has an id, and anything that did would be `null`.
 */
function selector(text: string): Selector {
  const parts = text.trim().split(/\s+/)
  const last = parts.pop() ?? ''
  if (!parts.every((p) => /^(\.[a-z][a-z0-9-]*)+$/.test(p))) return null
  const ancestors = parts.flatMap((p) => p.split('.').filter(Boolean))
  const head = /^[a-z]+/.exec(last)
  if (!head) return null
  const tests: Test[] = []
  let rest = last.slice(head[0].length)
  while (rest) {
    const not = /^:not\(\[(data-[a-z]+)\]\)/.exec(rest)
    const has = /^\[(data-[a-z]+)(?:=(?:"([^"]*)"|([^\]"]*)))?\]/.exec(rest)
    const step = not ?? has
    const attr = step ? ATTRS[step[1]!] : undefined
    if (!step || !attr) return null
    tests.push(not
      ? { attr, value: null, absent: true }
      : { attr, value: has![2] ?? has![3] ?? null, absent: false })
    rest = rest.slice(step[0].length)
  }
  return { tag: head[0], tests, dark: ancestors.includes('dark'), weight: (ancestors.length + tests.length) * 1000 + 1 }
}

function matches(s: NonNullable<Selector>, el: Inked, dark: boolean): boolean {
  if (s.dark && !dark) return false
  if (s.tag !== el.tag) return false
  return s.tests.every((t) => {
    const v = el[t.attr]
    if (t.absent) return v === null
    return t.value === null ? v !== null : v === t.value
  })
}

/**
 * The property names a declaration block sets. Split on `;` outside quotes and brackets, which
 * is the one thing a data-URI could otherwise break; the value itself is never needed.
 */
function properties(body: string): string[] {
  const out: string[] = []
  let depth = 0, quote = '', start = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === ';' && depth === 0) || i === body.length) {
      const name = body.slice(start, i).split(':')[0]!.trim()
      if (name) out.push(name)
      start = i + 1
    }
  }
  return out
}

/** A sheet, read once: each rule's selectors already reduced, its declarations untouched. */
export type ParsedInk = ReadonlyArray<{
  readonly selectors: ReadonlyArray<{ readonly text: string; readonly test: Selector }>
  readonly body: string
  readonly props: readonly string[]
}>

/**
 * Read a MINIFIED pen sheet into rules.
 *
 * The pen's sheets are flat — no `@media`, no nesting, no brace inside a value (the data-URIs
 * encode `<` and `#` and carry no `{`) — so a rule is everything up to a `}`. A sheet that
 * breaks that assumption is refused here rather than subset into nonsense, and both built
 * sheets go through this in `pen-style.test.ts`, so the refusal lands in a test, not on a page.
 */
export function parseInk(css: string): ParsedInk {
  if (css.includes('@')) throw new Error('parseInk: a pen sheet with an at-rule cannot be subset rule by rule')
  return css.split('}').filter((chunk) => chunk.trim()).map((chunk) => {
    const open = chunk.indexOf('{')
    if (open < 0 || chunk.indexOf('{', open + 1) >= 0) throw new Error(`parseInk: unreadable rule ${chunk.slice(0, 60)}`)
    const body = chunk.slice(open + 1)
    return {
      selectors: chunk.slice(0, open).split(',').map((text) => ({ text, test: selector(text) })),
      body,
      props: properties(body),
    }
  })
}

/**
 * The rules of a parsed sheet that can paint something on this page, as minified CSS. '' when
 * nothing can, which is how a page with no ink gets no `<style>` at all.
 *
 * For every element, in each mode, every property is awarded to the matching selector with the
 * highest specificity, the later rule winning a tie — the cascade, inside one sheet with no
 * `!important`. A selector survives if it won a property somewhere, or if it could not be read;
 * a rule survives with the selectors that did.
 */
export function inkSubset(sheet: ParsedInk, elements: readonly Inked[]): string {
  if (elements.length === 0) return ''
  const keep = sheet.map((rule) => rule.selectors.map((s) => s.test === null))
  for (const el of elements) {
    for (const dark of [false, true]) {
      // property → [weight, rule, selector] of its current winner
      const best = new Map<string, [number, number, number]>()
      sheet.forEach((rule, r) => rule.selectors.forEach((s, i) => {
        if (s.test === null || !matches(s.test, el, dark)) return
        for (const prop of rule.props) {
          const held = best.get(prop)
          if (!held || s.test.weight > held[0] || (s.test.weight === held[0] && r >= held[1])) {
            best.set(prop, [s.test.weight, r, i])
          }
        }
      }))
      for (const [, r, i] of best.values()) keep[r]![i] = true
    }
  }
  let out = ''
  sheet.forEach((rule, r) => {
    const kept = rule.selectors.filter((_, i) => keep[r]![i])
    if (kept.length) out += `${kept.map((s) => s.text).join(',')}{${rule.body}}`
  })
  return out
}
