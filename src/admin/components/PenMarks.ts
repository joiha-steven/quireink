// The pen's other two gestures, in the editor: the underline and the ring.
//
// UNDERLINE REPLACES StarterKit's, and the replacement is the bug fix. StarterKit ships an
// `underline` mark with no markdown serialization, and tiptap-markdown's answer to that is
// `"underline" mark is only available in html mode` — logged, not thrown, while it saves
// the document WITHOUT the mark. Press U, save, and the underline is silently gone. The
// mark here serializes to `++text++` (the grammar `pen/grammar.ts` owns), so what the button
// applies is what the file keeps. StarterKit is configured with `underline: false` in
// `editorExtensions.ts`; this mark keeps the name, the Mod-U shortcut and the
// `toggleUnderline` command, so the toolbar did not have to learn anything.
//
// THE GRAMMARS ARE NOT RESTATED HERE — same rule, same reason as `InkMark.ts`: every
// parser of `++`/`@@` is built from the one regex in `pen/grammar.ts`, because the two
// copies this repo once had of `==` drifted within the hour.
import { getMarkRange, InputRule, Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import type { MarkType } from 'prosemirror-model'
import { INKS, isInk, RING_SYNTAX_CONTENT_LAST, UNDER_SYNTAX_CONTENT_LAST } from '@/pen/grammar'
import type { Ink } from '@/pen/grammar'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ring: {
      /** Ring the selection, or lift the pen when it is already ringed. */
      toggleRing: (ink?: string) => ReturnType
    }
  }
}

/**
 * The colour suffix of a line gesture, or undefined. NOT `inkOf`: that one answers "which
 * ink is this highlight" and yellow is a correct default there. For the pencil and the
 * ballpoint, no suffix means graphite/red, and those are not inks — the absence has to
 * survive as an absence.
 */
const suffixOf = (raw: string): Ink | undefined => {
  const m = /#([a-z]+)$/.exec(raw)
  return m && isInk(m[1]) ? m[1] : undefined
}

/** The `#colour` afterthought: recolour the gesture just closed, swallow the suffix.
 *  `self` is the `this` of an addInputRules body — the runtime context, not the class. */
function suffixRule(self: { name: string, type: MarkType }): InputRule {
  return new InputRule({
    find: new RegExp(`#(${INKS.join('|')})$`),
    handler: ({ state, range, match, chain }) => {
      const at = range.from - 1
      if (at < 0) return null
      const existing = getMarkRange(state.doc.resolve(at), self.type)
      if (!existing || existing.to !== range.from) return null
      chain()
        .deleteRange(range)
        .setTextSelection(existing)
        .updateAttributes(self.name, { ink: match[1] })
        .setTextSelection(existing.to)
        .unsetMark(self.name)
        .run()
      return undefined
    },
  })
}

/** No suffix, no attribute — graphite and red are defaults, not choices. */
const inkAttribute = {
  ink: {
    default: '',
    parseHTML: (el: HTMLElement) => {
      const v = el.getAttribute('data-ink')
      return isInk(v) ? v : ''
    },
    renderHTML: (attrs: { ink?: string }) => (isInk(attrs.ink) ? { 'data-ink': attrs.ink } : {}),
  },
}

export const PenUnderline = Mark.create({
  name: 'underline',
  priority: 95, // under the ink, above bold/italic — one stable nesting order
  excludes: 'underline',

  addAttributes: () => inkAttribute,
  parseHTML: () => [{ tag: 'u' }],
  renderHTML: ({ HTMLAttributes }) => ['u', mergeAttributes(HTMLAttributes), 0],

  addCommands() {
    return {
      setUnderline: () => ({ commands }) => commands.setMark(this.name),
      toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name),
      unsetUnderline: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
  addKeyboardShortcuts() {
    return { 'Mod-u': () => this.editor.commands.toggleUnderline() }
  },

  addInputRules() {
    return [
      markInputRule({
        find: new RegExp(`${UNDER_SYNTAX_CONTENT_LAST}$`),
        type: this.type,
        getAttributes: (match) => ({ ink: suffixOf(match[0]) ?? '' }),
      }),
      suffixRule(this),
    ]
  },
  addPasteRules() {
    return [markPasteRule({
      find: new RegExp(UNDER_SYNTAX_CONTENT_LAST, 'g'),
      type: this.type,
      getAttributes: (match) => ({ ink: suffixOf(match[0]) ?? '' }),
    })]
  },

})

export const PenRing = Mark.create({
  name: 'ring',
  priority: 85,
  excludes: 'ring',

  addAttributes: () => inkAttribute,
  // Priority above InkMark's bare `mark` rule, and InkMark's rule carries
  // `:not([data-form])` — both guards, so a pasted ring never parses as a highlight.
  parseHTML: () => [{ tag: 'mark[data-form="o"]', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) =>
    ['mark', mergeAttributes({ 'data-form': 'o' }, HTMLAttributes), 0],

  addCommands() {
    return {
      toggleRing: (ink = '') => ({ commands }) =>
        commands.toggleMark(this.name, { ink: isInk(ink) ? ink : '' }),
    }
  },

  // `Mod-Shift-o`, o for the shape it draws. Red without an ink named, which is what the
  // command already defaults to — see `editorKeys.ts` for the whole chord table.
  addKeyboardShortcuts() {
    return { 'Mod-Shift-o': () => this.editor.commands.toggleRing() }
  },

  addInputRules() {
    return [
      markInputRule({
        find: new RegExp(`${RING_SYNTAX_CONTENT_LAST}$`),
        type: this.type,
        getAttributes: (match) => ({ ink: suffixOf(match[0]) ?? '' }),
      }),
      suffixRule(this),
    ]
  },
  addPasteRules() {
    return [markPasteRule({
      find: new RegExp(RING_SYNTAX_CONTENT_LAST, 'g'),
      type: this.type,
      getAttributes: (match) => ({ ink: suffixOf(match[0]) ?? '' }),
    })]
  },

})
