// WHAT A KEYBOARD AND A SCREEN READER CAN REACH.
//
// Split out of `tour-flows-shell.ts` on 2026-09-21, when a flow grew and put that file over the
// 400-line ceiling. The seam is real rather than arithmetic: everything left there is about how
// the page LOOKS and where its parts sit, and everything here is about whether somebody who
// never touches a mouse can get to them.
//
// It is also where the 2026-09-19 audit's twelve findings belong, and more of them are coming:
// a dialog that cannot hold focus, a list that answers only a click, a control that erases its
// own label. None of those is visible in a screenshot and none of them fails a unit test — the
// markup is correct the whole time, and what is missing is the behaviour it promised.

import type { Tour } from './tour'

export function registerReachFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
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

  // What the drawer SAYS it is, and what it does to the page behind it. Three of these were
  // missing: it was an <aside> a screen reader walked straight past into the article, and
  // the article kept scrolling under a finger that reached the end of the drawer's own
  // scroll. The rail it decorates is the LAST one, which is the two-rail case: there the
  // first `.rail` is display:none below this width, so focus went into a hidden subtree.
  flow('shell: the drawer is a dialog, and the page behind it holds still', () => atWidth(375, '/', `
    (async () => {
      const rails = document.querySelectorAll('.rail')
      const rail = rails[rails.length - 1]
      const button = document.querySelector('[data-rail-toggle]')
      if (!rail || !button) return 'skip: this page has no drawer'
      // ⚠️ AND IT IS NOT ONE UNTIL IT OPENS. These two were stamped on at init until
      // 2026-09-21, and the same element is the ordinary sidebar on a desktop page — so every
      // desktop page announced an open, unnamed modal that the reader could not leave.
      // ⚠️ AND THE NAME GOES WITH THEM since 2026-09-23. It was kept on the closed rail as
      // "Menu", which on an article announced the landmark holding the contents as the menu,
      // and on the newspaper look repeated the masthead's own. The dialog needs a name; the
      // sidebar does not need a wrong one.
      if (rail.getAttribute('role') === 'dialog') return 'closed, and it already claims to be a dialog'
      if (rail.getAttribute('aria-modal')) return 'closed, and it already claims to be modal'
      if (rail.getAttribute('aria-label')) return 'closed, and it already calls itself ' + rail.getAttribute('aria-label')
      if (button.getAttribute('aria-controls') !== rail.id) return 'the button names ' + button.getAttribute('aria-controls')
      button.click()
      await new Promise((r) => setTimeout(r, 350))
      if (rail.getAttribute('role') !== 'dialog') return 'open, and it does not say it is a dialog'
      if (rail.getAttribute('aria-modal') !== 'true') return 'open, and it is not modal'
      if (!rail.getAttribute('aria-label')) return 'open, and the dialog has no name'
      const locked = getComputedStyle(document.body).overflow
      if (locked !== 'hidden') return 'open, and the page behind still scrolls (' + locked + ')'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise((r) => setTimeout(r, 350))
      if (getComputedStyle(document.body).overflow === 'hidden') return 'closed, and the page is still locked'
      if (rail.getAttribute('role') === 'dialog') return 'closed again, and it still claims to be a dialog'
      if (rail.getAttribute('aria-label')) return 'closed again, and it still carries the dialog name'
      return 'ok #' + rail.id + ' is a named dialog only while it is open'
    })()`, 600))
}
