// The highlighter, in the editor.
//
// A stroke you cannot see while writing is a stroke you cannot place, so the pen is a real
// mark in the writing surface rather than literal `==`. It renders as `<mark data-ink="…">`,
// the SAME element the published page uses, so `pen/ink.css.ts` styles both from one place.
//
// THE GRAMMAR IS NOT RESTATED HERE; `pen/grammar.ts` owns it and this imports it. There used to
// be three readers of `==text==` — marked on the server, markdown-it here, `toPlainText` for
// excerpts — kept in step by one shared regex, and they drifted anyway: `toPlainText` did not
// know the syntax and put the word "green" into every excerpt on the site. Since 2026-09-13
// there is ONE reader (`md/inline-pen.ts`), and what is left in this file is the MARK: how a
// stroke looks while it is being written, and the keys and typing rules that draw it.
//
// ⚠️ ONE THING THE EDITOR CANNOT HOLD, deliberately: a stroke running across an inline CODE
// span. StarterKit's `code` mark is `excludes: '_'` and that cannot be overridden from outside
// — `extendMarkSchema` merges UNDER the mark's own fields, so it silently does nothing (tried).
// The server renders ``==a `b` c==`` as one stroke; opening and saving ends the stroke before
// the code. Accepted rather than fixed: the fix is a direct dependency on
// `@tiptap/extension-code` plus a forked mark, and the ink is not VISIBLE under a code span
// anyway — the chip paints its own opaque `--c-rule` over it. The degraded form is a fixed
// point and valid Markdown, so nothing is corrupted. Pinned by a test.
import { getMarkRange, InputRule, Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
// one, and it is the same class.
import { INKS, DEFAULT_INK, isInk, inkOf, INK_SYNTAX_CONTENT_LAST } from '@/pen/grammar'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ink: {
      /** Paint the selection, or lift the pen off it when it already carries this ink. */
      toggleInk: (ink?: string) => ReturnType
    }
  }
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

  // The pen the product is named for had no chord at all. `Mod-Shift-h` for highlight, and it
  // reaches for the DEFAULT ink — a chord is the fast gesture, and choosing a colour is what
  // the toolbar's swatches are for. The chord table and the collisions it was checked against
  // are in `editorKeys.ts`.
  addKeyboardShortcuts() {
    return { 'Mod-Shift-h': () => this.editor.commands.toggleInk(DEFAULT_INK) }
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
})
