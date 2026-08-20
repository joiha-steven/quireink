// The highlighter, in the editor.
//
// A stroke you cannot see while you are writing is a stroke you cannot place, so the pen has
// to be a real mark in the writing surface and not just literal `==` characters. The mark
// renders as `<mark data-ink="…">`, which is the SAME element the published page uses, so the
// ink CSS in `web/ink.css.ts` styles both from one place (it is carried into the admin sheet
// through `PROSE_CSS`).
//
// THE GRAMMAR IS NOT RESTATED HERE. `render/ink.ts` owns it and this file imports it. Three
// separate readers of `==text==` now exist — marked on the server, markdown-it in the editor,
// and `toPlainText` for excerpts — and the only way three parsers stay in step is for all
// three to be built from one regex. They already drifted once, when `toPlainText` did not
// know the syntax and put the word "green" into every excerpt.
//
// ONE THING THE EDITOR CANNOT HOLD, deliberately: a stroke that runs across an inline CODE
// span. StarterKit's `code` mark is declared `excludes: '_'`, refusing to share a character
// with any other mark, and that cannot be overridden from outside it — `extendMarkSchema`
// merges UNDER the mark's own fields, so it silently does nothing here (that was tried).
// The server renders ``==a `b` c==`` as one stroke; opening it in the editor and saving ends
// the stroke before the code and starts nothing after it. Accepted rather than fixed, because
// the fix is a direct dependency on `@tiptap/extension-code` plus a forked `code` mark, and
// because the ink is not VISIBLE under a code span anyway: the chip paints its own opaque
// `--c-rule` background over the stroke (measured `#e8e8e8` on the rendered page, which is
// the chip, not the pen). The degraded form is stable — serialising it twice is a fixed
// point — and it is valid Markdown, so nothing is corrupted. Pinned by a test.
import { getMarkRange, InputRule, Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import type MarkdownIt from 'markdown-it'
// The `.mjs` specifier the runtime uses has no declaration; `@types/markdown-it` ships this
// one, and it is the same class.
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.js'
import { INKS, DEFAULT_INK, isInk, inkOf, INK_SYNTAX_SOURCE, INK_SYNTAX_CONTENT_LAST } from '@/render/ink'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ink: {
      /** Paint the selection, or lift the pen off it when it already carries this ink. */
      toggleInk: (ink?: string) => ReturnType
    }
  }
}

/**
 * The markdown-it half of the parser, for content ARRIVING in the editor.
 *
 * tiptap-markdown runs markdown-it over the stored Markdown and feeds the resulting HTML
 * through the schema's `parseHTML`, so this rule only has to produce a `<mark>` token pair —
 * TipTap does the rest.
 *
 * `state.md.inline.parse` on the inner text is what lets bold, a link and a code span live
 * under the stroke. Pushing the content as one plain text token would have been three lines
 * shorter and would silently flatten every one of them.
 */
function inkPlugin(md: MarkdownIt): void {
  const rule = new RegExp(`^${INK_SYNTAX_SOURCE}`)
  md.inline.ruler.before('emphasis', 'ink', (state: StateInline, silent: boolean) => {
    // Cheap reject first: this runs at every character of every inline span.
    if (state.src.charCodeAt(state.pos) !== 0x3d) return false
    const m = rule.exec(state.src.slice(state.pos, state.posMax))
    if (!m) return false
    if (silent) return true

    const open = state.push('ink_open', 'mark', 1)
    if (m[2] && m[2] !== DEFAULT_INK) open.attrSet('data-ink', m[2])
    state.md.inline.parse(m[1], state.md, state.env, state.tokens)
    state.push('ink_close', 'mark', -1)
    state.pos += m[0].length
    return true
  })
}

export const Ink = Mark.create({
  name: 'ink',
  // A highlight sits UNDER other emphasis: `==**bold**==` and `**==bold==**` mean the same
  // thing to a reader, and without a fixed order the serializer can emit either nesting.
  priority: 90,
  // Two different inks cannot both apply to one character, and the second should replace the
  // first rather than nest inside it.
  excludes: 'ink',

  addAttributes() {
    return {
      ink: {
        default: DEFAULT_INK,
        parseHTML: (el) => {
          const v = el.getAttribute('data-ink')
          return isInk(v) ? v : DEFAULT_INK
        },
        // Yellow is the meaning of a bare `<mark>`, so it writes no attribute — the same
        // rule the server renderer follows, and what keeps the two outputs identical.
        renderHTML: (attrs) => (attrs.ink && attrs.ink !== DEFAULT_INK ? { 'data-ink': attrs.ink } : {}),
      },
    }
  },

  parseHTML() {
    // `:not([data-form])`, so a ring (`<mark data-form="o">`, PenMarks.ts) never parses as
    // a highlight — its own rule has the higher priority, and this one refuses the match.
    return [{ tag: 'mark:not([data-form])' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      toggleInk:
        (ink = DEFAULT_INK) =>
        ({ commands, editor }) => {
          const chosen = isInk(ink) ? ink : DEFAULT_INK
          // Switching colour on an already-highlighted phrase should RECOLOUR it, not clear
          // it. Only asking for the ink already there lifts the pen.
          if (editor.isActive(this.name) && editor.getAttributes(this.name).ink !== chosen) {
            return commands.updateAttributes(this.name, { ink: chosen })
          }
          return commands.toggleMark(this.name, { ink: chosen })
        },
    }
  },

  /**
   * Typing the syntax inks it on the spot, in TWO rules, because a suffix cannot be waited for.
   *
   * `==go tay==` is already a complete highlight the instant the second `==` lands, so the
   * first rule has to fire there — it cannot pause to see whether `#pink` is coming. The
   * second rule then handles the colour as its own gesture: type `#pink` immediately after a
   * stroke and it recolours that stroke and swallows the text you typed. From the writer's
   * side this is exactly the documented syntax, `==go tay==#pink`, arriving one piece at a
   * time: the words go yellow, then turn pink.
   */
  addInputRules() {
    return [
      markInputRule({
        // The content-last form. See `INK_SYNTAX_CONTENT_LAST` for why that matters.
        find: new RegExp(`${INK_SYNTAX_CONTENT_LAST}$`),
        type: this.type,
        getAttributes: (match) => ({ ink: inkOf(match[0]) }),
      }),
      new InputRule({
        find: new RegExp(`#(${INKS.join('|')})$`),
        handler: ({ state, range, match, chain }) => {
          // Only when the character before the `#` is already inked; otherwise `#pink` is
          // just a word somebody wrote, and a hashtag must survive being typed.
          const at = range.from - 1
          if (at < 0) return null
          const existing = getMarkRange(state.doc.resolve(at), this.type)
          if (!existing || existing.to !== range.from) return null
          chain()
            .deleteRange(range)
            .setTextSelection(existing)
            .updateAttributes(this.name, { ink: match[1] })
            .setTextSelection(existing.to)
            .unsetMark(this.name)
            .run()
          return undefined
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: new RegExp(INK_SYNTAX_CONTENT_LAST, 'g'),
        type: this.type,
        getAttributes: (match) => ({ ink: inkOf(match[0]) }),
      }),
    ]
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: '==',
          // The colour rides on the CLOSING delimiter, so it has to be computed per mark.
          // prosemirror-markdown allows a function here for exactly this.
          close: (_state: unknown, mark: { attrs: { ink?: string } }) => {
            const ink = mark.attrs.ink
            return ink && ink !== DEFAULT_INK && INKS.includes(ink as never) ? `==#${ink}` : '=='
          },
          // Without this, highlighting a phrase and then extending the selection by one space
          // writes `== word ==`, which the grammar deliberately refuses to read back.
          expelEnclosingWhitespace: true,
          // MIXABLE IS NOT OPTIONAL, and leaving it off corrupts the post rather than merely
          // looking wrong. prosemirror-markdown serializes marks per text node, so a stroke
          // containing bold and a link was closed and reopened around each one:
          //
          //   ==chữ **in đậm**, một [liên kết](/x)==#orange
          //     became  ==chữ ==#orange**==in đậm==#orange**==, một ==#orange[==liên…
          //
          // which is not even the same document. `mixable` tells the serializer this mark may
          // stay open across the others and be merged, which is exactly what one stroke over
          // several inline marks means. Caught by round-tripping the fixture, not by reading.
          mixable: true,
        },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(inkPlugin)
          },
        },
      },
    }
  },
})
