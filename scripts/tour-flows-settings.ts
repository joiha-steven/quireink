// The Settings screen's own flows, plus the two rules about ASKING that this admin now holds
// everywhere — a reversible act asks nothing and offers the way back, an irreversible one asks
// in a dialog that names the thing. They live here rather than in `tour-flows-admin.ts`
// because that file hit its 400-line cap twice while they were being written; the seam is the
// same one the editor, home, pane and newsletter flows use.

import type { Tour } from './tour'

export function registerSettingsFlows({ flow, expect }: Tour): void {
  flow('admin: every settings label is reachable from the search', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const frame = () => new Promise((r) => requestAnimationFrame(r))
      const box = document.querySelector('input[type=search]')
      if (!box) return 'no search box'
      const setValue = (v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // Every SETTING LABEL the seven tabs render — matched on \`SETTING_LABEL\`'s own class
      // signature (kit.tsx), not on "looks like a label". The looser sweep tried first
      // collected 110 strings and called 51 unfindable, and every one of those was a tab
      // name, a palette name or a language in a picker: things that are not settings and
      // have no business in the index. A guard that cries wolf gets switched off.
      // ⚠️ Tabs are found by STRUCTURE (the sheet-top track, aria-pressed), never by a
      // paint shade: as [class*="bg-neutral-200"] a hover elsewhere matched the shade, the
      // sweep took in the sidebar, and this flow CLICKED SIGN OUT — everything after it
      // failed on a dead session and nothing pointed here. (Empty ⇒ the zero-label guard.)
      const labels = new Set()
      const tabs = [...(document.querySelector('main .no-scrollbar')?.querySelectorAll('button[aria-pressed]') ?? [])]
      for (const tab of tabs) {
        tab.click()
        await sleep(500)
        // \`SETTING_LABEL\`'s exact signature (kit.tsx), all four parts. Two parts of it was
        // not enough: \`FontUpload\` prints the CURRENT family in \`font-medium
        // text-neutral-800\` and that is a value readout, not a label — the guard called it an
        // unfindable setting and it never was one.
        const sel = '[class*="block"][class*="text-sm"][class*="font-medium"][class*="text-neutral-800"]'
        for (const el of document.querySelectorAll('main ' + sel)) {
          const text = el.textContent.trim()
          if (!text || text.length <= 2 || text.length >= 60 || el.children.length) continue
          // A button wears the label style too — "Choose image", "Add item", a font tile.
          // Those are actions and options, not settings, and indexing them would put four
          // "Choose image" rows in a result list that has one useful answer.
          if (el.closest('button')) continue
          // A file picker's label names the FILE it wants, not a setting.
          if (el.closest('label')?.querySelector('input[type=file]')) continue
          // A tile inside a picker is an OPTION — "Default (Inter)", a palette, a ratio.
          // The picker itself is the setting and is indexed; its choices are not.
          if (el.closest('label')?.querySelector('input[type=radio], input[type=checkbox]')) continue
          labels.add(text)
        }
      }
      const missing = []
      for (const label of labels) {
        setValue(label)
        await frame(); await frame()
        if (!document.querySelector('main ul li button')) missing.push(label)
      }
      setValue('')
      if (!labels.size) return 'collected no labels — this flow would pass forever'
      // Reported rather than asserted at zero: the sweep also picks up option names inside a
      // picker (a palette, a font, a language), which are not settings and are not indexed.
      // What must never appear here is a FIELD.
      return missing.length === 0
        ? 'ok (' + labels.size + ' labels, all findable)'
        : missing.length + ' of ' + labels.size + ' not findable: ' + missing.slice(0, 6).join(' | ')
    })()`, 1200))

  // Unsaved settings are not lost by a click on the rail. Two flows, because the interesting
  // half is the SECOND answer: a dialog that offers "stay" and then leaves anyway is worse
  // than no dialog, and one that offers "discard" and then keeps the edit is a lie about
  // what the button did.
  // The shared opening move of both flows below: put one change on the form, confirm the
  // save key counted it, then try to walk out. Inlined as STATEMENTS into each flow's async
  // body — so a failure returns the verdict string straight out of the flow — and it leaves
  // `was` and `dialog` behind for the half that differs.
  const editAndLeave = `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      // \`:not([type])\` and not \`[type=text]\`: \`ui/Input\` leaves the attribute off unless a
      // caller names one, so the site title — the first field on this sheet — matches neither
      // \`input[type=text]\` nor anything else a habit would reach for.
      const box = document.querySelector('main input:not([type])')
      if (!box) return 'no text field on the settings sheet'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const was = box.value
      setter.call(box, was + ' edited')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(250)
      const save = [...document.querySelectorAll('main button')].find((b) => /[0-9]/.test(b.textContent) && !b.disabled)
      if (!save) return 'the save key never counted the change'
      const home = document.querySelector('aside nav a[href="/admin"]')
      if (!home) return 'no way back to home in the rail'
      home.click()
      await sleep(500)
      const dialog = document.querySelector('[role=dialog]')
      if (!dialog) return 'left the page with an unsaved change and asked nothing'
      if (location.pathname !== '/admin/settings') return 'the address moved before the question was answered'`

  flow('admin: staying keeps an unsaved settings change, and the page', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      const stay = [...dialog.querySelectorAll('button')][0]
      stay.click()
      await new Promise((r) => setTimeout(r, 400))
      if (location.pathname !== '/admin/settings') return 'chose to stay and the page left anyway'
      const box2 = document.querySelector('main input:not([type])')
      if (box2.value !== was + ' edited') return 'chose to stay and the edit was thrown away'
      return 'ok (still on settings, edit intact)'
    })()`, 1200))

  flow('admin: discarding an unsaved settings change lets the page go', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      // The LAST button is the committing one, which is the order every footer in this admin
      // uses: back out, then the alternative, then the answer that acts.
      const buttons = [...dialog.querySelectorAll('button')]
      buttons[buttons.length - 1].click()
      await new Promise((r) => setTimeout(r, 600))
      if (location.pathname !== '/admin') return 'chose to discard and the page stayed put'
      return 'ok (landed on home)'
    })()`, 1200))

  // The two halves of the 2026-09-07 rule about asking: a REVERSIBLE act asks nothing and
  // offers the way back; an IRREVERSIBLE one asks, in a dialog that names the thing.
  flow('admin: trashing a comment asks nothing and offers the way back', () => expect('/admin/comments', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const rows = () => document.querySelectorAll('main [data-comment-row], main li').length
      const before = rows()
      const del = [...document.querySelectorAll('main button')]
        .find((b) => /delete|xoá|xóa/i.test(b.textContent.trim()))
      if (!del) return 'no delete control on a comment'
      del.click()
      await sleep(600)
      if (document.querySelector('[role=dialog]')) return 'trashing a comment put a dialog in the way'
      const undo = [...document.querySelectorAll('.admin-toast button')]
        .find((b) => b.textContent.trim().length > 0)
      if (!undo) return 'the comment went with no way back offered'
      undo.click()
      await sleep(800)
      return rows() >= before ? 'ok (gone, then back)' : 'undo did not put the comment back'
    })()`, 1000))

  // A refusal that belongs to one field goes TO that field, on the tab that holds it — not
  // into a corner toast on a screen of forty controls with nothing saying which one is wrong.
  // Driven through the API rather than the mode chooser: what is being tested is where the
  // refusal LANDS, and setting up the collision by clicking is a test of three other things.
  flow('admin: the server refuses a list path a post holds, and names the field', () => expect('/admin/settings?tab=home', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const read = async () => (await (await fetch('/api/admin/view/settings')).json())?.data?.settings
      const before = await read()
      const taken = (await (await fetch('/api/admin/view/content')).json())?.data?.posts?.[0]?.slug
      if (!taken) return 'the fixture has no post to collide with'
      const put = (home) => fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ home }),
      })
      // Home on a PAGE, which is what makes the list path a live field at all.
      const page = (await (await fetch('/api/admin/view/content')).json())?.data?.pages?.[0]?.slug
      if (!page) return 'the fixture has no page to point the home at'
      const setup = await put({ ...before.home, mode: 'page', page })
      if (!setup.ok) return 'could not put the home on a page'
      // And the collision the server refuses.
      const refused = await put({ ...before.home, mode: 'page', page, listPath: '/' + taken })
      const said = await refused.json()
      await put(before.home)
      if (refused.ok) return 'the server accepted a list path a post already holds'
      return String(said.error || '').startsWith('list_path_taken')
        ? 'ok (refused, and the refusal names the field)'
        : 'the refusal did not name the field: ' + said.error
    })()`, 1200))

  // ⚠️ AN EMPTY ANSWER AND A BROKEN QUESTION ARE NOT THE SAME FACT. Three components used to
  // render them identically: a refused request printed "nothing here" to somebody whose rows
  // were all still on the server.
  flow('admin: a refused list says so, and offers to ask again', () => expect('/admin/settings?tab=server', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const real = window.fetch
      let refuse = true
      window.fetch = (u, i) => (refuse && String(u).includes('/api/redirects') && (!i || !i.method || i.method === 'GET')
        ? Promise.reject(new Error('offline'))
        : real(u, i))
      // Re-enter the tab so the redirect table mounts behind the refusal.
      const other = [...document.querySelectorAll('main .no-scrollbar button')][0]
      const server = [...document.querySelectorAll('main .no-scrollbar button')].find((b) => /server|máy chủ/i.test(b.textContent))
      other.click(); await sleep(400); server.click(); await sleep(900)
      const boxes = [...document.querySelectorAll('main div')].filter((d) => /border-neutral-900|border-white/.test(d.className))
      if (!boxes.length) { window.fetch = real; return 'a refused list drew no failure box' }
      const retry = [...boxes[0].querySelectorAll('button')][0]
      if (!retry) { window.fetch = real; return 'the failure box offered no way to ask again' }
      // Let it through this time: the retry must refetch in place, not reload the admin.
      refuse = false
      const path = location.pathname
      retry.click()
      await sleep(900)
      window.fetch = real
      if (location.pathname !== path) return 'Try again left the page'
      const stillBroken = [...document.querySelectorAll('main div')].some((d) => /border-neutral-900|border-white/.test(d.className))
      return stillBroken ? 'Try again did not clear the failure' : 'ok (failed, asked again, recovered in place)'
    })()`, 1400))

  flow('admin: a failed save leaves its toast up, and the close button removes it', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      // A refusal the server really gives: the settings endpoint rejects a body that is not
      // an object, so nothing has to be stubbed to produce a real failure toast.
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '"nope"' })
      const box = document.querySelector('main input:not([type])')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(box, box.value + ' x')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(250)
      // Break the endpoint from the page's side: a fetch that cannot parse its answer is the
      // same failure path a dead server takes, and it needs no fixture.
      const real = window.fetch
      window.fetch = (u, i) => (String(u).includes('/api/settings') && i && i.method === 'PUT'
        ? Promise.reject(new Error('offline'))
        : real(u, i))
      const save = [...document.querySelectorAll('main button')].find((b) => /[0-9]/.test(b.textContent) && !b.disabled)
      if (!save) return 'the save key never counted the change'
      save.click()
      await sleep(600)
      window.fetch = real
      let toast = document.querySelector('.admin-toast')
      if (!toast) return 'a failed save printed nothing'
      // FOUR SECONDS LATER it is still there: a failure has no timer, because only the person
      // reading it can decide it has been read.
      await sleep(4200)
      toast = document.querySelector('.admin-toast')
      if (!toast) return 'the failure toast left on its own'
      const close = [...toast.querySelectorAll('button')].pop()
      if (!close) return 'the toast offered no way to close it'
      close.click()
      await sleep(500)
      return document.querySelector('.admin-toast') ? 'the close button did not remove it' : 'ok (stayed 4s, closed on demand)'
    })()`, 1200))

  flow('admin: emptying the trash asks first, and Esc backs out', () => expect('/admin/trash', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const empty = [...document.querySelectorAll('main button')]
        .find((b) => /empty|dọn|leeren|vider|vaciar|svuota|esvaziar|очист|空|비우/i.test(b.textContent.trim()))
      if (!empty) return 'no Empty trash control'
      empty.click()
      await sleep(500)
      const dialog = document.querySelector('[role=dialog]')
      if (!dialog) return 'emptying the trash asked nothing'
      if (!/[a-z]/i.test(dialog.textContent)) return 'the dialog carried no words'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(400)
      if (document.querySelector('[role=dialog]')) return 'Esc did not close the dialog'
      const counts = await (await fetch('/api/admin/view/trash')).json()
      const still = (counts?.data?.posts ?? []).length + (counts?.data?.media ?? []).length
      return still > 0 ? 'ok (asked, backed out, trash intact)' : 'backing out emptied it anyway'
    })()`, 1000))
}
