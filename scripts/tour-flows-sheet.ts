// The writing sheet's CHROME: the button strip over the paper, and the attributes panel
// beside it. Both faults below are about a thing MOVING under the hand that is using it, and
// a moving layout is exactly what no unit test and no screenshot can catch.
//
// Its own file because `tour-flows-editor.ts` and `tour-flows-admin.ts` are both within a
// dozen lines of the 400-line rule, and because the seam is real: that file drives the FORM
// — the title, the save, the recovery copy — and these two drive the furniture around it.
import type { Tour } from './tour'

export function registerSheetFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * A FORMULA CAN BE CORRECTED, which is the half of "maths in the editor" that a unit test
   * cannot reach.
   *
   * The node renders its TeX rather than showing it, so the only way back to the source is to
   * SELECT the node — and a node view that swallows its own pointer events is a formula that
   * can be read and never edited. That is what happened the day the three node views became
   * plain ProseMirror (2026-09-15): `stopEvent` returned true for everything, the click that
   * selects an atom never reached ProseMirror, and the editing box never opened. Every unit
   * test passed, because a node's attributes, its serializer and its input rules are all
   * reachable without a pointer.
   */
  flow('editor: a formula opens for correction when you click it', async () => {
    const slug = 'tour-math-' + Date.now()
    // Planted through the API in its own visit, because opening a piece is a real navigation
    // since the write column became server-rendered HTML (ADR 0054).
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a formula', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'Before.\\n\\n$$a^2 + b^2 = c^2$$\\n\\nAfter.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post with a formula'
    })()`, 900)
    if (made !== 'ok') return made

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      let pm = null
      for (let i = 0; i < 120 && !pm; i++) { pm = document.querySelector('.ProseMirror'); if (!pm) await sleep(50) }
      if (!pm) return done('the editor never opened')
      let set = null
      for (let i = 0; i < 80 && !set; i++) { set = pm.querySelector('math'); if (!set) await sleep(50) }
      if (!set) return done('the formula was not SET, only stored')

      // Clicked the way a pointer does: on the drawing, with coordinates. A bare synthetic
      // event on the wrapper is not the same question and passes against a broken build.
      const box = set.getBoundingClientRect()
      const where = {
        bubbles: true, cancelable: true, button: 0,
        clientX: Math.round(box.left + box.width / 2),
        clientY: Math.round(box.top + box.height / 2),
      }
      for (const kind of ['mousedown', 'mouseup', 'click']) set.dispatchEvent(new MouseEvent(kind, where))
      await sleep(400)

      const field = [...pm.querySelectorAll('input')].find((i) => i.offsetParent !== null)
      if (!field) return done('clicking the formula did not open a box to correct it in')
      if (!field.value.includes('a^2')) return done('the box opened holding ' + JSON.stringify(field.value))
      if (document.activeElement !== field) return done('the box opened without the caret in it')
      return done('ok (set, clicked, and the TeX came back: ' + field.value + ')')
    })()`, 1500)
  })

  // THE TOOLBAR HOLDS STILL. It is centred over the writing, so anything joining the run
  // moves every button already in it: putting the caret in a table added five and slid the
  // row 62.5px to the left, measured at 1440 on 2026-09-12, and taking the caret out slid it
  // back. The button a hand was travelling towards was somewhere else by the time it arrived.
  // The table's tools have their own line now. NOTE: a template literal. No backticks.
  //
  // A BLANK SHEET on purpose: a piece with no row has no server autosave (there is nothing to
  // hang a snapshot on), so this flow can insert a table and leave nothing behind.
  flow('editor: the toolbar holds still when the caret enters a table', () => atWidth(1440, '/admin/editor', `
    (async () => {
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await new Promise((r) => setTimeout(r, 100)) }
        return null
      }
      const button = (test) => [...document.querySelectorAll('button')].find(test)
      const bold = await wait(() => button((b) => (b.textContent || '').trim() === 'B'))
      if (!bold) return 'no toolbar over the paper'
      const before = bold.getBoundingClientRect().x
      const table = button((b) => /^Table/.test(b.getAttribute('aria-label') || ''))
      if (!table) return 'skip: this build offers no table button'

      table.click()
      const grew = await wait(() => document.querySelectorAll('button').length > 0
        && button((b) => (b.textContent || '').trim() === 'C+') ? true : null, 30)
      if (!grew) return 'the table tools never arrived'
      const after = bold.getBoundingClientRect().x
      const slid = Math.abs(after - before)
      if (slid > 0.5) return 'the toolbar slid ' + slid.toFixed(1) + 'px when the caret entered a table'

      // And the tools it brought stand on the sheet's own left edge, under the row above.
      const cplus = button((b) => (b.textContent || '').trim() === 'C+')
      const strip = cplus.closest('div').parentElement
      const pad = parseFloat(getComputedStyle(strip).paddingLeft)
      const edge = strip.getBoundingClientRect().x + pad
      const off = Math.abs(cplus.getBoundingClientRect().x - edge)
      if (off > 1) return 'the table tools start ' + off.toFixed(1) + 'px off the sheet edge'
      return 'ok bold held at ' + before.toFixed(1) + ', the table tools ranged left'
    })()`, 1200))

  // THE ATTRIBUTES SHEET STANDS BESIDE THE WRITING, above the width where there is room for
  // both. It used to lie on top of it at every width: measured on 2026-09-12 it hid 232px of
  // the writing column at 1280 (34.5% of every line), 104px at 1440 and 200px at 1920, with
  // 348px of empty paper standing beside the text at that last one. The publish step is the
  // exception and keeps its sheet on top, which is what that step is.
  flow('editor: the attributes stand beside the writing, not on it', () => atWidth(1440,
    '/admin/editor/ligatures-and-the-three-you-can-turn-off', `
    (async () => {
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await new Promise((r) => setTimeout(r, 100)) }
        return null
      }
      const paper = await wait(() => document.querySelector('.ProseMirror'))
      if (!paper) return 'the editor never mounted'
      const open = document.querySelector('[data-attrs]')
      if (!open) return 'no way to open the attributes'
      open.click()

      const panel = await wait(() => document.querySelector('aside[role=dialog]'))
      if (!panel) return 'the attributes never opened'
      await new Promise((r) => setTimeout(r, 500))
      // Re-read the paper: the sheet remounts around it when the canvas makes room.
      const column = document.querySelector('.ProseMirror').getBoundingClientRect()
      const sheet = panel.getBoundingClientRect()
      const covered = column.right - sheet.x
      if (covered > 0) return 'the sheet covers ' + Math.round(covered) + 'px of the writing column'
      if (Math.round(column.width) < 600) return 'the column narrowed to ' + Math.round(column.width) + 'px to make room'
      // A sheet standing beside the page must not claim the page has gone.
      if (panel.getAttribute('aria-modal') === 'true') return 'the docked sheet still calls itself modal'
      return 'ok ' + Math.round(-covered) + 'px of paper between the words and the sheet'
    })()`, 1200))

  // FIND AND REPLACE, end to end on a real document. Three things are being watched, and only
  // one of them is "does it find anything": that the highlight is DRAWN rather than applied
  // (the editor's hard contract is that a save may not change the reader's page, and a find
  // box that reaches for a mark instead of a decoration serialises its own highlighter into
  // the piece), that Replace all reaches every hit including one wearing formatting, and that
  // the strip's own chord takes the key back from the browser.
  //
  // A BLANK SHEET, typed into: a piece with no row has no server autosave to leave behind.
  // NOTE: a template literal. No backticks.
  flow('editor: find and replace, and the highlight never reaches the text', () => atWidth(1440, '/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await sleep(100) }
        return null
      }
      // A POST OF ITS OWN, made and removed here. Typing into the blank sheet was tried and
      // is not deterministic in a full run: an earlier flow leaves a local recovery copy on
      // this device, so a blank /admin/editor can open holding somebody else's sentence and
      // the insert lands after it. The count then depends on what ran before, which is the
      // one thing a flow may never depend on. NOTE: a template literal. No backticks.
      const slug = 'tour-find-' + Date.now()
      const made = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour find', slug, content: 'a reed pen, and the reed it was cut from', status: 'draft', categories: [], tags: [] }),
      })
      const done = async (verdict) => { await fetch('/api/posts/' + slug, { method: 'DELETE' }); return verdict }
      if (!made.ok) return 'POST /api/posts -> ' + made.status
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      const surface = await wait(() => {
        const el = document.querySelector('.ProseMirror')
        return el && el.textContent.includes('reed') ? el : null
      })
      if (!surface) return await done('the post never opened in the editor')

      // The chord, taken from the browser.
      // Mod-Shift-f: the strip WITH its replace field. Plain Mod-f opens the find row alone.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', metaKey: true, shiftKey: true, bubbles: true }))
      const bar = await wait(() => document.querySelector('[data-find-bar]'), 20)
      if (!bar) return await done('Mod-f raised no find strip')

      const type = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const fields = bar.querySelectorAll('input')
      type(fields[0], 'reed')
      await sleep(400)
      const drawn = document.querySelectorAll('.ProseMirror .find-hit').length
      if (drawn !== 2) return await done('two hits should be drawn, found ' + drawn)
      if (!document.querySelector('.ProseMirror .find-hit-now')) return await done('no current hit is marked')
      // DRAWN, not applied: the words themselves are untouched.
      if (surface.textContent !== 'a reed pen, and the reed it was cut from') {
        return await done('the highlight changed the text: ' + surface.textContent)
      }

      type(fields[1], 'quill')
      await sleep(200)
      const all = [...bar.querySelectorAll('button')].find((b) => /all/i.test(b.textContent || ''))
      if (!all) return await done('no Replace all key')
      all.click()
      await sleep(400)
      if (surface.textContent !== 'a quill pen, and the quill it was cut from') {
        return await done('Replace all left: ' + surface.textContent)
      }
      if (document.querySelectorAll('.ProseMirror .find-hit').length !== 0) {
        return await done('the old hits are still highlighted after replacing them')
      }

      // Escape puts the strip away and takes its highlight with it.
      fields[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(300)
      if (document.querySelector('[data-find-bar]')) return await done('Escape did not close the strip')
      return await done('ok two found, two replaced, nothing drawn on the text')
    })()`, 1200))

  // ⚠️ THE KEYBOARD STAYS IN THE FIELD. Every field in this sheet threw focus away after a
  // single keystroke: type one digit into the publish time and the caret was gone, so setting
  // 14:30 took four clicks for four digits. The cause was a focus effect keyed on `onClose`,
  // which all three editors pass as an inline arrow — a new function on every render, so every
  // keystroke tore the effect down and set it up again, and setting up focuses the panel.
  //
  // A BROWSER FLOW and not only a mount test, because that is what the bug taught: the mount
  // test that now covers the mechanism did not exist, and nothing else in 3,357 tests could
  // see a caret. Two fields, because the failure was in neither of them: a plain text box and
  // the time inside the date picker, which is where it was found.
  //
  // A POST OF ITS OWN, made and removed here, for the reason the find flow states: typing into
  // the blank editor leaves a local recovery copy on this device and the next flow opens
  // holding it. NOTE: a template literal. No backticks.
  flow('editor: the attributes sheet keeps the keyboard in the field being typed in', () => atWidth(1280, '/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await sleep(100) }
        return null
      }
      const slug = 'tour-focus-' + Date.now()
      const made = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour focus', slug, content: 'one line', status: 'draft', categories: [], tags: [] }),
      })
      const done = async (verdict) => { await fetch('/api/posts/' + slug, { method: 'DELETE' }); return verdict }
      if (!made.ok) return 'POST /api/posts -> ' + made.status
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      // WAIT FOR THE PIECE, not just for a surface: the blank editor already has a
      // .ProseMirror, so waiting on the element alone returns before the route has swapped and
      // the click then lands on a screen that is about to be replaced.
      const surface = await wait(() => {
        const el = document.querySelector('.ProseMirror')
        return el && el.textContent.includes('one line') ? el : null
      })
      if (!surface) return await done('the post never opened in the editor')

      const open = document.querySelector('[data-attrs]')
      if (!open) return await done('no way to open the attributes')
      open.click()
      const panel = await wait(() => document.querySelector('aside[role=dialog]'))
      if (!panel) return await done('the attributes never opened')
      await sleep(400)

      // A KEYSTROKE, as React sees one: the native setter past its value tracker, then the
      // input event. The re-render that follows is the whole mechanism under test.
      const key = (el, value) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const where = () => document.activeElement.tagName
        + (document.activeElement.type ? '[' + document.activeElement.type + ']' : '')

      const text = [...panel.querySelectorAll('input')].find((i) => i.type === 'text')
      if (!text) return await done('the sheet has no text field')
      text.focus()
      key(text, 'one')
      await sleep(150)
      if (document.activeElement !== text) return await done('one keystroke in the slug threw the keyboard to ' + where())
      key(text, 'one-two')
      await sleep(150)
      if (document.activeElement !== text) return await done('the second keystroke threw the keyboard to ' + where())

      // And the field it was reported on: the time inside the date picker.
      const dateBtn = [...panel.querySelectorAll('button')].find((b) => b.getAttribute('aria-haspopup') === 'dialog')
      if (!dateBtn) return await done('no date control in the attributes')
      dateBtn.click()
      const time = await wait(() => panel.querySelector('input[type=time]'), 20)
      if (!time) return await done('the calendar never opened')
      time.focus()
      const was = time.value
      key(time, '14:30')
      await sleep(150)
      if (document.activeElement !== time) return await done('typing the hour threw the keyboard to ' + where())
      if (time.value !== '14:30') return await done('the time read ' + time.value + ' after being set, was ' + was)
      return await done('ok three keystrokes, the caret never left the field')
    })()`, 1200))
}
