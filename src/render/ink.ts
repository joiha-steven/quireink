// The highlighter pen: `==text==`, and `==text==#green` when the writer wants a colour
// other than the default yellow.
//
// A `marked` inline extension rather than a post-pass over the rendered HTML, which is how
// the callouts and the galleries in `post-content.ts` are built. Those two rewrite HTML
// because they reshape whole BLOCKS that marked has already produced. A highlight is inline
// and can hold other inline markup, so it has to be a real token: a regex over the finished
// HTML would happily match a `==` that landed inside an attribute, and it could not render
// bold, a link or a code span inside the stroke — which is the first thing anyone tries.
//
// The markup is deliberately the ONLY thing this file decides. What the stroke looks like is
// CSS (`web/ink.css.ts`), because rendered bodies are cached under a hash of their Markdown:
// a stroke baked into the HTML could not be restyled without evicting every cached body.
import type { Tokens, TokenizerAndRendererExtension } from 'marked'
import { PEN_VARIANT_COUNT } from '@/render/pen-dies'

/**
 * The five pigments, and the order is the order they are offered in.
 *
 * Five and not four: the reference photo's box holds four (yellow, orange, green, pink) and
 * blue is the one colour that could not be measured off the paper, only off the box's tab.
 * It is carried anyway because four inks leave no cool colour at all, and a highlight that
 * marks a DEFINITION reads wrong in every one of the four warm-to-mid options.
 */
export const INKS = ['yellow', 'green', 'pink', 'blue', 'orange'] as const

export type Ink = (typeof INKS)[number]

/** Yellow is what a bare `==text==` means, and it is the pen anyone reaches for first. */
export const DEFAULT_INK: Ink = 'yellow'

export const isInk = (v: unknown): v is Ink => INKS.includes(v as Ink)

/**
 * `==` … `==`, with an optional `#colour` immediately after the closing pair.
 *
 * Two guards keep it from eating ordinary prose:
 *
 *  - The opening `==` must be followed by a character that is neither whitespace nor `=`, and
 *    the content must END on one. Without that, `a == b and c == d` highlights " b and c " —
 *    arithmetic and shell snippets in running text are common enough that this is the
 *    difference between a feature and a trap. Same rule GFM uses for `~~strikethrough~~`.
 *  - `(?!=)` on the close, so a run of three or more `=` is not a highlight.
 *
 * `[\s\S]` deliberately includes a newline: a highlighted sentence wrapped across two source
 * lines is one stroke. It cannot cross a BLANK line, because that ends the paragraph and this
 * tokenizer only sees one block's inline content. A run of `=` on its own line — a setext H1
 * underline — never reaches here; the block tokenizer has already claimed it.
 *
 * ⚠️ Exported AS SOURCE because four readers exist: marked here, markdown-it in the editor,
 * the editor's typing rule, and `toPlainText` for excerpts. Not tidiness — the two that were
 * once written out separately drifted within the hour, and `toPlainText` put the word "green"
 * into every excerpt of a post that used a colour suffix. Group 1 is the words, group 2 the
 * colour.
 */
const STROKE = `==(?=[^\\s=])([\\s\\S]*?[^\\s=])==(?!=)`

export const INK_SYNTAX_SOURCE = `${STROKE}(?:#(${INKS.join('|')})\\b)?`

/**
 * The same grammar with the colour NOT captured, so the words are the last capture group.
 *
 * This exists for TipTap alone, and only because of a convention that is invisible until it
 * bites: `markInputRule` and `markPasteRule` both take `match[match.length - 1]` as the text
 * to mark. With the colour captured last, typing `==go tay==#pink` marked the word "pink"
 * and DELETED "go tay" — the rule did exactly what it promises, on the wrong group. Seen by
 * typing into the real editor; every unit test still passed, because the tests exercise the
 * parser and the serializer rather than the keystrokes between them.
 */
export const INK_SYNTAX_CONTENT_LAST = `${STROKE}(?:#(?:${INKS.join('|')})\\b)?`

/** Pull the colour off a match of either form. */
export const inkOf = (raw: string): Ink => {
  const m = /#([a-z]+)$/.exec(raw)
  return m && isInk(m[1]) ? m[1] : DEFAULT_INK
}

const RULE = new RegExp(`^${INK_SYNTAX_SOURCE}`)

/**
 * The same grammar, unanchored and global, for flattening a body to plain text.
 *
 * Seen on the page, not deduced: before `toPlainText` used this, the excerpt above the very
 * first test post read `==mang dấu vết của người đọc==` — and since that function strips `#`
 * as a bare character, `==quote==#green` came out as `==quote== green`, putting the word
 * "green" into the deck, the meta description, the OG card and the RSS summary.
 */
export const INK_SYNTAX_GLOBAL = new RegExp(INK_SYNTAX_SOURCE, 'g')

/**
 * An unrecognised colour is NOT an error and NOT a highlight in some fallback shade: the
 * `#…` simply is not read as a suffix, so `==sale==#50off` renders the stroke and then the
 * literal text `#50off`, which is what it looks like it should do.
 */
export const inkExtension: TokenizerAndRendererExtension = {
  name: 'highlight',
  level: 'inline',
  // marked calls this to find where the next match could possibly start, so it can hand the
  // tokenizer a shorter string. Returning -1 (indexOf's miss) tells it there is none.
  start(src: string) {
    return src.indexOf('==')
  },
  tokenizer(src: string) {
    const m = RULE.exec(src)
    if (!m) return undefined
    return {
      type: 'highlight',
      raw: m[0],
      ink: m[2] as Ink | undefined,
      // Parsed as inline markdown, so bold, a link and a code span all survive under the
      // stroke. `this.lexer.inlineTokens` is the tokenizer-side half of `parseInline`.
      tokens: this.lexer.inlineTokens(m[1]),
    }
  },
  renderer(token) {
    const t = token as Tokens.Generic & { ink?: Ink }
    const inner = this.parser.parseInline(t.tokens ?? [])
    // No attribute for the default. Yellow is the meaning of a bare `==`, so spelling it
    // out would put a colour nobody chose into every cached body, and `<mark>` on its own
    // is already the correct element.
    const ink = t.ink && t.ink !== DEFAULT_INK ? ` data-ink="${t.ink}"` : ''
    // `data-pen` is IDENTITY, not appearance — which of the pen's variants this highlight
    // wears; `web/ink.css.ts` decides what the number looks like, so the rule above holds.
    // A hash of the highlight's own source, because no sibling-counting selector can deal
    // strokes across a PAGE: most paragraphs hold one mark, so `:nth-of-type` jitter dealt
    // every paragraph's first highlight the same card — a page of twelve highlights wearing
    // one silhouette twelve times, which is the machine look this pen exists to avoid.
    // Content-addressed, so a phrase keeps its stroke across re-renders and cached bodies
    // stay deterministic.
    return `<mark${ink} data-pen="${penSeed(t.raw ?? '')}">${inner}</mark>`
  },
}

/** FNV-1a, folded to a pen-variant number. Stable by construction — cached bodies carry it. */
export function penSeed(raw: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % PEN_VARIANT_COUNT
}

/* ------------------------------------------------------------------------------------- *
 * The pen's other two gestures, same grammar shape, same guards, same four readers:
 *
 *   `++text++`  — an underline, drawn in pencil unless a `#colour` names one of the five
 *                 inks. `<u>` on purpose: it is HTML's "unarticulated annotation", and a
 *                 feed reader that knows no CSS still shows an underline.
 *   `@@text@@`  — a ring around a word, drawn in red ballpoint unless a `#colour` says
 *                 otherwise. `<mark data-form="o">`: ringing a word IS marking it, and the
 *                 same feed reader degrades it to a visible mark.
 *
 * The opening pair may not touch whitespace and a triple is not a gesture, exactly as with
 * `==` — which keeps `C++ and ++i`, `x @@ y` and email-adjacent `@` runs out of the pen's
 * reach. Unlike the highlighter, a NAMED default is still an attribute here: `#yellow` on
 * an underline is a choice (the default is graphite), so it is never elided.
 * ------------------------------------------------------------------------------------- */

const UNDER = `\\+\\+(?=[^\\s+])([\\s\\S]*?[^\\s+])\\+\\+(?!\\+)`
const RING = `@@(?=[^\\s@])([\\s\\S]*?[^\\s@])@@(?!@)`

export const UNDER_SYNTAX_SOURCE = `${UNDER}(?:#(${INKS.join('|')})\\b)?`
export const UNDER_SYNTAX_CONTENT_LAST = `${UNDER}(?:#(?:${INKS.join('|')})\\b)?`
export const UNDER_SYNTAX_GLOBAL = new RegExp(UNDER_SYNTAX_SOURCE, 'g')
export const RING_SYNTAX_SOURCE = `${RING}(?:#(${INKS.join('|')})\\b)?`
export const RING_SYNTAX_CONTENT_LAST = `${RING}(?:#(?:${INKS.join('|')})\\b)?`
export const RING_SYNTAX_GLOBAL = new RegExp(RING_SYNTAX_SOURCE, 'g')

/** One gesture extension; the three differ only in fence, name and the tag they emit. */
function gesture(name: string, fence: string, rule: RegExp,
  open: (ink: Ink | undefined, seed: number) => string, close: string,
): TokenizerAndRendererExtension {
  return {
    name,
    level: 'inline',
    start(src: string) {
      return src.indexOf(fence)
    },
    tokenizer(src: string) {
      const m = rule.exec(src)
      if (!m) return undefined
      return { type: name, raw: m[0], ink: m[2] as Ink | undefined,
        tokens: this.lexer.inlineTokens(m[1]!) }
    },
    renderer(token) {
      const t = token as Tokens.Generic & { ink?: Ink }
      return open(t.ink, penSeed(t.raw ?? '')) + this.parser.parseInline(t.tokens ?? []) + close
    },
  }
}

export const underExtension = gesture('underline', '++',
  new RegExp(`^${UNDER_SYNTAX_SOURCE}`),
  (ink, seed) => `<u${ink ? ` data-ink="${ink}"` : ''} data-pen="${seed}">`, '</u>')

export const ringExtension = gesture('ring', '@@',
  new RegExp(`^${RING_SYNTAX_SOURCE}`),
  (ink, seed) => `<mark data-form="o"${ink ? ` data-ink="${ink}"` : ''} data-pen="${seed}">`,
  '</mark>')
