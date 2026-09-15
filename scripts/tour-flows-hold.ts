// WHAT HOLDS STILL WHILE THE WRITING MOVES.
//
// One flow, and it is here rather than in `tour-flows-keep.ts` because that file is about not
// losing WORK and this is about not losing the CHROME — and because the two together were over
// the 400-line rule.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions. Each one is a template literal:
// a backtick in a comment closes it, and a backslash is eaten before the browser sees it.
import type { Tour } from './tour'

export function registerHoldFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * THE BUTTON STRIP STAYS WHERE THE HAND CAN REACH IT.
   *
   * ⚠️ REPORTED FROM OUTSIDE, 2026-09-15, and it had been live: scrolling down a post took the
   * formatting keys off the screen and nothing brought them back. `position: sticky` travels
   * inside the element's own CONTAINING BLOCK, and the strip sat in a wrapper exactly as tall
   * as itself — so it had nowhere to travel and left with the first pixel of scroll. Nothing
   * about the markup looked wrong; the strip says `sticky`, and it was.
   *
   * Measured at 1440 on a 24-paragraph draft: scrolled 1,500px, the strip was at y=-1406 on
   * the build in production and holds at its offset now.
   */
  flow('editor: the button strip stays put when the writing is scrolled', async () => {
    const slug = 'tour-sticky-' + Date.now()
    const line = 'The strip has to stay where the hand can reach it. '
    const planted = await atWidth(1440, '/admin/content', `
    (async () => {
      const para = '${line}'.repeat(14)
      // ⚠️ A DOUBLED BACKSLASH, not a single one. This is a template literal: TypeScript
      // resolves one escape BEFORE the browser sees it, so a single one arrives as a real
      // newline inside a quoted string — an unterminated literal and a bare "threw: Uncaught".
      // The same family as the escaped slash this file's header warns about.
      const body = new Array(24).fill(para).join('\\n\\n')
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a long piece', slug: '${slug}', status: 'draft',
          categories: [], tags: [], content: body,
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1440, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(60) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      // FOUND BY WHAT IT IS — the sticky box holding the Bold key — rather than by a hook, so
      // this asks the question a writer asks rather than the one the markup answers.
      const bar = [...document.querySelectorAll('div')].find((d) =>
        getComputedStyle(d).position === 'sticky' && d.querySelector('button strong'))
      if (!bar) return done('no formatting strip on the sheet')
      const before = Math.round(bar.getBoundingClientRect().y)

      const canvas = document.querySelector('main.admin-canvas')
      const scroller = canvas && canvas.scrollHeight > canvas.clientHeight ? canvas : window
      if (scroller === window) window.scrollTo(0, 1500)
      else scroller.scrollTo(0, 1500)
      await sleep(600)
      const moved = scroller === window ? window.scrollY : scroller.scrollTop
      if (moved < 800) return done('the piece did not scroll, so nothing was tested')

      const box = bar.getBoundingClientRect()
      if (box.y + box.height <= 0) {
        return done('the strip scrolled away: it was at y=' + before + ' and is at y=' + Math.round(box.y))
      }
      return done('ok held at y=' + Math.round(box.y) + ' after ' + moved + 'px of scroll')
    })()`, 1700)
  })
}
