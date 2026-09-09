// The pen's grammar as `marked` extensions: the one parser the SERVER uses.
//
// `grammar.ts` owns the regexes and is import-free; this is the adapter that turns each
// gesture into an inline token and renders it. A `marked` inline extension rather than a
// post-pass over the rendered HTML, which is how the callouts and the galleries in
// `render/post-content.ts` are built. Those two rewrite HTML because they reshape whole
// BLOCKS that marked has already produced. A gesture is inline and can hold other inline
// markup, so it has to be a real token: a regex over the finished HTML would happily match
// a `==` that landed inside an attribute, and it could not render bold, a link or a code
// span inside the stroke — which is the first thing anyone tries.
//
// The markup is deliberately the ONLY thing this file decides. What the stroke looks like is
// CSS (`pen/css.ts`), because rendered bodies are cached under a hash of their Markdown: a
// stroke baked into the HTML could not be restyled without evicting every cached body.
import type { Tokens, TokenizerAndRendererExtension } from 'marked'
import {
  DEFAULT_INK, INK_SYNTAX_SOURCE, RING_SYNTAX_SOURCE, UNDER_SYNTAX_SOURCE, penSeed,
  type Ink,
} from '@/pen/grammar'

const RULE = new RegExp(`^${INK_SYNTAX_SOURCE}`)

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
    // wears; `pen/css.ts` decides what the number looks like, so the rule above holds.
    // A hash of the highlight's own source, because no sibling-counting selector can deal
    // strokes across a PAGE: most paragraphs hold one mark, so `:nth-of-type` jitter dealt
    // every paragraph's first highlight the same card — a page of twelve highlights wearing
    // one silhouette twelve times, which is the machine look this pen exists to avoid.
    // Content-addressed, so a phrase keeps its stroke across re-renders and cached bodies
    // stay deterministic.
    return `<mark${ink} data-pen="${penSeed(t.raw ?? '')}">${inner}</mark>`
  },
}


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
