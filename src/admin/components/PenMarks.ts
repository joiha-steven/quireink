// The pen's other two gestures, in the editor: the underline and the ring.
//
// UNDERLINE REPLACES StarterKit's, and the replacement is the bug fix. StarterKit ships an
// `underline` mark with no markdown serialization, and tiptap-markdown's answer to that is
// `"underline" mark is only available in html mode` — logged, not thrown, while it saves
// the document WITHOUT the mark. Press U, save, and the underline is silently gone. The
// mark here serializes to `++text++` (the grammar `render/ink.ts` owns), so what the button
// applies is what the file keeps. StarterKit is configured with `underline: false` in
// `editorExtensions.ts`; this mark keeps the name, the Mod-U shortcut and the
// `toggleUnderline` command, so the toolbar did not have to learn anything.
//
// THE GRAMMARS ARE NOT RESTATED HERE — same rule, same reason as `InkMark.ts`: every
// parser of `++`/`@@` is built from the one regex in `render/ink.ts`, because the two
// copies this repo once had of `==` drifted within the hour.
import { getMarkRange, InputRule, Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'
import type MarkdownIt from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.js'
import {
  INKS, isInk, RING_SYNTAX_CONTENT_LAST, RING_SYNTAX_SOURCE,
  UNDER_SYNTAX_CONTENT_LAST, UNDER_SYNTAX_SOURCE,
} from '@/render/ink'
import type { Ink } from '@/render/ink'
import { parseInlineInto } from './markdown-nested'

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

/** markdown-it half, for content ARRIVING in the editor — the `inkPlugin` shape exactly. */
function gesturePlugin(name: string, first: number, source: string, tag: string,
  attrs: readonly (readonly [string, string])[]): (md: MarkdownIt) => void {
  const rule = new RegExp(`^${source}`)
  return (md) => {
    md.inline.ruler.before('emphasis', name, (state: StateInline, silent: boolean) => {
      if (state.src.charCodeAt(state.pos) !== first) return false
      const m = rule.exec(state.src.slice(state.pos, state.posMax))
      if (!m) return false
      if (silent) return true
      const open = state.push(`${name}_open`, tag, 1)
      for (const [k, v] of attrs) open.attrSet(k, v)
      if (m[2]) open.attrSet('data-ink', m[2])
      parseInlineInto(state, m[1]!)
      state.push(`${name}_close`, tag, -1)
      state.pos += m[0].length
      return true
    })
  }
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

const serialize = (fence: string) => ({
  open: fence,
  close: (_state: unknown, mark: { attrs: { ink?: string } }) =>
    (isInk(mark.attrs.ink) ? `${fence}#${mark.attrs.ink}` : fence),
  expelEnclosingWhitespace: true,
  // Not optional — see InkMark's serialize block for the corrupted document it prevents.
  mixable: true,
})

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

  addStorage() {
    return {
      markdown: {
        serialize: serialize('++'),
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(gesturePlugin('under', 0x2b, UNDER_SYNTAX_SOURCE, 'u', []))
          },
        },
      },
    }
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

  addStorage() {
    return {
      markdown: {
        serialize: serialize('@@'),
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(gesturePlugin('ring', 0x40, RING_SYNTAX_SOURCE, 'mark',
              [['data-form', 'o']]))
          },
        },
      },
    }
  },
})
