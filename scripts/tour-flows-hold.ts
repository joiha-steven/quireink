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

  /**
   * A WIDE TABLE PANS INSIDE ITS OWN BOX, AND THE WRITING STAYS WHERE IT WAS PUT.
   *
   * ⚠️ FOUND BY AUDIT, 2026-09-15, and it had been live since the editor left Tiptap. A table
   * wider than the sheet has to scroll sideways on its own — `admin.css` says so and says why:
   * panning the WRITING surface moves every paragraph away from the caret that is still in one
   * of them. The rule keys on `.tableWrapper`, which is put there by `prosemirror-tables`' own
   * table node view — and that view was not mounted, so the rule applied to nothing.
   *
   * Nothing could see it. The document was identical, the save was identical, and no test in
   * this repository measures horizontal overflow of the writing surface. This one does.
   */
  flow('editor: a wide table scrolls itself, not the whole sheet', async () => {
    const slug = 'tour-wide-table-' + Date.now()
    const planted = await atWidth(1280, '/admin/content', `
    (async () => {
      // Twelve columns at 1280: wider than the sheet whatever the sheet is doing.
      const head = '| ' + new Array(12).fill(0).map((_, i) => 'column heading ' + i).join(' | ') + ' |'
      const rule = '| ' + new Array(12).fill('---').join(' | ') + ' |'
      const row = '| ' + new Array(12).fill('a fairly long cell value').join(' | ') + ' |'
      // ⚠️ A PARAGRAPH BEFORE THE TABLE, and it is the whole of what this flow measures against.
      // Without it the only paragraph in the piece is one INSIDE a cell, which moves with the
      // table by definition — the flow then fails against a perfectly good editor, which is
      // what it did on its first run.
      // A blank line before the table, single newlines INSIDE it: joining every line with a
      // blank one turns the pipe rows into four paragraphs and there is no table at all.
      const body = 'A line of writing above the table.\\n\\n' + [head, rule, row, row].join('\\n')
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a wide table', slug: '${slug}', status: 'draft',
          categories: [], tags: [], content: body,
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1280, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      for (let i = 0; i < 140 && !document.querySelector('.ProseMirror table'); i++) await sleep(60)
      const table = document.querySelector('.ProseMirror table')
      if (!table) return done('the table never arrived in the writing surface')

      // The BOX the rule keys on. Found by what it is — the scroller the table sits in —
      // rather than by its class, so a rename of the class fails this flow honestly.
      const wrap = table.parentElement
      if (!wrap) return done('the table has no box of its own')
      // ⚠️ A BOX OF ITS OWN, not the writing surface. Without the table node view the table sits
      // directly in the editing host, which is also wider than the sheet — so the scroll check
      // below would pass while there was nothing to contain the pan. Naming it here is what
      // makes the failure say which thing is missing.
      // NOT isContentEditable, which is INHERITED: the wrapper lives inside the editing host,
      // so it answers true either way and the check passed on a broken editor and a fixed one
      // alike. The question is whether the table has a box that is not the host itself.
      if (wrap === document.querySelector('.ProseMirror')) {
        return done('the table sits directly in the writing surface: no box to pan inside')
      }
      const canScroll = wrap.scrollWidth > wrap.clientWidth + 2
      if (!canScroll) return done('the table box does not scroll: ' + wrap.scrollWidth + ' in ' + wrap.clientWidth)

      // THE WRITING MUST NOT MOVE WITH IT. A paragraph's left edge before and after the table
      // is panned to its end: the same pixel, or the caret has walked off the screen.
      //
      // The paragraph OUTSIDE the table: a bare .ProseMirror p finds a cell's paragraph first
      // in a piece that opens with a table, and a cell's paragraph is supposed to move.
      const para = [...document.querySelectorAll('.ProseMirror > p')][0]
      const before = para ? Math.round(para.getBoundingClientRect().left) : null
      wrap.scrollLeft = wrap.scrollWidth
      await sleep(200)
      const after = para ? Math.round(para.getBoundingClientRect().left) : null
      if (before !== null && before !== after) {
        return done('the writing moved with the table: left was ' + before + ', now ' + after)
      }
      const moved = wrap.scrollLeft
      if (moved < 40) return done('the table did not actually pan, so nothing was tested')
      return done('ok table panned ' + moved + 'px, the writing held at x=' + after)
    })()`, 1700)
  })
}
