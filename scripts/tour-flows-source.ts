// THE MARKDOWN SOURCE VIEW'S HEIGHT, which is the one thing about that view no unit test can
// see: it is a `scrollHeight` against a `clientHeight` in a laid-out browser, and happy-dom
// reports both as 0.
//
// Its own file because `tour-flows-sheet.ts` is at 379 lines of a 400-line rule, and because
// the seam is honest: that file drives the furniture AROUND the paper, this one drives the
// other view of the document.
import type { Tour } from './tour'

export function registerSourceFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * A LONG PIECE FITS IN THE MARKDOWN VIEW, AND KEEPS FITTING AS IT GROWS.
   *
   * The textarea is `overflow-hidden` on purpose — the header of `editor-source.ts` explains
   * that a box scrolling internally would drift from the mirror drawn behind it — so the box
   * MUST be exactly as tall as its text or the rest of the text is not merely out of sight, it
   * is unreachable. There is no scrollbar to find it with.
   *
   * Until 2026-09-21 the height was set in exactly one place, `reveal()` in `sheet-raw.ts`, on
   * the way into the view. Nothing re-measured it afterwards. So a writer who pasted a
   * four-thousand-word draft into the Markdown view saw a stub: the text was there, it saved
   * correctly, switching to the writing showed all of it, and the Markdown view showed the
   * first screen and no way to reach the rest. Typing at the end walked your own caret out of
   * the visible box.
   *
   * ⚠️ THE SECOND HALF IS THE REAL GUARD. Opening the view on a long piece was always going to
   * pass — `reveal()` measured once and once was enough for that. The fault only appears on the
   * change AFTER the box is already on screen, so the flow appends text through a real `input`
   * event, which is the same path a paste takes, and measures again.
   */
  flow('editor: the Markdown view is as tall as its text, and stays that way', async () => {
    const slug = 'tour-md-tall-' + Date.now()
    // A few thousand words, planted through the API: the point is a piece far taller than any
    // screen, so a box that stopped growing is unmistakable rather than a few pixels out.
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const para = (n) => 'Paragraph ' + n + '. ' + 'The compiler reads every token and decides what the program will mean tomorrow. '.repeat(6)
      const body = Array.from({ length: 120 }, (_, i) => para(i)).join('\\n\\n')
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a long draft', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: body,
        }),
      })
      return res.ok ? 'ok' : 'could not plant a long post'
    })()`, 900)
    if (made !== 'ok') return made

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      const pm = await wait(() => document.querySelector('.ProseMirror'), 140)
      if (!pm) return done('the editor never opened')

      const sheet = document.querySelector('.admin-enter') || document.body
      const seen = (el) => el && el.offsetParent !== null
      const key = [...sheet.querySelectorAll('button')].filter(seen).find((b) =>
        /markdown/i.test((b.getAttribute('title') || '') + (b.getAttribute('aria-label') || '') + b.textContent))
      if (!key) return done('no key for the Markdown view')
      key.click()

      const box = await wait(() => document.querySelector('textarea.md-source'), 80)
      if (!box) return done('the Markdown view did not open')
      await sleep(120)
      if (box.value.length < 8000) return done('the source opened with only ' + box.value.length + ' characters')

      // CLIPPED is the word: with overflow hidden there is no scrollbar, so anything past the
      // bottom edge cannot be reached by any means the writer has.
      const clipped = () => box.scrollHeight - box.clientHeight
      if (clipped() > 1) return done('on open, ' + clipped() + 'px of the piece is unreachable below the box')

      // THE PASTE. Appending to the value and dispatching an input event is the same path a
      // real paste takes through the listener, and it is the moment the old code did nothing.
      const before = box.clientHeight
      const added = ('\\n\\n' + 'An appended paragraph that has to fit as well. '.repeat(40)).repeat(12)
      const t0 = performance.now()
      box.value = box.value + added
      box.dispatchEvent(new InputEvent('input', { bubbles: true }))
      const cost = performance.now() - t0
      await sleep(60)

      if (clipped() > 1) return done('after a paste, ' + clipped() + 'px of the piece is unreachable below the box')
      if (box.clientHeight <= before) return done('the box did not grow for the pasted text')
      return done('ok ' + box.value.length + ' chars, box ' + box.clientHeight + 'px, nothing clipped, '
        + Math.round(cost * 10) / 10 + 'ms for the keystroke')
    })()`, 2000)
  })
}
