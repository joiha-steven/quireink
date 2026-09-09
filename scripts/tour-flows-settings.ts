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
      // ⚠️ Tabs are found by STRUCTURE (the tablist and its tabs), never by a
      // paint shade: as [class*="bg-neutral-200"] a hover elsewhere matched the shade, the
      // sweep took in the sidebar, and this flow CLICKED SIGN OUT — everything after it
      // failed on a dead session and nothing pointed here. (Empty ⇒ the zero-label guard.)
      const labels = new Set()
      // \`[role=tab]\`, not \`[aria-pressed]\`: the strip became a real tablist on 2026-09-07,
      // and a selected tab says \`aria-selected\`. Finding zero tabs made this sweep collect
      // zero labels, which its own zero-label guard then caught — as designed.
      const tabs = [...(document.querySelector('main [role=tablist]')?.querySelectorAll('[role=tab]') ?? [])]
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

  // Measured on 2026-09-07: 48 of 48 interactive elements had a transition, all of them the
  // same hover, and there were ZERO keyframes and no entrance anywhere. A change of state was
  // an instant swap, which reports "the screen is different now" and not what changed.
  flow('admin: a panel arrives, a list arrives in order, and the switch stops both', () => expect('/admin/log', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const row = document.querySelector('.admin-stagger > *')
      if (!row) return 'the log rows carry no stagger'
      const rows = [...document.querySelectorAll('.admin-stagger > *')].slice(0, 4)
      const delays = rows.map((r) => getComputedStyle(r).animationDelay)
      if (getComputedStyle(row).animationName === 'none') return 'the rows have no entrance'
      if (delays[1] === delays[2]) return 'the rows all arrive at once: ' + delays.join(' ')
      // ⚠️ AND THE OWNER'S SWITCH STOPS IT. A motion pass the gate does not reach is the
      // exact failure the admin stylesheet was rewritten for on 2026-09-06.
      // NOTE: this body is a template literal. No backticks anywhere in it.
      document.documentElement.dataset.motion = 'off'
      await sleep(200)
      const stopped = getComputedStyle(document.querySelector('.admin-stagger > *')).animationDuration
      const enter = document.querySelector('.admin-enter')
      const enterStopped = enter ? getComputedStyle(enter).transitionDuration : '0s'
      document.documentElement.dataset.motion = ''
      if (!/^0m?s/.test(stopped)) return 'the switch left the row entrance running: ' + stopped
      if (!/^0m?s/.test(enterStopped)) return 'the switch left the page entrance running: ' + enterStopped
      return 'ok (staggered ' + delays.join('/') + ', all zero with motion off)'
    })()`, 1200))

  // A tablist is not eleven buttons in a row. With buttons, reaching the last settings tab
  // from the keyboard costs seven presses of Tab, and every one of them is also a press that
  // has to NOT be Enter.
  flow('admin: the settings tabs are one stop, and the arrows walk them', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const strip = document.querySelector('main [role=tablist]')
      if (!strip) return 'the settings strip is not a tablist'
      const tabs = [...strip.querySelectorAll('[role=tab]')]
      if (tabs.length !== 7) return 'expected 7 tabs, found ' + tabs.length
      // ROVING: exactly one of them is a tab stop, so Tab reaches the panel rather than
      // walking the strip.
      const stops = tabs.filter((b) => b.tabIndex === 0)
      if (stops.length !== 1) return stops.length + ' tabs are keyboard stops; a tablist has one'
      if (stops[0].getAttribute('aria-selected') !== 'true') return 'the stop is not the selected tab'
      const panel = document.getElementById(tabs[0].getAttribute('aria-controls') || '')
      if (!panel || panel.getAttribute('role') !== 'tabpanel') return 'the strip controls no panel'

      const before = document.querySelector('[role=tab][aria-selected=true]').textContent
      stops[0].focus()
      strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await sleep(400)
      const after = document.querySelector('[role=tab][aria-selected=true]').textContent
      if (after === before) return 'the right arrow moved nothing'
      strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      await sleep(400)
      const last = document.querySelector('[role=tab][aria-selected=true]').textContent
      const names = [...document.querySelectorAll('[role=tab]')].map((b) => b.textContent)
      if (last !== names[names.length - 1]) return 'End did not reach the last tab'
      // Put it back, so the next flow starts where every other one expects to.
      strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
      await sleep(300)
      return 'ok (one stop, arrows move, End reaches the last)'
    })()`, 1200))

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

  // ITEM 14, and the reason it is a flow rather than a screenshot: what is asserted is a
  // DIFFERENCE between two tabs, and a difference is the one thing a photograph of either
  // one cannot show. The explanations are hidden by default because they are bulk; a tab
  // that stops short of the sheet's 60vh floor has no bulk to hide, so it opens with them.
  // The owner's own answer, once given, outranks both — which is why the flow clears the
  // preference before it measures anything.
  //
  // NOTE: this body is a template literal. No backticks.
  flow('admin: a settings tab with paper to spare opens with its explanations', () => expect('/admin/settings?tab=people', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const panel = () => document.getElementById('settings-panel')
      if (!panel()) return 'no settings panel'
      const state = () => panel().getAttribute('data-explanations')
      // Measured the way the screen measures it: with the explanations flipped off, so the
      // answer is the tab's own height and not the height it grew to after being answered.
      const bare = () => {
        const p = panel()
        const was = p.getAttribute('data-explanations')
        p.setAttribute('data-explanations', 'off')
        const h = Math.round(p.getBoundingClientRect().height)
        if (was !== null) p.setAttribute('data-explanations', was)
        return h
      }
      const floor = innerHeight * 0.6
      // WHICH tab is the short one is not the claim; the claim is that the short one opens
      // and the long one does not. The flow used to name Comments and mail, and stopped
      // passing the day the tour's viewport came out shorter (floor 454 against a 524px
      // tab) with nothing in the product changed. So every tab is measured, reached the way
      // a person reaches it, and the shortest and the tallest are the two compared.
      const tabs = Array.from(document.querySelectorAll('[role=tab]'))
      if (tabs.length < 6) return 'only ' + tabs.length + ' tab(s) to compare across'
      const heights = []
      for (const tab of tabs) {
        tab.click()
        await sleep(400)
        heights.push({ tab, h: bare(), label: tab.textContent.trim() })
      }
      heights.sort((a, b) => a.h - b.h)
      const short = heights[0], long = heights[heights.length - 1]
      if (short.h >= floor) return 'skip: no tab under the ' + Math.round(floor) + 'px floor at this window; the shortest (' + short.label + ') is ' + short.h + 'px'
      if (long.h < floor) return 'skip: every tab is under the ' + Math.round(floor) + 'px floor; the tallest (' + long.label + ') is ' + long.h + 'px'
      short.tab.click()
      await sleep(400)
      if (state() !== 'on') return short.label + ', with ' + Math.round(floor - short.h) + 'px of spare paper, still hid its explanations'
      const visible = Array.from(document.querySelectorAll('.admin-note')).filter((n) => n.getBoundingClientRect().height > 0).length
      if (visible < 2) return 'the flag says on and ' + visible + ' explanation(s) are drawn'
      long.tab.click()
      await sleep(400)
      if (state() !== 'off') return long.label + ', past the floor at ' + long.h + 'px, opened its explanations too, so nothing is being measured'
      return 'ok ' + short.label + ' ' + short.h + 'px shows ' + visible + ', ' + long.label + ' ' + long.h + 'px shows none, floor ' + Math.round(floor) + ' of ' + innerHeight
    })()`, 900))


  // ITEM 15: THREE RANKS, and each has to be legibly quieter than the one outside it. The
  // regression this guards is the one that produced the arrangement it replaced — a card
  // title one point above the groups inside it, made findable by hanging decoration on the
  // card (a dot, a tinted band, a size step) rather than by dropping the rank below it.
  // Sizes are read COMPUTED, so a class rename that loses the rule fails here.
  //
  // NOTE: this body is a template literal. No backticks.
  flow('admin: a settings card, a group and a row are three ranks apart', () => expect('/admin/settings?tab=post', `
    (() => {
      const panel = document.getElementById('settings-panel')
      if (!panel) return 'no settings panel'
      const card = panel.querySelector('h2')
      const group = panel.querySelector('h3')
      if (!card || !group) return 'the tab has no card or no group in it'
      const c = getComputedStyle(card), g = getComputedStyle(group)
      const cs = parseFloat(c.fontSize), gs = parseFloat(g.fontSize)
      if (cs !== 16) return 'a card title is ' + cs + 'px, not 16'
      if (Number(c.fontWeight) < 600) return 'a card title is weight ' + c.fontWeight
      if (gs !== 12) return 'a group title is ' + gs + 'px, not 12'
      if (g.textTransform !== 'uppercase') return 'a group title is not an eyebrow: ' + g.textTransform
      if (cs - gs < 4) return 'only ' + (cs - gs) + 'px between a card and a group'
      // No mark opens the header row except a lamp, which carries a name. A bare decorative
      // dot is what this replaced, and it is the thing most likely to come back.
      const marks = Array.from(card.querySelectorAll('span')).filter((n) => {
        const b = n.getBoundingClientRect()
        return b.width > 0 && b.width <= 12 && Math.abs(b.width - b.height) < 2
      })
      const unnamed = marks.filter((n) => !n.getAttribute('aria-label') && !n.querySelector('[aria-label]'))
      if (unnamed.length) return unnamed.length + ' unnamed mark(s) still open a card title'
      return 'ok card ' + cs + '/' + c.fontWeight + ', group ' + gs + ' uppercase, ' + marks.length + ' mark(s)'
    })()`, 900))

}
