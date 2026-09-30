// Flows for what the eight-agent sweep of 2026-09-30 found, each one a fault a real reader or
// owner hit and no existing flow asked about. One flow per fault, named for what must hold.
import type { Tour } from './tour'

/** Solve a comment stamp in the page, the way the island does, and wait out its floor. */
const SOLVE = `
  async function solveStamp(stamp) {
    const enc = new TextEncoder()
    for (let n = 0; n < stamp.range; n++) {
      const d = await crypto.subtle.digest('SHA-256', enc.encode(stamp.salt + n))
      const hex = [...new Uint8Array(d, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
      if (hex === stamp.target.slice(0, 16)) {
        const age = Date.now() - stamp.issued
        if (age < 3200) await new Promise((r) => setTimeout(r, 3200 - age))
        return { ...stamp, answer: n }
      }
    }
    return null
  }`

export function registerSweepFlows({ flow, expect }: Tour): void {
  // The page is cached, so every reader of a post is handed the same challenge, and the first
  // comment spends it. Every reader after that got "Verification failed" until the cache let
  // go: the server said 400 for a spent stamp and the island only recovers from a 409, whose
  // retry also read the stamp off the wrong level of the envelope and sent it too young.
  flow('a second and third reader can comment on a cached page', () => expect('/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      ${SOLVE}
      const root = document.querySelector('#comments')
      if (!root || !root.dataset.stamp) return 'no comment mount with a stamp on the page'
      const slug = root.dataset.post
      const decode = (s) => JSON.parse(s.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      // Reader A, somewhere else, answers the SAME challenge this page carries and spends it.
      const again = (await (await fetch(location.pathname)).text()).match(/data-stamp="([^"]*)"/)
      if (!again || decode(again[1]).salt !== JSON.parse(root.dataset.stamp).salt) {
        return 'the page was not served from the cache, so this flow tests nothing'
      }
      const first = await fetch('/api/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postSlug: slug, name: 'Reader A', email: 'a@example.com',
          content: 'Reader A spent the shared challenge.', stamp: await solveStamp(JSON.parse(root.dataset.stamp)),
        }),
      })
      if (!first.ok) return 'reader A was refused: ' + first.status

      // Readers B and C, through the form itself.
      root.scrollIntoView()
      const until = async (test, ms) => {
        for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 150))) {
          if (test()) return true
        }
        return false
      }
      if (!(await until(() => root.querySelector('.comment-form'), 8000))) return 'the comment form never appeared'
      for (const who of ['Reader B', 'Reader C']) {
        const form = root.querySelector(':scope > .comment-form') || root.querySelector('.comment-form')
        const set = (name, value) => {
          const input = form.querySelector('[name=' + name + ']')
          input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        set('name', who)
        set('email', who.replace(' ', '').toLowerCase() + '@example.com')
        set('content', who + ' was here after the challenge was spent.')
        form.querySelector('button[type=submit]').click()
        const landed = await until(() => [...root.querySelectorAll('.comment-name')].some((n) => n.textContent === who), 15000)
        if (!landed) return who + ' was refused: "' + (form.querySelector('.comment-status')?.textContent ?? '') + '"'
      }
      return 'ok (A by hand, B and C through the form)'
    })()`, 1500))

  // Save on a live post saved it as a DRAFT: ⌘S to fix a typo took the post off the site (200 →
  // 404) and said "Draft saved". And Preview saved first, so a half-typed sentence went live the
  // moment the writer asked how it read. A post of its own, cleaned up by the last of the three.
  // `no-store` on every read of the public page: the browser keeps the first answer otherwise,
  // and the flow would be testing its own cache.
  const LIVE = 'tour-live-post-keeps-living'
  flow('a live post for the save flows', () => expect('/admin', `
    (async () => {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour live post keeps living', content: 'Words the readers see.', status: 'published', date: '2020-01-01T00:00:00.000Z' }),
      })
      if (!r.ok) return 'could not create the live post: ' + r.status
      return (await fetch('/${LIVE}')).status === 200 ? 'ok' : 'the new post is not public'
    })()`))

  flow('admin: ⌘S on a live post saves it and leaves it live', () => expect(`/admin/editor/${LIVE}`, `
    (async () => {
      const key = document.querySelector('[data-sheet-save]')
      if (!key) return 'no Save key'
      if (key.textContent !== key.dataset.saySave) return 'the key on a live post reads "' + key.textContent + '", not "' + key.dataset.saySave + '"'
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, ta.value + ' (typo fixed)')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 1500))
      const live = await fetch('/${LIVE}', { cache: 'no-store' })
      if (live.status !== 200) return 'the post answers ' + live.status + ' after ⌘S: Save took it off the site'
      return (await live.text()).includes('typo fixed') ? 'ok' : 'the post stayed live but the save never landed'
    })()`, 1500))

  flow('admin: Preview on a live post leaves the public page as it was', () => expect(`/admin/editor/${LIVE}`, `
    (async () => {
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, 'HALF-WRITTEN title nobody saved')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      const preview = document.querySelector('[data-sheet-preview]')
      if (!preview) return 'no Preview key'
      preview.click()
      await new Promise((r) => setTimeout(r, 1500))
      const live = await (await fetch('/${LIVE}', { cache: 'no-store' })).text()
      const leaked = live.includes('HALF-WRITTEN')
      // Clean up: the post leaves the site and the database, so the next run starts clean.
      await fetch('/api/posts/${LIVE}', { method: 'DELETE' })
      await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${LIVE}'] }),
      })
      return leaked ? 'Preview put the unsaved title on the public page' : 'ok'
    })()`, 1500))

  // Re-enrolling two-factor could not be finished: Confirm was drawn disabled with nothing to
  // enable it, and its request left out the secret the server needs (400 bad_code). There was no
  // QR either. This walks it with a real code computed in the page from the secret shown.
  flow('admin: two-factor can be enrolled again from the account screen', () =>
    expect('/admin/settings?tab=account', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const type = (el, v) => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      const cur = document.querySelector('[data-security-current]')
      if (!cur) return 'no Security card'
      type(cur, 'quartz-lantern-47-thicket') // the showcase owner's (scripts/seed-showcase.ts)
      await sleep(200)
      document.querySelector('[data-sec-reenrol]').click()
      await sleep(900)
      if (!document.querySelector('[data-sec-qr] svg')) return 'no QR code to scan'
      const secret = document.querySelector('[data-sec-secret]').textContent.replace(/\\s/g, '')
      if (secret.length < 16) return 'no secret shown'
      // RFC 6238 in the page: base32, HMAC-SHA1 over the 30-second step, six digits.
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      let bits = ''
      for (const ch of secret) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
      const key = new Uint8Array(Math.floor(bits.length / 8)).map((_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2))
      const counter = new ArrayBuffer(8)
      new DataView(counter).setUint32(4, Math.floor(Date.now() / 30000))
      const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
      const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, counter))
      const o = mac[19] & 15
      const code = String((((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1e6).padStart(6, '0')
      const box = document.querySelector('[data-sec-otp]')
      const confirm = document.querySelector('[data-sec-otp-confirm]')
      if (!confirm.disabled) return 'Confirm was live before a code was typed'
      type(box, code)
      await sleep(100)
      if (confirm.disabled) return 'Confirm stayed disabled with six digits in the box'
      confirm.click()
      await sleep(1200)
      const panel = document.querySelector('[data-sec-enrol]')
      if (panel && panel.offsetParent !== null) return 'the enrolment panel stayed open: "' + document.querySelector('[role=status], .toast')?.textContent + '"'
      type(cur, '')
      return 'ok'
    })()`, 1800))

  // Two tabs on one post: the tab holding the older copy saved over the newer one in silence,
  // "Draft saved" on both screens. It is refused now, and says why.
  const TWO = 'tour-two-tabs-one-post'
  flow('two tabs: a post for them to share', () => expect('/admin', `
    (async () => {
      const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour two tabs one post', content: 'As first written.', status: 'draft' }) })
      return r.ok ? 'ok' : 'could not create it: ' + r.status
    })()`))

  flow('two tabs: the one holding an older copy cannot save over the newer', () => expect(`/admin/editor/${TWO}`, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      // The other tab saves first, carrying nothing but its words (as a tab opened later would).
      await sleep(20)
      const other = await fetch('/api/posts/${TWO}', { method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour two tabs one post', content: 'The OTHER tab wrote this.', status: 'draft' }) })
      if (!other.ok) return 'the other tab could not save: ' + other.status
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, ta.value + ' (this tab)')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }))
      await sleep(1200)
      const row = await (await fetch('/api/posts/${TWO}', { cache: 'no-store' })).json()
      const kept = row.data.content.includes('OTHER tab')
      const said = document.body.innerText.includes('somewhere else') || document.body.innerText.includes('nơi khác')
      await fetch('/api/posts/${TWO}', { method: 'DELETE' })
      await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${TWO}'] }) })
      if (!kept) return 'the older copy was saved over the newer one'
      return said ? 'ok' : 'refused, but the screen never said why'
    })()`, 1500))

  // Toggling the Markdown view twice with nothing typed rebuilt the document, which marked the
  // sheet unsaved and armed the exit warning. Nothing changed; nothing is to be saved.
  flow('editor: looking at the Markdown and back changes nothing', () => expect('/admin/editor/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const save = document.querySelector('[data-sheet-save]')
      const md = document.querySelector('[data-sheet-md]')
      if (!save || !md) return 'no Save or Markdown key'
      if (!save.disabled) return 'Save was live before anything was typed'
      md.click(); await sleep(300); md.click(); await sleep(300)
      return save.disabled ? 'ok' : 'two presses of the Markdown key left the piece unsaved'
    })()`, 1500))

  // A title fixed while a save was in the air was marked saved: only the body was compared, so
  // the fix was neither sent nor kept, and leaving the page raised no warning.
  const AIR = 'tour-edited-in-the-air'
  flow('in the air: a post for it', () => expect('/admin', `
    (async () => {
      const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour edited in the air', content: 'Words.', status: 'draft' }) })
      return r.ok ? 'ok' : 'could not create it: ' + r.status
    })()`))

  flow('in the air: a field changed during a save keeps the piece unsaved', () => expect(`/admin/editor/${AIR}`, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const real = window.fetch
      window.fetch = async (url, init) => {
        if (init && init.method === 'PUT') await sleep(900)
        return real(url, init)
      }
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      const type = (v) => { set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })) }
      type('Tour edited in the air, first')
      await sleep(150)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }))
      await sleep(250)
      type('Tour edited in the air, fixed while saving')
      await sleep(1500)
      window.fetch = real
      const save = document.querySelector('[data-sheet-save]')
      const verdict = save.disabled ? 'the title fixed during the save was marked saved' : 'ok'
      await fetch('/api/posts/${AIR}', { method: 'DELETE' })
      await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${AIR}'] }) })
      return verdict
    })()`, 1500))
}
