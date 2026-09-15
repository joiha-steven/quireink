// MARKDOWN AS IT IS TYPED (ADR 0054 step 7).
//
// `## ` becomes a heading on the space; `**word**` goes bold on the second asterisk; `==word==`
// inks itself. Every one of these was an input rule inside some package's extension, and every
// one of the regexes below is the one that was running — read off a live editor rather than
// remembered, because a rule that is ALMOST right is a rule that fires on the wrong keystroke.
//
// ⚠️ THERE ARE NO PASTE RULES ANY MORE, AND THAT IS A DELETION RATHER THAN AN OMISSION. The
// packages carried a paste rule beside each of these, applying the same grammars to pasted
// text. This editor parses a plain-text paste as MARKDOWN (`editor/plugins.ts`,
// `clipboardTextParser`) through the product's own engine, so `**bold**` arriving on the
// clipboard is already bold before any rule could look at it — and the engine is a better
// reader of it than a regex, because it is the same one the reader's page uses. What the paste
// rules would add is applying those grammars to text pasted as HTML from somewhere else, where
// a literal `**` is far more likely to be two asterisks somebody meant.
import { InputRule, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { Selection, TextSelection, type Transaction } from 'prosemirror-state'
import type { MarkType } from 'prosemirror-model'
import { bareLinkAt } from '@/md/gfm-autolink'
import {
  DISPLAY_BRACKET_SOURCE, DISPLAY_DOLLAR_SOURCE, INLINE_PAREN_SOURCE,
} from '@/md/math-syntax'
import {
  DEFAULT_INK, INKS, INK_SYNTAX_CONTENT_LAST, RING_SYNTAX_CONTENT_LAST,
  UNDER_SYNTAX_CONTENT_LAST, inkOf, isInk,
} from '@/pen/grammar'
import type { Ink } from '@/pen/grammar'
import { schema } from './schema'
import { markRange } from './commands-marks'

const node = (name: string) => schema.nodes[name]!
const mark = (name: string) => schema.marks[name]!

/**
 * A mark applied to what a pair of delimiters wraps, with the delimiters eaten.
 *
 * ⚠️ THE LAST CAPTURE GROUP IS THE CONTENT, which is the convention every regex below follows
 * and the one thing that cannot be read off the pattern itself. `**text**` captures the whole
 * `**text**` and then `text`; `==text==` captures only `text`. Taking the last group is what
 * makes one helper serve both.
 *
 * ⚠️ AND A RULE MUST REFUSE INSIDE A MARK THAT EXCLUDES IT. Typing `**bold**` inside a code
 * span would otherwise apply a mark the schema forbids, and the transaction throws where the
 * writer is typing.
 */
function markInputRule(find: RegExp, type: MarkType, getAttrs?: (m: RegExpMatchArray) => Record<string, unknown> | null): InputRule {
  return new InputRule(find, (state, match, start, end) => {
    // Read BEFORE the default is applied: `?? {}` would turn a deliberate `null` — a rule
    // saying "not this time" — into "no attributes", and fire anyway.
    const asked = getAttrs?.(match)
    if (asked === null) return null
    const attrs = asked ?? {}
    const content = match[match.length - 1]
    const whole = match[0]
    if (!content || !whole) return null
    const lead = whole.search(/\S/)
    const contentStart = start + whole.indexOf(content)
    const contentEnd = contentStart + content.length
    const from = start + lead

    // Anything already on this text that refuses to share it with the new mark: leave the
    // characters alone rather than making a document the schema cannot hold.
    let blocked = false
    state.doc.nodesBetween(start, end, (n, pos) => {
      if (!n.isInline) return true
      if (pos + n.nodeSize <= contentStart) return true
      if (n.marks.some((m) => m.type.excludes(type) && m.type !== type)) blocked = true
      return true
    })
    if (blocked) return null

    const tr = state.tr
    if (contentEnd < end) tr.delete(contentEnd, end)
    if (contentStart > from) tr.delete(from, contentStart)
    tr.addMark(from, from + content.length, type.create(attrs))
    // ⚠️ REMOVED FROM THE STORED MARKS, or the next character typed carries the mark too and
    // the writer is still in bold after closing it.
    tr.removeStoredMark(type)
    return tr
  })
}

/**
 * A formula, from one of the three delimiter pairs.
 *
 * ⚠️ THE WHOLE MATCH IS REPLACED, delimiters and all. A rule that replaced only the capture
 * group left `\\(` and `\\)` standing either side of a perfectly good formula node, and the
 * post saved as `\\(\\(x^2\\)\\)`; with `$$…$$` it was worse, because the block node split
 * the paragraph and the stray dollars became two paragraphs of their own.
 *
 * An EMPTY pair is somebody typing, not a formula: `$$$$` on the way to `$$x$$` leaves the
 * characters alone.
 */
function mathRule(source: string, name: string, display: boolean, delim: string): InputRule {
  return new InputRule(new RegExp(`${source}$`), (state, match, start, end) => {
    const tex = (match[1] ?? '').trim()
    if (!tex) return null
    return afterNode(state.tr.replaceRangeWith(start, end, node(name).create({ tex, display, delim })))
  })
}

/**
 * A caret the writer can keep typing at, after a rule has inserted a BLOCK node.
 *
 * ⚠️ `replaceRangeWith` LEAVES THE NEW NODE SELECTED, and the next character typed therefore
 * replaces it. Measured: typing `---` and then `after` left `ftera` — the rule, and four of the
 * five characters, gone. The same for `$$x$$` and for a picture. It has to move on to a
 * position that can hold a caret, making one after the node when there is nothing there.
 */
function afterNode(tr: Transaction): Transaction {
  const at = tr.selection.to
  const near = Selection.findFrom(tr.doc.resolve(Math.min(at, tr.doc.content.size)), 1, true)
  if (near) return tr.setSelection(near).scrollIntoView()
  // Nothing after it: the trailing paragraph plugin will add one, but not before this
  // transaction lands, so the place to stand is made here.
  const para = node('paragraph').createAndFill()
  if (!para) return tr
  tr.insert(at, para)
  return tr.setSelection(TextSelection.near(tr.doc.resolve(at))).scrollIntoView()
}

/** The colour afterthought: `==word==#pink` typed one piece at a time. */
function suffixRule(type: MarkType, bare: boolean): InputRule {
  return new InputRule(new RegExp(`#(${INKS.join('|')})$`), (state, match, start, end) => {
    const colour = match[1]
    if (!isInk(colour)) return null
    // Only when what is immediately before the `#` already wears this gesture; otherwise
    // `#pink` is a word somebody wrote, and a hashtag has to survive being typed.
    const at = start - 1
    if (at < 0) return null
    const existing = markRange(state.doc.resolve(at), type)
    if (!existing || existing.to !== start) return null
    const tr = state.tr.delete(start, end)
    tr.removeMark(existing.from, existing.to, type)
    // `bare`: for the pencil and the ballpoint an absent suffix means graphite and red, which
    // are not inks — so the attribute holds the colour only when one was asked for.
    tr.addMark(existing.from, existing.to, type.create({ ink: bare ? colour : (colour as Ink) }))
    // ⚠️ AND THE PEN COMES OFF THE PAPER. Without this the stroke is still the stored mark, so
    // everything typed after `==go tay==#pink` keeps being highlighted — the stroke swallows the
    // rest of the sentence. The `addMark` above put the mark back at the caret, which is why
    // clearing it has to come after rather than being left to the rule that laid it.
    tr.removeStoredMark(type)
    return tr
  })
}

/** Every rule, in the order they are consulted. */
export function inputRules(): InputRule[] {
  return [
    // ----- blocks ------------------------------------------------------------------------
    wrappingInputRule(/^\s*>\s$/, node('blockquote')),
    wrappingInputRule(/^\s*([-+*])\s$/, node('bulletList')),
    wrappingInputRule(
      /^(\d+)\.\s$/, node('orderedList'),
      (match) => ({ start: Number(match[1]) }),
      (match, listNode) => listNode.childCount + (listNode.attrs.start as number) === Number(match[1]),
    ),
    // `- [ ] ` INSIDE A BULLET ITEM MAKES A CHECKBOX, which is how GFM writes one and therefore
    // how somebody types it.
    //
    // ⚠️ FOUR THINGS THE FIRST CUT GOT WRONG, all of them measured by typing `- [ ] buy milk`:
    //
    //  · It built the replacement from the document BEFORE deleting the typed `[ ] `, so every
    //    task item was born holding its own syntax as text — `- [ ] \[ ]`.
    //  · It applied the TYPED tick to every item in the list, so three items the writer never
    //    touched silently became ticked checkboxes.
    //  · It accepted an ordered list, which lost the numbering.
    //  · It never put the caret back, so everything typed afterwards landed in a new paragraph
    //    after the list.
    //
    // THE WHOLE LIST CONVERTS, and that is the schema rather than a choice: a `taskItem` cannot
    // live in a `bulletList` and a `listItem` cannot live in a `taskList`. Only the item being
    // typed in takes the tick; the others come across unchecked, which is what opening the same
    // Markdown does.
    new InputRule(/^\s*(\[([( |x])?\])\s$/, (state, match, start, end) => {
      const { $from } = state.selection
      if ($from.depth < 2) return null
      if ($from.node(-1).type !== node('listItem')) return null
      if ($from.node(-2).type !== node('bulletList')) return null
      const listAt = $from.before(-2)
      const here = $from.before(-1)
      const caret = $from.pos

      const tr = state.tr.delete(start, end)
      // ⚠️ READ AFTER THE DELETE, BEFORE THE REPLACEMENT. The replacement is exactly as long as
      // what it replaces, so a position taken now is still valid afterwards — whereas mapping
      // one THROUGH `replaceWith` pins it to the edge of the replaced range, which is how the
      // caret ended up outside the list and everything typed next landed in a new paragraph.
      const from = tr.mapping.map(listAt)
      const caretNow = tr.mapping.map(caret)
      const hereNow = tr.mapping.map(here)
      const list = tr.doc.nodeAt(from)
      if (!list) return null
      const kids: import('prosemirror-model').Node[] = []
      let offset = from + 1
      for (let i = 0; i < list.childCount; i++) {
        const child = list.child(i)
        const mine = offset === hereNow
        kids.push(node('taskItem').create(
          { checked: mine && match[2] === 'x' }, child.content, child.marks,
        ))
        offset += child.nodeSize
      }
      tr.replaceWith(from, from + list.nodeSize, node('taskList').create(null, kids))
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(caretNow, tr.doc.content.size))))
      return tr
    }),
    textblockTypeInputRule(/^```([a-z]+)?[\s\n]$/, node('codeBlock'), (m) => ({ language: m[1] ?? null })),
    textblockTypeInputRule(/^~~~([a-z]+)?[\s\n]$/, node('codeBlock'), (m) => ({ language: m[1] ?? null })),
    textblockTypeInputRule(/^(#{1,6})\s$/, node('heading'), (m) => ({ level: m[1]!.length })),
    new InputRule(/^(?:---|—-|___\s|\*\*\*\s)$/, (state, _match, start, end) =>
      afterNode(state.tr.replaceRangeWith(start, end, node('horizontalRule').create()))),

    // ----- pictures, formulas ------------------------------------------------------------
    new InputRule(/(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/,
      (state, match, start, end) => {
        const whole = match[1]
        if (!whole) return null
        // `start + indexOf` and not `end - whole.length`: `whole` is `match[1]`, which includes
        // the closing `)` that has not been inserted yet, so measuring back from the end lands
        // one character too far left and eats whatever is in front of the picture.
        const from = start + match[0]!.indexOf(whole)
        return afterNode(state.tr.replaceRangeWith(from, end, node('image').create({
          src: match[3], alt: match[2] || null, title: match[4] ?? null,
        })))
      }),
    // ⚠️ THE THREE PATTERNS ARE IMPORTED, not written here. `md/math-syntax.ts` owns them and
    // exports them one at a time precisely so the editor can fire a rule per delimiter, and
    // `$…$` is deliberately not among them — a price typed mid-sentence would otherwise become
    // a formula. The same discipline the pen follows, and for the same reason.
    mathRule(INLINE_PAREN_SOURCE, 'mathInline', false, 'paren'),
    mathRule(DISPLAY_DOLLAR_SOURCE, 'mathBlock', true, 'dollar'),
    mathRule(DISPLAY_BRACKET_SOURCE, 'mathBlock', true, 'bracket'),

    // ----- emphasis ----------------------------------------------------------------------
    markInputRule(/(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/, mark('bold')),
    markInputRule(/(?:^|\s)(__(?!\s+__)((?:[^_]+))__(?!\s+__))$/, mark('bold')),
    markInputRule(/(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/, mark('italic')),
    markInputRule(/(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))$/, mark('italic')),
    markInputRule(/(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/, mark('strike')),
    // ⚠️ `` `x` `` REFUSES A FOURTH BACKTICK before it, so a fence being typed is not turned
    // into an inline code span on its way to becoming a fence.
    new InputRule(/`([^`]+)`(?!`)$/, (state, match, start, end) => {
      const before = start > 0 ? state.doc.textBetween(Math.max(0, start - 1), start) : ''
      if (before === '`') return null
      const content = match[1]
      if (!content) return null
      const tr = state.tr.delete(start, end).insertText(content, start)
      tr.addMark(start, start + content.length, mark('code').create())
      tr.removeStoredMark(mark('code'))
      return tr
    }),

    // ----- the pen ------------------------------------------------------------------------
    markInputRule(new RegExp(`${INK_SYNTAX_CONTENT_LAST}$`), mark('ink'),
      (m) => ({ ink: inkOf(m[0] ?? '') || DEFAULT_INK })),
    suffixRule(mark('ink'), true),
    markInputRule(new RegExp(`${UNDER_SYNTAX_CONTENT_LAST}$`), mark('underline'),
      (m) => ({ ink: suffixOf(m[0] ?? '') ?? '' })),
    suffixRule(mark('underline'), false),
    markInputRule(new RegExp(`${RING_SYNTAX_CONTENT_LAST}$`), mark('ring'),
      (m) => ({ ink: suffixOf(m[0] ?? '') ?? '' })),
    suffixRule(mark('ring'), false),

    // ----- a URL typed as itself ----------------------------------------------------------
    //
    // ⚠️ IT ASKS THE PRODUCT'S OWN MATCHER, which is the whole reason this is short rather than
    // a dependency. `md/gfm-autolink.ts` decides what a bare URL is for the reader's page and
    // for the serializer — including the trailing-punctuation rule, and the `www.` and address
    // forms, where the href differs from the text — and a second opinion here would be a second
    // grammar to keep in step.
    //
    // ⚠️ AND THE TRIGGERING CHARACTER IS NOT IN THE DOCUMENT YET. `prosemirror-inputrules` hands
    // a handler the range of the match that IS in the document; the character just typed is
    // still only in the string that was matched against, and a handler returning a transaction
    // has taken responsibility for it. The first cut forgot, so `https://a.test next` came out
    // as `…testnext` — the space the writer pressed was eaten. It also placed the mark one
    // character to the left, putting the preceding space inside the link and leaving the URL's
    // last character outside it.
    new InputRule(/(\S+)(\s)$/, (state, match, start, end) => {
      const typed = match[1]
      if (!typed) return null
      const hit = bareLinkAt(typed, 0)
      if (!hit || hit.length === 0) return null
      // ⚠️ ONLY WHEN THE LINK WOULD SAVE BACK AS THE CHARACTERS THAT WERE TYPED. `www.a.test`
      // and `a@b.test` are both links to the reader's page — with `http://` and `mailto:`
      // prepended — but a link whose href differs from its label serializes as `[label](href)`,
      // so marking them here would rewrite what the writer typed into something else on the
      // next save. The reader's page linkifies them anyway (`md/gfm-autolink.ts`), so nothing
      // is lost by leaving them as text here; what is avoided is a save that changes the file.
      if (hit.url !== typed.slice(0, hit.length)) return null
      const tr = state.tr
      // The space goes in FIRST, so the positions below still name the URL — and so the space
      // is not swallowed by the mark, which is inclusive.
      tr.insertText(match[2] ?? ' ', end)
      tr.addMark(start, start + hit.length, mark('link').create({ href: hit.url }))
      tr.removeStoredMark(mark('link'))
      return tr
    }),
  ]
}

/** The colour suffix of a line gesture, or undefined. Graphite and red are not inks. */
const suffixOf = (raw: string): Ink | undefined => {
  const m = /#([a-z]+)$/.exec(raw)
  return m && isInk(m[1]) ? m[1] : undefined
}
