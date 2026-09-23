// The reading side's edges: what a page does at the end of short content, at a phone's width,
// and inside the boxes that sit in a column of prose. Each flow is a fault that shipped and was
// found by looking at a screenshot on 2026-09-23, not by any assertion that existed.
import type { Tour } from './tour'

export function registerEdgeFlows({ flow, atWidth }: Tour): void {
  // The rail is as tall as the column; its index was capped only by the viewport, so on a
  // one-post tag page it ran on past the column and the footer sat in the middle of the tags.
  flow('a short listing page keeps its footer below the rail', () => atWidth(1440, '/tag/van-gogh', `(async () => {
    window.scrollTo(0, 1e6)
    await new Promise((r) => setTimeout(r, 300))
    const foot = document.querySelector('footer.site')
    const inner = [...document.querySelectorAll('.rail .rail-inner')].filter((el) => el.offsetParent)
    if (!foot || inner.length === 0) return 'no footer or no rail in the gutter at 1440'
    const top = foot.getBoundingClientRect().top
    const over = inner.map((el) => Math.round(el.getBoundingClientRect().bottom - top)).filter((d) => d > 0)
    return over.length ? 'the rail runs ' + over[0] + 'px past the top of the footer' : 'ok'
  })()`))

  // Beside a floated picture the kind line wrapped three times and the headline began halfway
  // across, then ran back under the picture. A phone lays the card out as two columns.
  flow('a card with a picture keeps one left edge on a phone', () => atWidth(390, '/', `(() => {
    const card = document.querySelector('.post-list article[data-thumb=side]')
    if (!card) return 'no card with a side picture on the front page'
    const thumb = card.querySelector('.card-thumb').getBoundingClientRect()
    const meta = card.querySelector('.card-thumb ~ p').getBoundingClientRect()
    const head = card.querySelector('h2, h3').getBoundingClientRect()
    if (Math.abs(head.left - meta.left) > 1) return 'the headline starts ' + Math.round(head.left - meta.left) + 'px from the kind line'
    if (head.right > thumb.left + 1) return 'the headline runs under the picture'
    return 'ok'
  })()`))

  // A callout is a box, not a continuation of the paragraph above it: with book typography on,
  // its label and first line were indented and the lines after sat flush.
  flow('a callout is never indented as a continuation', () => atWidth(1440, '/the-reed-pen-in-van-goghs-letters', `(() => {
    const ps = [...document.querySelectorAll('.prose .callout p')]
    if (ps.length === 0) return 'no callout on the page'
    const bad = ps.filter((p) => parseFloat(getComputedStyle(p).textIndent) !== 0)
    return bad.length ? bad.length + ' paragraph(s) in a callout indented ' + getComputedStyle(bad[0]).textIndent : 'ok'
  })()`))

  // THE ADMIN'S EDGES, same day, same way found.
  flow('admin: the trash is one column, a row the width of the sheet', () => atWidth(1440, '/admin/trash', `(() => {
    const row = document.querySelector('[data-trash-row], ul > li')
    if (!row) return 'skip: nothing in the trash'
    const list = row.closest('ul')
    const r = row.getBoundingClientRect(), l = list.getBoundingClientRect()
    return r.width < l.width * 0.9 ? 'a row is ' + Math.round(r.width) + 'px of a ' + Math.round(l.width) + 'px list' : 'ok'
  })()`))

  flow('admin: a comment shows its emphasis, not its asterisks', () => atWidth(1440, '/admin/comments', `(() => {
    const bodies = [...document.querySelectorAll('[data-comment] [data-mark].line-clamp-3')]
    if (bodies.length === 0) return 'no comments to read'
    const raw = bodies.filter((b) => /(^|\\s)\\*[^*\\s][^*]*\\*(\\s|$|[.,;:!?])/.test(b.textContent))
    return raw.length ? raw.length + ' comment(s) show raw asterisks: ' + raw[0].textContent.slice(0, 60) : 'ok'
  })()`))

  flow('admin: on a phone the post title is larger than the body text under it', () => atWidth(390, '/admin/editor/five-inks-and-when-to-reach-for-each', `(async () => {
    await new Promise((r) => setTimeout(r, 400))
    const title = document.querySelector('[data-sheet-title]')
    const p = document.querySelector('.ProseMirror p')
    if (!title || !p) return 'no title or no paragraph on the sheet'
    const a = parseFloat(getComputedStyle(title).fontSize), b = parseFloat(getComputedStyle(p).fontSize)
    return a > b * 1.3 ? 'ok' : 'the title is ' + a + 'px over a ' + b + 'px body'
  })()`))

  flow('admin: a page asks for a page title, and says its state once', () => atWidth(1440, '/admin/page-editor', `(() => {
    const title = document.querySelector('[data-sheet-title]')
    if (!title) return 'no title field'
    const meta = document.querySelector('[data-sheet-meta]')?.textContent ?? ''
    const parts = meta.split(' · ')
    if (parts.length !== new Set(parts).size) return 'the meta line repeats itself: ' + meta
    return title.placeholder === document.querySelector('[data-sheet-title]').placeholder && !/post/i.test(title.placeholder) ? 'ok' : 'placeholder reads "' + title.placeholder + '"'
  })()`))
}
