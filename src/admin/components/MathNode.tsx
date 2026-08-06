// Mathematics, in the editor.
//
// THIS FILE IS NOT A NICETY, and that is worth saying plainly because it looks like one: the
// server half in `render/math.ts` renders formulas perfectly well without it. What it does
// not do is survive the editor. Measured on the real extension set before a line of this was
// written, opening a post and saving it again did the following:
//
//     $$M \times V = P \times Q$$   ->   $$M \\times V = P \\times Q$$
//     \(a_1 + b_2\)                 ->   (a_1 + b_2)
//
// The first doubles every backslash, so `\times` becomes a literal `\\times` and the formula
// stops parsing. The second is worse: markdown-it's `escape` rule reads `\(` as an escaped
// parenthesis and eats the delimiters outright, so the formula is not damaged but GONE, with
// no way to tell from the saved file that it was ever maths. Neither throws. Both corrupt the
// author's source on a save they did not know was a rewrite.
//
// So the editor has to know the grammar. It does not restate it: `render/math.ts` owns it and
// this file calls `matchMathAt` / `matchDisplayBlockAt`, which is the same discipline
// `InkMark.ts` follows and for the same reason — the ink syntax drifted between two readers
// within an hour of being written down twice.
import { useEffect, useRef, useState } from 'react'
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type MarkdownIt from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.js'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.js'
import {
  matchMathAt, matchDisplayBlockAt, mathToMarkdown, renderMath, type MathDelim,
} from '@/render/math'
import { useAdminT } from './I18nProvider'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** Drop a formula in at the cursor, display or inline, ready to be typed into. */
      setMath: (display: boolean, tex?: string) => ReturnType
    }
  }
}

/**
 * The markdown-it half, for content ARRIVING in the editor.
 *
 * `before('escape')` is not a preference, it is the fix for the vanishing `\(a\)` above:
 * markdown-it's escape rule claims a backslash pair before any later rule can look at it, so
 * a maths rule registered after it never sees an opening delimiter at all.
 *
 * The tokens are plain HTML because that is what tiptap-markdown feeds to the schema's
 * `parseHTML`. The TeX rides in an attribute rather than as the element's text so that
 * nothing downstream is tempted to parse it as prose.
 */
function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math', (state: StateInline, silent: boolean) => {
    const ch = state.src.charCodeAt(state.pos)
    // Cheap reject first: this runs at every character of every inline span. `$` or `\`.
    if (ch !== 0x24 && ch !== 0x5c) return false
    const m = matchMathAt(state.src.slice(state.pos, state.posMax))
    if (!m) return false
    if (silent) return true
    // An OPEN/CLOSE pair, not one self-closing token. markdown-it renders a `nesting: 0`
    // token as a bare `<span …>` with nothing after it, and an unclosed span swallows the
    // rest of the paragraph into an atom node that discards its children — so
    // `inline $M$ here` saved back as `inline $M$` and the word "here" was gone. Measured.
    const open = state.push('math_inline_open', 'span', 1)
    open.attrSet('data-math', m.display ? 'display' : 'inline')
    open.attrSet('data-tex', m.tex)
    open.attrSet('data-delim', m.delim)
    state.push('math_inline_close', 'span', -1)
    state.pos += m.raw.length
    return true
  })

  md.block.ruler.before('paragraph', 'math_block', (state: StateBlock, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    // A block formula may run over several lines, so the rule is handed everything from here
    // to the end of the parsed range and decides for itself where it stops.
    const m = matchDisplayBlockAt(state.src.slice(start, state.eMarks[endLine - 1] ?? state.src.length))
    if (!m) return false
    if (silent) return true
    const open = state.push('math_block_open', 'div', 1)
    open.attrSet('data-math', 'block')
    open.attrSet('data-tex', m.tex)
    open.attrSet('data-delim', m.delim)
    open.map = [startLine, startLine + m.raw.replace(/\n+$/, '').split('\n').length]
    state.push('math_block_close', 'div', -1)
    state.line = open.map[1]
    return true
  })
}

/**
 * What a formula looks like while you are writing it.
 *
 * Rendered, not shown as source, because the argument the pen makes applies here twice over:
 * a stroke you cannot see is one you cannot place, and a formula you cannot see is one you
 * cannot check. A misplaced brace in `\frac{a}{b}` is invisible in the source and obvious the
 * moment it is set. Selecting the node swaps in the TeX so it can be corrected, and the same
 * `renderMath` the server uses draws it — one function, so the writing surface cannot show
 * something the published page will not.
 */
function MathView({ node, updateAttributes, selected }: NodeViewProps) {
  const t = useAdminT()
  const tex = (node.attrs.tex as string) || ''
  const display = node.attrs.display as boolean
  const [draft, setDraft] = useState(tex)
  const input = useRef<HTMLInputElement>(null)
  // Selecting an empty formula (the toolbar just inserted one) should put the caret in the
  // box, not make the writer click it as well.
  useEffect(() => {
    if (selected) { setDraft(tex); input.current?.focus() }
  }, [selected, tex])
  const commit = (v: string) => { setDraft(v); updateAttributes({ tex: v }) }
  return (
    <NodeViewWrapper as={display ? 'div' : 'span'} className={display ? 'my-4 block' : 'inline-block'}>
      {selected ? (
        <input
          ref={input}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          placeholder={t.mathPlaceholder}
          spellCheck={false}
          className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 font-mono text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        />
      ) : tex.trim() ? (
        <span
          className={display ? 'block overflow-x-auto text-center' : ''}
          // The MathML comes from `renderMath`, which builds it from the TeX with Temml and
          // escapes its own fallback. Nothing here is reader-supplied: the only person who
          // can put TeX into a post is the signed-in owner.
          dangerouslySetInnerHTML={{ __html: renderMath(tex, display) }}
        />
      ) : (
        <span className="text-sm text-neutral-400">{t.mathPlaceholder}</span>
      )}
    </NodeViewWrapper>
  )
}

/** Everything both nodes share; only `inline`/`group` and the default delimiter differ. */
const common = {
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      tex: { default: '' },
      display: { default: false },
      delim: { default: 'dollar' as MathDelim },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView)
  },
}

const parseAttrs = (el: HTMLElement) => ({
  tex: el.getAttribute('data-tex') || '',
  display: el.getAttribute('data-math') !== 'inline',
  delim: (el.getAttribute('data-delim') || 'dollar') as MathDelim,
})

const serialize = (
  state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
  node: { attrs: { tex: string; display: boolean; delim: MathDelim } },
  block: boolean,
) => {
  state.write(mathToMarkdown(node.attrs.tex, node.attrs.display, node.attrs.delim))
  if (block) state.closeBlock(node)
}

export const MathInline = Node.create({
  ...common,
  name: 'mathInline',
  inline: true,
  group: 'inline',
  parseHTML() {
    return [{ tag: 'span[data-math]', getAttrs: (el) => parseAttrs(el as HTMLElement) }]
  },
  renderHTML({ node }) {
    return ['span', {
      'data-math': node.attrs.display ? 'display' : 'inline',
      'data-tex': node.attrs.tex,
      'data-delim': node.attrs.delim,
    }]
  },
  addCommands() {
    return {
      setMath:
        (display, tex = '') =>
        ({ commands }) =>
          commands.insertContent({
            type: display ? 'mathBlock' : 'mathInline',
            attrs: { tex, display, delim: display ? 'dollar' : 'dollar' },
          }),
    }
  },
  addStorage() {
    return { markdown: { serialize: (s: never, n: never) => serialize(s, n, false), parse: { setup: (md: MarkdownIt) => md.use(mathPlugin) } } }
  },
})

export const MathBlock = Node.create({
  ...common,
  name: 'mathBlock',
  group: 'block',
  draggable: true,
  // A block node is display maths by definition; the shared default is the inline one.
  addAttributes() {
    return { tex: { default: '' }, display: { default: true }, delim: { default: 'dollar' as MathDelim } }
  },
  parseHTML() {
    return [{ tag: 'div[data-math]', getAttrs: (el) => parseAttrs(el as HTMLElement) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-math': 'block', 'data-tex': node.attrs.tex, 'data-delim': node.attrs.delim }]
  },
  addStorage() {
    return { markdown: { serialize: (s: never, n: never) => serialize(s, n, true), parse: {} } }
  },
})
