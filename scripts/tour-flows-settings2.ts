// The settings screen's own flows, for the server-drawn version (ADR 0054).
//
// ⚠️ THIS SCREEN DRIVES THE MOST DANGEROUS ROUTES IN THE ADMIN, and not one of them is pressed
// here. The password, the recovery codes, the second factor, signing devices out, the SMTP test
// send, the provider's model list, the alt-text sweep, taking or deleting a backup, the off-site
// probe, a CDN purge, every import, minting or revoking an MCP token, deleting a redirect: all
// off limits. What IS driven is the screen — the strip, the search, the explanations, the
// controls that only move the FORM — plus `PUT /api/settings`, which the existing settings flows
// already exercise and which is restored afterwards.
//
// The Content API flow at the foot is the one that presses a Save in anger, and it is here for a
// reason nothing smaller can cover: the chain from a switch on this screen to a public endpoint
// answering runs through the form collector, a dotted path, `PUT /api/settings`, `sanitizeApi`
// and `apiRoute`, and every link of it has a unit test while the CHAIN has none. Two bugs of
// exactly that shape shipped on 2026-09-19 — a control that saved nothing, and a save that left
// a field out — and both were found by a browser flow after 3,800 unit tests had gone green.
import type { Tour } from './tour'
import { SCREEN_FORMS } from './tour-ask'

export function registerSettings2Flows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('admin: settings arrives finished, all seven tabs of it', () => expect('/admin/settings', `
    (() => {
      const screen = document.querySelector('[data-screen="settings"]')
      if (!screen) return 'settings did not come from the server'
      if (document.documentElement.dataset.adminScreen !== 'settings') return 'the page is not stamped'
      const panels = [...document.querySelectorAll('[data-settings-panel]')]
      if (panels.length !== 7) return panels.length + ' panel(s), expected seven'
      // ALL SEVEN are in the page at once, because the Save key stores the whole form.
      const shut = panels.filter((p) => p.hidden).length
      if (shut !== 6) return shut + ' of seven hidden, expected six'
      const controls = document.querySelectorAll('[data-k]').length
      if (controls < 100) return 'only ' + controls + ' control(s) in the first response'
      return 'ok (' + controls + ' controls, seven panels, one response)'
    })()`, 1500))

  // The same safety shape the newsletter, the assistant and the library are held to — and this
  // screen has the most to lose by a stray Enter.
  flow('admin: nothing in settings is a form, and no secret is in the page', () => expect('/admin/settings', `
    (() => {
      ${SCREEN_FORMS}
      const forms = screenForms().length
      if (forms) return forms + ' form(s) on the screen that changes the password'
      const buttons = [...document.querySelectorAll('main button')]
      const untyped = buttons.filter((b) => b.getAttribute('type') !== 'button')
      if (untyped.length) return untyped.length + ' button(s) with no type: ' + untyped.slice(0, 3).map((b) => b.textContent.trim()).join(' | ')
      if (buttons.length < 30) return 'only ' + buttons.length + ' buttons, so this proves little'
      // A credential box ships EMPTY: sending the dots back would store the dots.
      const creds = [...document.querySelectorAll('input[type=password]')]
      const filled = creds.filter((el) => el.value !== '')
      if (filled.length) return filled.length + ' credential box(es) arrived with a value in them'
      // And a control that stores no setting must not wear a setting's name.
      const named = creds.filter((el) => el.hasAttribute('data-k'))
      if (named.length) return named.length + ' credential box(es) carry data-k'
      return 'ok (' + buttons.length + ' buttons, 0 forms, ' + creds.length + ' empty credential box(es))'
    })()`, 1500))

  flow('admin: the settings strip swaps tabs in a frame, and the address remembers which', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const tab = (k) => document.querySelector('[data-settings-tabs] [data-tab="' + k + '"]')
      const panel = (k) => document.querySelector('[data-settings-panel="' + k + '"]')
      if (!tab('appearance')) return 'no settings strip'
      tab('appearance').click(); await sleep(250)
      if (panel('appearance').hidden) return 'the appearance tab did not come forward'
      if (!panel('blog').hidden) return 'the blog tab stayed on screen'
      if (new URL(location.href).searchParams.get('tab') !== 'appearance') return 'the address forgot the tab'
      // The line under the strip is the tab's own sentence, so it moves with it.
      const hint = document.querySelector('[data-notes-row]:not([hidden])')
      if (!hint || hint.dataset.notesRow !== 'appearance') return 'the hint under the strip did not follow'
      tab('blog').click(); await sleep(250)
      if (new URL(location.href).searchParams.get('tab')) return 'going back to Blog left the address dirty'
      return 'ok (one tab on screen, the address and the strip agree on which)'
    })()`, 1800))

  flow('admin: the settings search narrows and lands on the setting, not just the tab', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const find = document.querySelector('[data-settings-find]')
      const rows = () => [...document.querySelectorAll('[data-found]')].filter((r) => !r.hidden)
      if (!find) return 'no search on the settings row'
      const all = document.querySelectorAll('[data-found]').length
      if (all < 50) return 'the search index drew ' + all + ' row(s)'
      // Every row is already in the page: narrowing hides, it does not fetch.
      if (rows().length) return 'results are showing before anything was typed'
      find.value = 'a'
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(200)
      if (rows().length) return 'one letter opened the list'
      const row = document.querySelector('[data-found]')
      const word = (row.dataset.label || '').split(' ')[0]
      find.value = word
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(250)
      const hits = rows()
      if (hits.length === 0) return 'searching a label\\'s own first word matched nothing: ' + word
      if (document.querySelectorAll('[data-found]').length !== all) return 'narrowing removed rows from the page'
      const wanted = hits[0].dataset.found
      hits[0].querySelector('button').click(); await sleep(500)
      const open = document.querySelector('[data-settings-panel]:not([hidden])')
      if (!open || open.dataset.settingsPanel !== wanted) return 'choosing a result did not open its tab'
      if (!document.querySelector('.setting-found')) return 'it opened the tab and did not point at the setting'
      return 'ok (' + hits.length + ' of ' + all + ' matched, landed on ' + wanted + ')'
    })()`, 2000))

  // Nothing is stored here: the switch is put back before the flow ends.
  flow('admin: the save key counts what is waiting, and nothing else', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const key = document.querySelector('[data-settings-save]')
      if (!key) return 'no save key'
      if (!key.disabled) return 'the save key is pressable with nothing to save'
      const sw = document.querySelector('[data-settings-panel]:not([hidden]) [data-switch]')
      if (!sw) return 'no switch on the open tab'
      const was = sw.getAttribute('aria-checked')
      sw.click(); await sleep(200)
      if (key.disabled) return 'moving a switch left the save key shut'
      if (!/1/.test(key.textContent)) return 'the key does not say how many: ' + key.textContent
      if (sw.getAttribute('aria-checked') === was) return 'the switch did not move'
      sw.click(); await sleep(200)
      if (!key.disabled) return 'putting it back left the key pressable'
      return 'ok (counted one, then none, nothing stored)'
    })()`, 1800))

  flow('admin: the explanations can be hidden, and it is remembered', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      localStorage.removeItem('quireink-admin-settings-notes')
      const box = document.querySelector('[data-settings-panels]')
      const toggle = document.querySelector('[data-notes-row]:not([hidden]) [data-notes-toggle]')
      if (!box || !toggle) return 'no explanations switch'
      const before = box.dataset.explanations
      toggle.click(); await sleep(200)
      if (box.dataset.explanations === before) return 'the switch did not change anything'
      const stored = localStorage.getItem('quireink-admin-settings-notes')
      if (stored !== '1' && stored !== '0') return 'the choice was not remembered: ' + stored
      toggle.click(); await sleep(200)
      if (box.dataset.explanations !== before) return 'it did not go back'
      // ⚠️ PUT THE PREFERENCE BACK. Once this is stored it stops being a preference nobody has
      // answered, and the tab-length measurement stops running at all — which is exactly how
      // this flow broke the one that checks a short tab opens with its explanations. A flow
      // that leaves state behind changes what the next flow is testing.
      localStorage.removeItem('quireink-admin-settings-notes')
      return 'ok (hidden, remembered, and back)'
    })()`, 1800))

  // ⚠️ THE ONE SAVE THIS FILE PRESSES, and it puts the setting back before it returns. A flow
  // that leaves the Content API switched on hands every flow after it a blog with a public
  // endpoint the install default does not have.
  //
  // It earned its place on the first run: the card had been given a Save key of its own, copied
  // from MCP, which `fields-box.ts` reserves for a card that can TRY the far end. This found it
  // by pressing the key that is actually there.
  flow('admin: the Content API switch reaches the public endpoint, and comes back off', () => expect('/admin/settings?tab=server', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      /** Poll the door until it says what we are waiting for, or give up. */
      const doorSays = async (want) => {
        for (let i = 0; i < 40; i++) {
          const res = await fetch('/api/v1/posts')
          if (res.status === want) return res
          await sleep(150)
        }
        return null
      }
      const sw = document.querySelector('[data-switch][data-k="api.enabled"]')
      if (!sw) return 'no Content API switch on the Server tab'
      if (sw.getAttribute('aria-checked') !== 'false') return 'the API was already on, so this proves nothing'
      const card = sw.closest('[data-card]')
      if (!card) return 'the switch is not on a card'
      // ⚠️ THE SCREEN'S Save, not a card's. This card sets a boolean and reaches nothing, so it
      // has no key of its own — and asserting that here is what keeps one from growing back.
      if (card.querySelector('[data-card-save]')) return 'the card grew a Save key of its own'
      const save = document.querySelector('[data-settings-save]')
      if (!save) return 'the settings screen has no Save key'

      // Shut, before anything is pressed. This is the install default and the point of it.
      const before = await fetch('/api/v1/posts')
      if (before.status !== 404) return 'the API answered ' + before.status + ' with the setting off'
      // The address is readable either way, and it is the one the SERVER printed.
      const shown = card.querySelector('[data-api-url]')
      if (!shown || !shown.textContent.trim().endsWith('/api/v1')) return 'the card does not show its address'

      sw.click(); await sleep(150)
      if (save.disabled) return 'the Save key stayed disabled after the switch moved'
      save.click()
      const open = await doorSays(200)
      if (!open) return 'the endpoint never opened after saving the switch on'
      const body = await open.json()
      if (!body || !Array.isArray(body.items)) return 'the endpoint answered something that is not a listing'
      if (body.items.length === 0) return 'the endpoint answered with no posts on a seeded blog'
      if (body.items.some((p) => !p.slug || !p.url)) return 'a row came back without a slug or a URL'
      // Nothing that is not public: the seed carries drafts and scheduled posts.
      const one = await (await fetch('/api/v1/posts/' + body.items[0].slug)).json()
      if (typeof one.content !== 'string' || one.content === '') return 'the single piece came back without its body'
      if ('deletedAt' in one || 'status' in one) return 'a field that must not travel came back'

      sw.click(); await sleep(150)
      save.click()
      const shut = await doorSays(404)
      if (!shut) return 'the endpoint stayed open after the switch went back off'
      return 'ok 404 -> 200 with ' + body.total + ' post(s), one body read -> 404'
    })()`, 2000))

  // ⚠️ THE SECOND SAVE THIS FILE PRESSES, and like the first it puts everything back. It also
  // checks the one thing that would matter most if it were ever wrong: that the actor document
  // carries the PUBLIC half of this blog's key and nothing that looks like the other half.
  // Whoever holds the private key can post as this blog to every follower it has, forever.
  flow('admin: the fediverse switch gives the blog a name, and takes it back', () => expect('/admin/settings?tab=server', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const send = async (url, method, body) => {
        const res = await fetch(url, {
          method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        })
        return { ok: res.ok, json: await res.json().catch(() => null) }
      }
      const ask = async (path, accept) => await fetch(path, {
        cache: 'no-store', headers: accept ? { accept } : {},
      })

      const sw = document.querySelector('[data-switch][data-k="activitypub.enabled"]')
      if (!sw) return 'no fediverse switch on the Server tab'
      if (sw.getAttribute('aria-checked') !== 'false') return 'it was already on, so this proves nothing'
      const handle = document.querySelector('[data-k="activitypub.handle"]')
      if (!handle) return 'the card has no handle field'

      // Shut: every door, including the one that makes the blog findable at all.
      for (const path of ['/ap/actor', '/ap/outbox', '/ap/followers']) {
        const res = await ask(path, 'application/activity+json')
        if (res.status !== 404) return path + ' answered ' + res.status + ' while the switch was off'
      }

      // ⚠️ ON WITH NO HANDLE IS STILL OFF. An actor with no name is not an identity, and the
      // feature refuses rather than publishing half of one.
      await send('/api/settings', 'PUT', { activitypub: { enabled: true, handle: '' } })
      await sleep(200)
      if ((await ask('/ap/actor', 'application/activity+json')).status !== 404) {
        return 'the actor answered with no handle set'
      }

      await send('/api/settings', 'PUT', { activitypub: { enabled: true, handle: 'tourblog' } })
      await sleep(400)
      const actorRes = await ask('/ap/actor', 'application/activity+json')
      if (actorRes.status !== 200) return 'the actor answered ' + actorRes.status + ' with the switch on'
      const actorText = await actorRes.text()
      if (actorText.indexOf('BEGIN PUBLIC KEY') === -1) return 'the actor carries no public key'
      // ⚠️ THE ONE LEAK THAT WOULD MATTER.
      if (actorText.indexOf('PRIVATE KEY') !== -1) return 'the actor document contains a PRIVATE key'
      const actor = JSON.parse(actorText)
      if (actor.type !== 'Person') return 'the actor is a ' + actor.type + ', not a Person'
      if (actor.preferredUsername !== 'tourblog') return 'the actor does not answer to the handle'

      // WebFinger: the only way a handle becomes a URL. A reverse proxy that swallows
      // /.well-known/ breaks exactly this, and nothing else on the blog notices.
      const host = location.host
      const finger = await ask('/.well-known/webfinger?resource=' + encodeURIComponent('acct:tourblog@' + host))
      if (finger.status !== 200) return 'webfinger answered ' + finger.status
      const jrd = await finger.json()
      const self = (jrd.links || []).find((l) => l.rel === 'self')
      if (!self || self.href !== actor.id) return 'webfinger does not point at the actor'
      // ...and it answers for that name and no other.
      const wrong = await ask('/.well-known/webfinger?resource=' + encodeURIComponent('acct:someoneelse@' + host))
      if (wrong.status !== 404) return 'webfinger answered for a name this blog does not have'

      // A post, as the object a follower's server would hold the id of.
      const listing = await (await ask('/api/v1/posts')).json().catch(() => null)
      void listing

      await send('/api/settings', 'PUT', { activitypub: { enabled: false, handle: '' } })
      await sleep(300)
      if ((await ask('/ap/actor', 'application/activity+json')).status !== 404) {
        return 'the actor stayed up after the switch went back off'
      }
      return 'ok shut -> Person "tourblog" with a public key and a webfinger -> shut'
    })()`, 2500))
}
