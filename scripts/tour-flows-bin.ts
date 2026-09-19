// BINNING THE PIECE THE EDITOR IS HOLDING, which is the one destructive control inside the
// writing screen.
//
// It came out of `tour-flows-editor.ts` on 2026-09-15, when the write column became
// server-rendered HTML and this flow had to grow a second visit: opening a piece is a real
// navigation now, so picking a row and acting on it cannot be one expression. That growth put
// the file over the 400-line limit, and this flow is the one that was least about the editor's
// writing surface and most about what stands beside it.
//
// ⚠️ AND IT GREW A THIRD VISIT the day the sheet itself converted. Move to Trash LEAVES the
// editor — the piece is gone, so staying would be a screen editing something that is not there
// — and under ADR 0054 leaving is a real page load. A script that navigates the page it is
// running in destroys its own execution context, so everything after the click has to be a
// separate visit.
import type { Tour } from './tour'

export function registerTrashFromEditorFlows({ flow, expect }: Tour): void {
  // ⚠️ IT OPENS THE EDITOR BY ITS OWN ADDRESS, not by clicking a row. Since the write column
  // became server-rendered HTML (ADR 0054) a row click is a REAL navigation, so everything
  // after it ran in a document that no longer existed and the flow reported "(no value)". What
  // a row click proves belongs to the column, and `tour-flows-layout.ts` proves it there; this
  // flow is about the editor's own way of binning the piece it is holding.
  flow('admin: the editor can move a piece to the trash', async () => {
    const picked = await expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      let row = null
      for (let i = 0; i < 60 && !row; i++) {
        row = [...document.querySelectorAll('[data-write-row]')]
          .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
        if (!row) await sleep(100)
      }
      return row ? new URL(row.href).pathname : 'the write column offered no post to open'
    })()`, 900)
    if (!picked.startsWith('/admin/editor/')) return picked
    const slug = picked.slice('/admin/editor/'.length)

    // The CLICK, and nothing after it. The handler deletes and then leaves; anything awaited
    // here would be awaited in a document that is on its way out.
    const pressed = await expect(picked, `
    (async () => {
      // VISIBLE controls only. Since ADR 0054 the rail is one DOM in every state and CSS
      // decides what is shown, so a folded group still holds a link that says "Trash" — and a
      // search by WORDS found the rail's row instead of the editor's button. offsetParent is
      // null for anything display:none, which is the same reason a person cannot click it.
      const seen = (el) => el && el.offsetParent !== null
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      // ⚠️ THE VISIBLE ONE. Two of each of these ship — the phone's "⋯" menu and the desktop
      // row — and querySelector hands back the first in the markup, which at this width is the
      // one folded away inside a details element. A control nobody can see is not the control.
      // (No backticks in here: the whole expression is a template literal.)
      const shownOne = (hook) => [...document.querySelectorAll(hook)].find(seen) || null
      const attributes = await wait(() => shownOne('[data-sheet-attrs]'))
      if (!attributes) return 'the editor never showed its Attributes control'
      attributes.click()

      const trash = await wait(() => shownOne('[data-sheet-trash]'), 40)
      if (!trash) return 'the Attributes panel offers no way to trash the piece'
      trash.click()
      return 'pressed'
    })()`, 1200)
    if (pressed !== 'pressed') return pressed

    // The piece is gone when the PUBLIC url stops answering — what a reader would check, rather
    // than trusting the button's own optimism — and it is in the bin rather than destroyed.
    return await expect('/admin/trash', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 200) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      const gone = await wait(async () => (await fetch('/${slug}')).status === 404 ? true : null)
      const listed = await (await fetch('/api/admin/view/trash')).json()
        .then((j) => (j && j.data && j.data.posts ? j.data.posts : []).some((p) => p.slug === '${slug}'))
      // Put it back before reporting either way: a tour that eats a seeded post changes what
      // every later run is testing. SOFT is also what the confirmation promises.
      const back = await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'restore', ids: ['${slug}'] }),
      })
      if (!gone) return 'the piece still answers after Move to Trash'
      if (!listed) return 'it left the site but never reached the trash'
      return back.ok ? 'ok (${slug})' : 'restore -> ' + back.status
    })()`, 1200)
  })
}

/**
 * THE SELECTION BAR, PRESSED — the half no unit test can reach.
 *
 * `POST /api/content/bulk` has its own suite and the column has its own island, and between
 * them sits the thing that actually fails: whether anything on screen reaches the route. That
 * is issue #60 exactly — the Trash spent thirteen days and four releases with a working
 * endpoint and no control that called it, because every flow touching it called the endpoint
 * directly. So this one clicks.
 *
 * ⚠️ IT WRITES NOTHING. `fetch` is stubbed for the one call, so the flow proves the wiring —
 * the verb, the pieces, the address — without changing a fixture the flows after it read. The
 * backup flow makes the same trade for the same reason, and states it too.
 */
export function registerBulkBarFlows({ flow, expect }: Tour): void {
  flow('admin: the selection bar counts, fills a range, and sends one request', () => expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const shown = () => [...document.querySelectorAll('[data-write-pick]')]
        .filter((r) => r.closest('[data-piece]') && !r.closest('[data-piece]').hidden)

      const enter = document.querySelector('[data-write-select]')
      if (!enter) return 'no way into the selection mode'
      enter.click()
      await sleep(400)

      const keys = ['[data-write-publish]', '[data-write-draft]', '[data-write-trash]']
        .map((sel) => document.querySelector(sel))
      if (keys.some((k) => !k)) return 'the selection bar is missing one of its three keys'
      if (keys.some((k) => k.offsetParent === null)) return 'a key is in the markup but not on screen'
      // Nothing ticked: all three refuse to be pressed. A key that answers by not moving is a
      // key that looks broken.
      if (keys.some((k) => !k.disabled)) return 'a key was pressable with nothing selected'

      const rows = shown()
      if (rows.length < 5) return 'too few rows on screen to test a range'
      rows[1].click()
      await sleep(80)
      rows[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
      await sleep(250)

      const ticked = [...document.querySelectorAll('[data-write-tick]')].filter((t) => t.checked).length
      if (ticked !== 4) return 'shift did not fill the range: ' + ticked + ' ticked, wanted 4'
      const labels = keys.map((k) => k.textContent.trim())
      if (labels.some((l) => !l.endsWith('(4)'))) return 'a key did not count: ' + labels.join(' / ')
      if (keys.some((k) => k.disabled)) return 'a key stayed disabled with four selected'

      // The select-all toggle says which way it is about to go.
      const every = document.querySelector('[data-write-all]')
      if (!every) return 'no select-all key'
      const before = every.textContent.trim()
      every.click()
      await sleep(200)
      const all = [...document.querySelectorAll('[data-write-tick]')].filter((t) => t.checked).length
      if (all !== rows.length) return 'select-all ticked ' + all + ' of ' + rows.length + ' shown'
      if (every.textContent.trim() === before) return 'the select-all key never changed its word'

      // ONE REQUEST, to the bulk route, naming the verb and the pieces. Stubbed, so the flow
      // leaves the fixture exactly as it found it.
      let calls = 0
      let sent = null
      const realFetch = window.fetch
      window.fetch = function (input, init) {
        const url = String(input && input.url ? input.url : input)
        if (url.includes('/api/content/bulk')) {
          calls += 1
          sent = JSON.parse(String(init && init.body))
          return Promise.resolve(new Response(JSON.stringify({ success: true, data: { done: [], failed: [] } }),
            { status: 200, headers: { 'content-type': 'application/json' } }))
        }
        return realFetch.call(this, input, init)
      }
      try {
        document.querySelector('[data-write-publish]').click()
        await sleep(600)
      } finally {
        window.fetch = realFetch
      }

      if (calls !== 1) return 'pressing Publish made ' + calls + ' request(s), wanted 1'
      if (!sent || sent.action !== 'publish') return 'the request did not say publish'
      if (!Array.isArray(sent.pieces) || sent.pieces.length !== all) {
        return 'the request named ' + (sent && sent.pieces ? sent.pieces.length : 0) + ' pieces, wanted ' + all
      }
      if (!sent.pieces.every((p) => p.kind && p.slug)) return 'a piece went without a kind or a slug'
      return 'ok range 4, all ' + all + ', one request naming ' + sent.pieces.length + ' pieces'
    })()`, 1500))
}
