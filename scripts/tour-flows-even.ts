// IS IT EVEN? Measured on the rendered page, not read off the stylesheet.
//
// ⚠️ A GAP THAT IS NEARLY EVEN IS NOT EVEN. A stack of rows where four gaps are 12px and the
// fifth is 13px is a stack somebody will see and not be able to name, and the answer is not "it
// is close" — the deviation has to be zero. That is why this measures rather than reads: a rule
// can be written correctly and still lose to a margin collapsing, to a hidden last child holding
// a gap, to a border adding a pixel, or to a `space-y` parent whose first visible child is not
// its first child.
//
// WHAT IT LOOKS AT, on every admin screen, at the width the admin is actually used at:
//
//   1. Repeated siblings — rows in a list, cards in a column, keys in a strip. Every gap between
//      consecutive VISIBLE siblings must be the same number.
//   2. Controls on one row must share one height, or the row has no baseline.
//   3. Labels in one column must share one left edge.
//
// ⚠️ VISIBLE SIBLINGS ONLY, and `checkVisibility()` rather than `:not([hidden])`. This admin
// ships every state drawn and hides all but one (`docs/admin-one-dom.md`), so a measurement that
// counts hidden elements measures a page nobody sees — and one that counts their gaps reports a
// fault in a stack that is perfectly even on screen.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions. Each one is a template literal:
// a backtick in a comment closes it, and a backslash is eaten before the browser sees it.
import type { Tour } from './tour'

/** Every admin address, and each settings tab, because the tabs are seven different screens. */
const SCREENS = [
  '/admin',
  '/admin/content',
  '/admin/media',
  '/admin/comments',
  '/admin/analytics',
  '/admin/newsletter',
  '/admin/log',
  '/admin/trash',
  '/admin/help',
  '/admin/settings',
  '/admin/settings?tab=home',
  '/admin/settings?tab=appearance',
  '/admin/settings?tab=post',
  '/admin/settings?tab=people',
  '/admin/settings?tab=server',
  '/admin/settings?tab=account',
  // The writing screen and its two panes, which are the admin's other half.
  '/admin/write',
  '/admin/editor',
]

/**
 * The measuring pass, as one expression.
 *
 * It returns a SENTENCE, not a table: the tour prints one line per flow, and a fault nobody can
 * read is a fault nobody fixes. Each finding names the container, the gaps found and how many
 * children were in it, which is enough to open the file and see which stack it is.
 */
const MEASURE = `
  (() => {
    const seen = (el) => el.checkVisibility && el.checkVisibility()
    const box = (el) => el.getBoundingClientRect()
    // Rounded to a TENTH of a pixel, not to a whole one. Rounding to integers hides exactly the
    // half-pixel drift a border on one side of a pair produces, which is the commonest way a
    // stack stops being even.
    const round = (n) => Math.round(n * 10) / 10
    const name = (el) => {
      const hooks = [...el.attributes].filter((a) => a.name.indexOf('data-') === 0 && a.name.indexOf('data-k') !== 0)
      if (hooks.length) return '[' + hooks[0].name + ']'
      const cls = (el.className || '').toString().split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
      return el.tagName.toLowerCase() + (cls ? '.' + cls : '')
    }

    const found = []
    const main = document.querySelector('main') || document.body

    // ---- 1. every stack of repeated siblings ------------------------------------------------
    for (const parent of main.querySelectorAll('*')) {
      if (!seen(parent)) continue
      const kids = [...parent.children].filter(seen)
      if (kids.length < 3) continue
      // A STACK, not a row: only measure vertical gaps where the children really are stacked.
      const boxes = kids.map(box)
      const stacked = boxes.every((b, i) => i === 0 || b.top >= boxes[i - 1].bottom - 0.5)
      if (!stacked) continue
      // And only where the children are the SAME KIND of thing. A heading followed by a list
      // followed by a note is three different relationships and owes no single gap.
      const tags = new Set(kids.map((k) => k.tagName + ':' + (k.className || '')))
      if (tags.size !== 1) continue
      const gaps = boxes.slice(1).map((b, i) => round(b.top - boxes[i].bottom))
      const distinct = [...new Set(gaps)]
      if (distinct.length > 1) {
        found.push('stack ' + name(parent) + ' x' + kids.length + ' gaps ' + distinct.join('/'))
      }
    }

    // ---- 2. controls that share a row must share a height -----------------------------------
    //
    // ⚠️ SHARING A TOP EDGE IS NOT SHARING A ROW. The first cut grouped controls by their top edge
    // and reported every settings screen: the admin is two columns, so a key on the left and a
    // field on the right land on the same y and owe each other nothing. The group has to be a
    // real container — one box, laid out as a row, holding both.
    for (const parent of main.querySelectorAll('*')) {
      if (!seen(parent)) continue
      const display = getComputedStyle(parent).display
      if (display !== 'flex' && display !== 'inline-flex') continue
      if (getComputedStyle(parent).flexDirection.indexOf('column') === 0) continue
      const kids = [...parent.children].filter(seen)
      if (kids.length < 2) continue
      // A control, or a box whose whole content is one control.
      const only = (el) => {
        if (el.matches('button, input, select, textarea')) return el
        const inside = el.querySelectorAll('button, input, select, textarea')
        return inside.length === 1 && seen(inside[0]) ? inside[0] : null
      }
      const controls = kids.map(only).filter(Boolean)
        // A tick, a radio, a slider and a file input are deliberately not key-height, and
        // neither is a colour: the OS picker is an invisible overlay sized to the round swatch
        // it sits on (colourField), so it owes the hex box beside it nothing. 16.8 against 30 on
        // every palette row was this, twenty-three times over, and none of it was wrong.
        .filter((el) => ['checkbox', 'radio', 'range', 'hidden', 'file', 'color'].indexOf(el.type) < 0)
      // ⚠️ NOT "every child is a control". That was the first rule and it made this check almost
      // never fire: nearly every row in the admin is a label beside a control, so the row was
      // skipped and a key planted at 61px beside a 36px key went unreported. The controls in a
      // row owe each other one height whatever else is standing with them.
      if (controls.length < 2) continue
      // ⚠️ ONLY THE ONES THAT ARE DRAWN AS A BOX. A quiet tool is a word with a hover and no
      // edge of its own — the editor's Markdown / Attributes / Focus — and it stands beside the
      // Save key at 32 against 36 by design: both carry symmetric padding at one type size, so
      // the TEXT lines up and only the invisible hit boxes differ. Comparing them reported the
      // action row on every editor address, and a guard that cries wolf gets its complaint
      // dismissed and the next one with it.
      const drawn = controls.filter((el) => {
        const c = getComputedStyle(el)
        const clear = c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'transparent'
        return !clear || parseFloat(c.borderTopWidth) > 0
      })
      if (drawn.length < 2) continue
      const hs = [...new Set(drawn.map((el) => round(box(el).height)))]
      if (hs.length > 1) {
        found.push('row ' + name(parent) + ' x' + drawn.length + ' heights ' + hs.join('/'))
      }
    }

    // ---- 3. a column of labels shares one left edge ------------------------------------------
    //
    // ⚠️ PER CONTAINER, NOT PER CONTAINER NAME. Grouping by a class string put both columns of a
    // two-column screen in one bucket and reported every one of them: 294 and 851 are the left
    // edges of two different columns, and neither is wrong.
    const cards = new Set()
    for (const el of main.querySelectorAll('.setting-row')) {
      if (!seen(el)) continue
      const card = el.closest('[data-card], [data-settings-panel], section')
      if (card) cards.add(card)
    }
    for (const card of cards) {
      const edges = new Set()
      for (const el of card.querySelectorAll('.setting-row')) {
        if (!seen(el) || el.closest('[data-card]') !== card.closest('[data-card]')) continue
        const label = el.querySelector('label, .block, span')
        if (label && seen(label)) edges.add(round(box(label).left))
      }
      if (edges.size > 1) found.push('labels ' + name(card) + ' left ' + [...edges].join('/'))
    }

    return found.length === 0
      ? 'ok (even)'
      : found.length + ' uneven: ' + found.slice(0, 14).join(' | ')
  })()`

/**
 * TWO WIDTHS, because a stack that is even in one column can stop being even in two.
 *
 * 1440 is where the admin is used and 390 is a phone held upright. The band between them is
 * covered by the layout flows in `tour-flows-layout.ts`; what these add is the arithmetic, at
 * the two shapes the markup actually has.
 */
const WIDTHS = [1440, 390] as const

export function registerEvenFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  for (const width of WIDTHS) {
    for (const path of SCREENS) {
      flow('even: ' + path + ' at ' + width, () => atWidth(width, path, MEASURE, 900))
    }
  }
}
