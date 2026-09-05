// The public shell on a phone, the page a reader gets for a URL that is not here, and the
// admin rail's own arrange mode.
//
// The first two are here because neither fault they guard shows at the tour's own width. The
// drawer is a drawer only under the rail breakpoint, and a 404 looks like any other empty
// listing at a glance — so both regressions were live for weeks with every other guard green.
import type { Tour } from './tour'

export function registerShellFlows({ flow, expect, atWidth }: Tour): void {

  // A drawer slid off-screen used to stay in the document: 44 links in the Tab order on a
  // listing page, none of them visible. Closed means out of the tab order; open means the
  // first link takes focus; Escape hands focus back to the button that opened it. All three
  // are read from the live page rather than from the class list, because the class was
  // always right and the page was still wrong.
  flow('shell: the phone drawer leaves the tab order when it closes', () => atWidth(375, '/', `
    (async () => {
      const rail = document.querySelector('.rail')
      const button = document.querySelector('[data-rail-toggle]')
      if (!rail || !button) return 'skip: this page has no drawer'
      if (getComputedStyle(rail).visibility !== 'hidden') return 'closed, and still visible to the tab order'
      button.click()
      await new Promise((r) => setTimeout(r, 350))
      if (getComputedStyle(rail).visibility !== 'visible') return 'opened, and still hidden'
      if (!rail.contains(document.activeElement)) return 'opened, and focus stayed outside it'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise((r) => setTimeout(r, 350))
      if (getComputedStyle(rail).visibility !== 'hidden') return 'Escape did not close it'
      if (document.activeElement !== button) return 'closed, and focus went to ' + document.activeElement.tagName
      return 'ok ' + rail.querySelectorAll('a').length + ' link(s) behind one button'
    })()`, 600))

  // The contents list's last row, at the width where it was wrong. Above the rail
  // breakpoint the taxonomy under the article is hidden and the gutter panel holds those
  // facts, so the row has to aim there instead; the server cannot know the width, so an
  // island decides and this is the only thing that proves it decided. Watched red against
  // the shipped build, where the row still pointed under the article and the jump landed
  // on "Read next" with no tag on screen.
  flow('shell: the contents list ends where the tags actually are',
    // The same fixture post the gesture flows use, and at the tour's own 1440 — which is
    // above the rail breakpoint, where the bug lived.
    () => expect('/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const row = document.querySelector('.toc a.toc-end')
      if (!row) return 'skip: this post has no contents list'
      const panel = document.querySelector('.post-info')
      if (!panel || getComputedStyle(panel).display === 'none') return 'skip: no gutter at this width'
      const id = row.getAttribute('href').slice(1)
      const target = document.getElementById(id)
      if (!target) return 'the last row points at #' + id + ', which is not on the page'
      // Honest only if the copy it lands on is the one being SHOWN.
      if (!panel.contains(target)) return 'at gutter width the row still aims under the article'
      row.click()
      await new Promise((r) => setTimeout(r, 700))
      const box = panel.getBoundingClientRect()
      if (box.bottom < 0 || box.top > innerHeight) return 'it jumped somewhere the panel is not'
      return 'ok #' + id + ', panel on screen'
    })()`, 900))

  // A miss offered one link home and nothing else. It now carries the search box and the
  // three newest posts, and it has to still BE a 404 — the status is the first check,
  // because a page that helps but answers 200 would be indexed as content.
  flow('shell: a missing page offers the search box and the newest posts', () => expect('/no-such-page-' + Date.now(), `
    (async () => {
      const r = await fetch(location.pathname)
      if (r.status !== 404) return 'answered ' + r.status + ', not 404'
      const form = document.querySelector('form.search input[name=q]')
      if (!form) return 'no search box'
      const latest = document.querySelectorAll('.related li a[href^="/"]').length
      if (latest < 1) return 'no newest posts listed'
      if (latest > 3) return latest + ' posts listed: a 404 is not a second home page'
      if (!document.querySelector('a[href="/"]')) return 'no way home'
      return 'ok search box, ' + latest + ' newest post(s), and a way home'
    })()`))

  // Arrange mode, driven the way a hand drives it — and the assertion is on the SERVER's copy.
  //
  // The rail redrawing itself proves nothing here: the whole point of this feature is that the
  // arrangement is a site setting, so it survives a reload on another machine. A flow that
  // only read the DOM would pass against a build that never sent the PUT at all.
  //
  // The controls are found by `data-*`, never by their words: every label in this rail is
  // translated eleven ways, and the seeded instance answers in whichever language its settings
  // carry.
  flow('admin: the sidebar can be rearranged, and the order reaches the server', () => expect('/admin', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      const stored = async () => (await (await fetch('/api/admin/view/shell')).json())?.data?.navOrder
      const before = await stored()
      if (!before) return 'the shell view carries no navOrder'

      const enter = await wait(() => document.querySelector('aside [data-nav-arrange="off"]'))
      if (!enter) return 'the rail offers no way into arrange mode'
      enter.click()

      // The FIRST row's step-down. Whatever is at the top of the rail, it should not be after.
      const first = await wait(() => document.querySelector('aside [data-nav-row]'))
      if (!first) return 'arrange mode drew no rows'
      const moved = first.getAttribute('data-nav-row')
      const down = first.querySelector('[data-nav-step="down"]')
      if (!down) return 'a row in arrange mode has no way to walk down'
      down.click()

      // The stored order must NAME the row: an empty order also fails "is it still first",
      // and reporting that as a move would hide a build that never saved anything.
      const after = await wait(async () => {
        const now = await stored()
        return now && now.primary.includes(moved) && now.primary[0] !== moved ? now : null
      }, 40, 150)
      if (!after) return 'the server never recorded ' + moved + ' moving off the top'
      if (after.primary.indexOf(moved) !== 1) return moved + ' landed at ' + after.primary.indexOf(moved) + ', not 1'

      // Hiding the wordmark moves search into the column as a row — the one layout rule that
      // depends on the switch rather than on the order.
      const logo = await wait(() => document.querySelector('aside [data-nav-switch="logo"]'))
      if (!logo) return 'arrange mode offers no switch for the wordmark'
      logo.click()
      const searchRow = await wait(() => document.querySelector('aside nav button svg') && !document.querySelector('aside a[href="/admin"] svg'))
      if (!searchRow) return 'the wordmark went but the top row is still drawn'

      // Put everything back: a tour that leaves the rail rearranged changes what the next run
      // is looking at, and the reset control is itself worth pressing.
      document.querySelector('aside [data-nav-switch="logo"]').click()
      await new Promise((r) => setTimeout(r, 200))
      const reset = document.querySelector('aside [data-nav-reset]')
      if (!reset) return 'arrange mode offers no way back to the shipped order'
      reset.click()
      const back = await wait(async () => {
        const now = await stored()
        return now && now.primary.length === 0 && now.hidden.length === 0 ? now : null
      }, 40, 150)
      if (!back) return 'reset did not clear the stored order'
      document.querySelector('aside [data-nav-arrange="on"]').click()
      return 'ok (' + moved + ' moved, wordmark switched, order reset)'
    })()`, 900))
}
