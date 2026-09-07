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

  // Book mode ON A PHONE is a different machine from the desktop spread, and the difference
  // is the one thing a screenshot cannot show: the DOCUMENT scrolls. That is what lets iOS
  // retract its own address bar and toolbar, which on an 844px phone is 190px of glass
  // handed back to the words. A dialog cannot do it — a modal takes the scroll off the page.
  //
  // 375px, because the whole behaviour is behind the 640 breakpoint.
  flow('a phone reads a book by scrolling, and the chrome gets out of the way', () => atWidth(375,
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      scrollTo(0, 700)
      await sleep(200)
      const wasAt = Math.round(scrollY)

      const open = document.querySelector('.book-fab') || document.querySelector('[data-book-open]')
      if (!open) return 'skip: book mode is off'
      open.click()
      await sleep(700)

      const reader = document.querySelector('.book-reader')
      if (!reader) return document.querySelector('.book-overlay') ? 'a phone got the desktop dialog' : 'nothing opened'
      // viewport-fit=cover for the length of the read, and only that: it is what makes iOS
      // report a real safe-area inset and let the paper reach the top of the glass, and it
      // belongs to the reader rather than to the site.
      const meta = document.querySelector('meta[name=viewport]')
      if (!/viewport-fit=cover/.test(meta.content)) return 'the reader did not ask for the full glass'
      if (document.querySelector('.book-overlay')) return 'both readers opened at once'
      // The claim: the page itself is what scrolls. A dialog would leave the document the
      // height of the window and the toolbars where they are.
      if (document.documentElement.scrollHeight <= innerHeight) return 'the document does not scroll, so the toolbars will stay'
      const flow = reader.querySelector('.book-flow')
      if (getComputedStyle(flow).columnCount !== 'auto') return 'the phone reader is still in columns'

      const bar = reader.querySelector('.book-chrome')
      if (!bar) return 'the reader has no chrome'
      const bottom = () => Math.round(bar.getBoundingClientRect().bottom)
      const shown = bottom()
      if (shown <= 0) return 'the chrome is already off screen before anything scrolled'
      scrollTo(0, 900)
      await sleep(400)
      if (bottom() > 0) return 'the chrome stayed put on the way down'
      scrollTo(0, 500)
      await sleep(400)
      if (bottom() !== shown) return 'the chrome did not come back on the way up'

      reader.querySelector('.book-x').click()
      await sleep(700)
      if (document.querySelector('.book-reader')) return 'the reader did not close'
      if (document.documentElement.classList.contains('book-reading')) return 'the page is still hidden after closing'
      if (!document.querySelector('article')) return 'the article did not come back'
      if (/viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content)) {
        return 'the reader kept the page covering the safe area after it closed'
      }
      // Where they were, not the top: the page is display:none while the reader is up, so a
      // restore that does not wait for layout is clamped to 0.
      if (Math.abs(scrollY - wasAt) > 8) return 'closed at ' + Math.round(scrollY) + ', opened from ' + wasAt
      return 'ok (' + shown + 'px of chrome, document scrolls, back at ' + wasAt + ')'
    })()`, 600))

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

      // THE DRAG ITSELF, with pointer events, because that is the half that shipped broken:
      // the first version used native drag-and-drop, a row could be grabbed and would not
      // come, and the list never opened where it would land. Two claims are checked, and the
      // second is the one that was wrong even after the row started moving — the list has to
      // reorder WHILE THE POINTER IS DOWN, and the row has to still be there after it lifts.
      const rows = await wait(() => {
        const found = [...document.querySelectorAll('aside [data-nav-row]')]
        return found.length > 3 ? found : null
      })
      if (!rows) return 'arrange mode drew no rows'
      const carried = rows[0].getAttribute('data-nav-row')
      const at = (el) => {
        const box = el.getBoundingClientRect()
        return { x: Math.round(box.left + 40), y: Math.round(box.top + box.height / 2) }
      }
      const start = at(rows[0])
      const target = at(rows[3])
      // THE PRESS GOES TO THE ROW, EVERYTHING AFTER IT TO THE WINDOW, which is what a
      // browser does: once the list reorders, the pointer is over some other row entirely.
      // Sending the whole gesture to the row it started on would pass against a build that
      // only listens there — the build that shipped, where reordering pulled the node out of
      // the document, took its pointer capture with it, and left the drag dead after one row.
      const send = (type, y, target) => target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse',
        button: 0, buttons: type === 'pointerup' ? 0 : 1,
        clientX: start.x, clientY: y,
      }))
      const listed = () => [...document.querySelectorAll('aside [data-nav-row]')].map((r) => r.getAttribute('data-nav-row'))

      // A FRAME BETWEEN MOVES, which is what a pointer actually delivers: the list can only
      // reorder once per paint, because the next destination is read off the rectangles the
      // last paint left. Firing the whole gesture inside one tick asks it to move six rows
      // through one render and is a test of something no hand does.
      send('pointerdown', start.y, rows[0])
      for (let y = start.y; y <= target.y; y += 8) {
        send('pointermove', y, window)
        await new Promise((r) => setTimeout(r, 24))
      }
      const held = listed()
      if (held.indexOf(carried) < 2) {
        send('pointerup', target.y, window)
        return 'the list did not reorder under the pointer: ' + held.slice(0, 5).join(' ')
      }
      send('pointerup', target.y, window)
      await new Promise((r) => setTimeout(r, 250))
      const landed = listed()
      if (landed.indexOf(carried) !== held.indexOf(carried)) {
        return 'the row sprang back on release: held at ' + held.indexOf(carried) + ', landed at ' + landed.indexOf(carried)
      }

      // The stored order must NAME the row: an empty order also fails "is it still first",
      // and reporting that as a move would hide a build that never saved anything.
      const after = await wait(async () => {
        const now = await stored()
        return now && now.primary.includes(carried) && now.primary[0] !== carried ? now : null
      }, 40, 150)
      if (!after) return 'the server never recorded ' + carried + ' moving off the top'

      // And the steppers, which are the touch and keyboard route to the same thing.
      const up = document.querySelector('aside [data-nav-row] [data-nav-step="down"]')
      if (!up) return 'a row in arrange mode has no way to walk down'
      up.click()
      const walked = await wait(async () => {
        const now = await stored()
        return now && now.primary[0] !== after.primary[0] ? now : null
      }, 40, 150)
      if (!walked) return 'the step buttons moved nothing the server kept'

      // Hiding the wordmark moves search into the column as a row — the one layout rule that
      // depends on the switch rather than on the order.
      const logo = await wait(() => document.querySelector('aside [data-nav-switch="logo"]'))
      if (!logo) return 'arrange mode offers no switch for the wordmark'
      logo.click()
      // Named handles, not shapes. Reading the wordmark's absence off a link to /admin that
      // holds an svg meant "the wordmark" only while the rail drew no glyphs; the Home
      // destination points at the same href, so with icons on by default (2026-09-07) the
      // absence test could never pass and the flow failed on a rail behaving correctly.
      // NOTE: this whole body is a template literal evaluated in the page. No backticks.
      const searchRow = await wait(() =>
        !document.querySelector('aside [data-nav-top]')
        && document.querySelector('aside nav [data-nav-search]'))
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
      return 'ok (' + carried + ' dragged and kept, stepper moved, wordmark switched, order reset)'
    })()`, 900))

  // A DEAD END IS THE PLACE A LINK IS WORTH MOST, and the admin's own miss was the emptiest
  // screen it had: the number 404 in small grey type and one link home. It now carries a
  // drawing, a sentence saying what probably went wrong, the search, and the three pieces
  // touched last — which is the list somebody who mistyped an address most often wanted.
  //
  // NOTE: this body is a template literal. No backticks.
  flow('admin: a miss offers a picture, the search and what was touched last', () => expect('/admin/no-such-screen', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const box = document.querySelector('[data-admin-404]')
      if (!box) return 'the admin router did not report a miss'
      const glyph = box.querySelector('svg')
      if (!glyph) return 'the empty state has no drawing'
      // 96 is the rule; the assertion is loose on purpose, because what would break it is a
      // glyph rendered at icon size, not a pixel of rounding.
      const size = Math.round(glyph.getBoundingClientRect().width)
      if (size < 80) return 'the drawing is ' + size + 'px, which is an icon and not a glyph'
      if (!box.querySelector('button')) return 'no way to search'
      if (!box.querySelector('a[href="/admin"]')) return 'no way home'
      // The recent list arrives with the content view, so it is polled rather than read once.
      let recent = []
      for (let i = 0; i < 40 && recent.length === 0; i++) {
        recent = Array.from(box.querySelectorAll('a[href*="/admin/editor/"], a[href*="/admin/page-editor/"]'))
        if (recent.length === 0) await sleep(150)
      }
      if (recent.length === 0) return 'nothing recently edited was offered'
      if (recent.length > 3) return recent.length + ' pieces offered: a 404 is not the Write screen'
      return 'ok ' + size + 'px glyph, search, home and ' + recent.length + ' recent piece(s)'
    })()`, 900))

  // The other dead end. The sheet beside the write list offered one grey sentence and two
  // buttons that both start something NEW, to a screen most often reached by somebody coming
  // back to something old. 1440 because the sheet only exists beside the pane.
  //
  // NOTE: this body is a template literal. No backticks.
  flow('admin: the empty write sheet offers what was touched last', () => atWidth(1440, '/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const sheet = document.querySelector('[data-write-empty]')
      if (!sheet) return 'the write screen has no empty sheet'
      if (!sheet.offsetParent) return 'the sheet is hidden at 1440, where it is meant to show'
      if (!sheet.querySelector('svg')) return 'the empty sheet has no drawing'
      let recent = []
      for (let i = 0; i < 40 && recent.length === 0; i++) {
        recent = Array.from(sheet.querySelectorAll('a[href*="/admin/editor/"], a[href*="/admin/page-editor/"]'))
        if (recent.length === 0) await sleep(150)
      }
      if (recent.length === 0) return 'nothing recently edited was offered'
      return 'ok a drawing and ' + recent.length + ' recent piece(s) beside the two new-piece buttons'
    })()`, 900))

}
