// THE FOUR LOOKS, each by what makes it that look (2026-09-23). The fixture wears the
// source-code dialect, so the other two are worn for the length of one flow: the look is set
// through the app's own settings route, the page is measured at a laptop's size, and the
// fixture's own look is put back whatever happened — in a `finally`, because a flow that fails
// half way must not leave the next forty flows touring a newspaper.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions: each is a template literal.
import type { Tour } from './tour'

/** One PUT of the look through the app's own settings route, from a page the owner is on. */
const wear = (look: string): string => `(async () => {
  const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look: ${JSON.stringify(look)} }) })
  return r.ok ? 'ok' : 'the settings route refused the look: ' + r.status
})()`

/**
 * Wear `look`, measure `path` at 1440 with `probe`, and put the fixture's look back.
 *
 * Three navigations rather than a frame: the site refuses to be framed (frame-ancestors), which
 * is right and is not something a tour gets to turn off. The restore is in a `finally`.
 */
async function wearing(t: Pick<Tour, 'expect' | 'atWidth'>, look: string, path: string, probe: string): Promise<string> {
  const set = await t.expect('/admin', wear(look))
  if (set !== 'ok') return set
  try {
    return await t.atWidth(1440, path, `(() => {
      for (const el of document.querySelectorAll('*')) for (const a of el.getAnimations()) a.finish()
      return (${probe})()
    })()`)
  } finally {
    await t.expect('/admin', wear('code'))
  }
}

export function registerLookFlows({ flow, expect, atWidth }: Tour): void {
  // The headline speaks the chrome's monospace; the paragraph under it stays in the book face.
  flow('the source-code look sets headlines in its monospace and leaves the text a book', () =>
    atWidth(1440, '/a-type-scale-you-can-defend', `(() => {
    const face = (el) => getComputedStyle(el).fontFamily
    const h1 = document.querySelector('article > header h1')
    const h2 = document.querySelector('.prose h2')
    const p = document.querySelector('.prose > p')
    const mono = face(document.body)
    if (!h1 || !h2 || !p) return 'no headline, section head or paragraph on the piece'
    if (face(h1) !== mono) return 'the headline is in ' + face(h1) + ', not the chrome face'
    if (face(h2) !== mono) return 'a section head is in ' + face(h2)
    if (face(p) === mono) return 'the running text went monospace'
    if (getComputedStyle(h1).fontWeight !== '700') return 'the headline weighs ' + getComputedStyle(h1).fontWeight
    return 'ok'
  })()`))

  // The newspaper: the menu is in the masthead, not in the middle of the story, and the story
  // starts on the first screen. Inline, the menu block put the first line at y=980 of 1000.
  flow('the newspaper puts its menu in the masthead and the story on the first screen', () =>
    wearing({ expect, atWidth }, 'paper', '/a-type-scale-you-can-defend', `() => {
      const doc = document
      const menu = doc.querySelector('header.site .site-menu')
      if (!menu || !menu.checkVisibility()) return 'no section menu in the masthead'
      const inline = doc.querySelector('article .rail-inner > nav:not(.toc)')
      if (inline && inline.checkVisibility()) return 'the menu is still printed inside the piece'
      const first = doc.querySelector('.prose > p').getBoundingClientRect().top
      if (first > 750) return 'the first line of the story sits at y=' + Math.round(first)
      const series = doc.querySelector('aside.series')
      if (series && series.getBoundingClientRect().top < doc.querySelector('.prose').getBoundingClientRect().top)
        return 'the series box is still above the story'
      return 'ok first line at y=' + Math.round(first)
    }`))

  // The notebook: dotted paper on the sheet, and the quiet ink really quiet. The ink was a
  // custom property that named itself, which is a cycle: it went invalid and every date and
  // rail link printed in the full text colour for nine days, with every static test green.
  flow('the notebook prints dot grid, and its quiet ink is not the text ink', () =>
    wearing({ expect, atWidth }, 'notes', '/a-type-scale-you-can-defend', `() => {
      const doc = document
      const cs = (el) => getComputedStyle(el)
      const sheet = doc.querySelector('main > article')
      if (cs(sheet).backgroundImage.indexOf('radial-gradient') < 0) return 'the sheet carries no dot grid'
      if (!cs(doc.body).getPropertyValue('--c-meta').trim()) return '--c-meta is invalid under the body'
      const link = doc.querySelector('.rail .rail-row')
      const text = cs(doc.querySelector('.prose > p')).color
      if (cs(link).color === text) return 'a rail link prints in the text ink ' + text
      const para = doc.querySelector('.prose > p')
      if (cs(para).textAlign === 'justify') return 'the notebook is justified'
      return 'ok'
    }`))

  // The picker draws the four, and a click presses one without saving anything.
  flow('admin: the looks are four drawn tiles, and a click presses one', () =>
    expect('/admin/settings?tab=appearance', `(() => {
    const track = document.querySelector('[data-choice-track][data-k=look]')
    if (!track) return 'no look picker on the appearance tab'
    const tiles = [...track.querySelectorAll('[data-choice]')]
    if (tiles.length !== 4) return tiles.length + ' tiles'
    if (tiles.some((b) => !b.querySelector('svg'))) return 'a tile has no drawing'
    if (tiles.some((b) => b.querySelectorAll('span').length < 2)) return 'a tile has no line saying who it is for'
    const was = tiles.find((b) => b.getAttribute('aria-pressed') === 'true')
    const other = tiles.find((b) => b.getAttribute('aria-pressed') === 'false')
    other.click()
    const pressed = other.getAttribute('aria-pressed') === 'true'
    const one = track.querySelectorAll('[aria-pressed=true]').length === 1
    // And back, so the tab is left with nothing to save and the next address is not asked
    // whether to leave.
    was.click()
    if (!pressed) return 'the click did not press the tile'
    if (!one) return 'two tiles pressed at once'
    return 'ok'
  })()`))
}
