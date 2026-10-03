// PASSKEYS, end to end in a real browser (ADR 0071): added in the security card, used on the
// sign-in page, the session it makes opening the admin, and removed again.
//
// Chrome's virtual authenticator stands in for a fingerprint reader (`tour-webauthn.ts`), and the
// flows run on `localhost` because no browser makes a passkey for an IP address. What this proves
// that `src/web/passkeys.test.ts` cannot: that a REAL browser's attestation and assertion, from an
// implementation that is not ours, verify on the server, and that the two islands drive the
// ceremonies the way an owner would.
//
// (No backticks inside the page scripts below: each is one template literal.)
import type { PasskeyTour } from './tour'

/** The seeded owner's password (`scripts/seed-showcase.ts`). Adding and removing ask for it. */
const PASSWORD = 'quartz-lantern-47-thicket'

/** Types into a box the way a person does, so the card's listeners hear it. */
const TYPE = `const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      const type = (el, v) => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))`

export function registerPasskeyFlows({ flow, expect, passkeyHost }: Pick<PasskeyTour, 'flow' | 'expect' | 'passkeyHost'>): void {
  flow('admin: a passkey is added from the security card, with the password (ADR 0071)', async () => {
    const at = await passkeyHost(true)
    if ('skip' in at) return `skip: ${at.skip}`
    return expect(`${at.host}/admin/settings?tab=account`, `
    (async () => {
      ${TYPE}
      const cur = document.querySelector('[data-security-current]')
      if (!cur) return 'no security card on localhost, at ' + location.pathname
      let bound = null
      for (let i = 0; i < 40; i++) {
        bound = document.querySelector('[data-sec-passkeys-bound]')
        if (bound && !bound.hidden) break
        await sleep(100)
      }
      if (!bound || bound.hidden) return 'the card never said which address its passkeys belong to'
      if (!/localhost/.test(bound.textContent)) return 'the address sentence names something else: ' + bound.textContent
      const add = document.querySelector('[data-sec-passkey-add]')
      if (!add.disabled) return 'the add key was live before the password was typed'
      type(cur, '${PASSWORD}')
      type(document.querySelector('[data-sec-passkey-name-box]'), 'Tour key')
      await sleep(100)
      if (add.disabled) return 'the add key stayed off with the password typed'
      add.click()
      for (let i = 0; i < 80; i++) {
        const row = [...document.querySelectorAll('[data-security-passkey]')].find((r) => /Tour key/.test(r.textContent))
        if (row) {
          type(cur, '')
          if (!row.querySelector('[data-sec-passkey-never]') || row.querySelector('[data-sec-passkey-never]').hidden) return 'a passkey never used does not say so'
          return 'ok'
        }
        await sleep(100)
      }
      return 'no passkey row appeared in 8 seconds'
    })()`, 1500)
  })

  // CONDITIONAL UI. The virtual authenticator answers the autofill's request as soon as the page
  // makes it, standing in for the person picking the passkey from the username box, and the island
  // then goes where the server said. So the evidence is where the page ended up and where it came
  // from: `/admin`, reached from `/login` by the island, with nothing typed. The settle is long
  // because the navigation must be over before the script runs, or it would end the script.
  flow('login: the passkey in the username box\'s autofill signs in by itself (ADR 0071)', async () => {
    const at = await passkeyHost(false)
    if ('skip' in at) return `skip: ${at.skip}`
    return expect(`${at.host}/login`, `
    (async () => {
      if (location.pathname === '/login') {
        const err = document.querySelector('[data-passkey-error]')
        return 'still on the sign-in page' + (err && !err.hidden ? ': ' + err.textContent : '')
      }
      return location.pathname === '/admin' && /\\/login$/.test(document.referrer)
        ? 'ok' : 'ended at ' + location.href + ' from ' + document.referrer
    })()`, 2500)
  })

  // THE BUTTON, in a browser with no conditional UI (the verb makes the pages say so).
  flow('login: the passkey button signs in where there is no autofill, with no code screen (ADR 0071)', async () => {
    const at = await passkeyHost(false, { noAutofill: true })
    if ('skip' in at) return `skip: ${at.skip}`
    return expect(`${at.host}/login`, `
    (async () => {
      ${TYPE}
      if (location.pathname !== '/login') return 'signed out on localhost, and still sent to ' + location.href
      const door = document.querySelector('[data-passkey]')
      if (!door) return 'the sign-in page offers no passkey with one on file'
      for (let i = 0; i < 20 && door.hidden; i++) await sleep(50)
      if (door.hidden) return 'the passkey door stayed hidden in a browser that has WebAuthn'
      if (!/webauthn/.test(document.querySelector('#username').getAttribute('autocomplete'))) return 'the username box does not offer passkeys in its autofill'
      // The island goes where the server says on success, and a real navigation would end this
      // script before it could report. A fragment is a navigation that keeps the page: the cookie
      // is still set by the real response, which the next flow checks.
      const real = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const res = await real(input, init)
        if (!String(input).endsWith('/api/auth/passkey')) return res
        const body = await res.clone().json()
        if (body.status === 'ok') body.location = '#passkey-signed-in'
        return new Response(JSON.stringify(body), { status: res.status, headers: { 'content-type': 'application/json' } })
      }
      document.querySelector('[data-passkey-go]').click()
      for (let i = 0; i < 80; i++) {
        if (location.hash === '#passkey-signed-in') return 'ok'
        const err = document.querySelector('[data-passkey-error]')
        if (err && !err.hidden) return 'the passkey was refused: ' + err.textContent
        await sleep(100)
      }
      return 'nothing happened in 8 seconds'
    })()`, 1200)
  })

  flow('login: the passkey\'s session opens the admin by itself (ADR 0071)', async () => {
    const at = await passkeyHost()
    if ('skip' in at) return `skip: ${at.skip}`
    return expect(`${at.host}/admin`, `
    (async () => location.pathname.startsWith('/admin') && !document.querySelector('form[action="/api/auth/login"]')
      ? 'ok' : 'the session the passkey made did not open the admin: ' + location.pathname + location.search)()`)
  })

  flow('admin: a passkey is removed, asked first and with the password (ADR 0071)', async () => {
    const at = await passkeyHost()
    if ('skip' in at) return `skip: ${at.skip}`
    return expect(`${at.host}/admin/settings?tab=account`, `
    (async () => {
      ${TYPE}
      const find = () => [...document.querySelectorAll('[data-security-passkey]')].find((r) => /Tour key/.test(r.textContent))
      let row = null
      for (let i = 0; i < 40 && !row; i++) { row = find(); if (!row) await sleep(100) }
      if (!row) return 'the passkey added earlier is not listed'
      const remove = row.querySelector('[data-sec-passkey-remove]')
      if (!remove.disabled) return 'remove was live before the password was typed'
      type(document.querySelector('[data-security-current]'), '${PASSWORD}')
      await sleep(100)
      remove.click()
      let yes = null
      for (let i = 0; i < 30 && !yes; i++) {
        await sleep(100)
        yes = [...document.querySelectorAll('[data-confirm-yes]')].find((b) => b.offsetParent !== null) || null
      }
      if (!yes) return 'the passkey was removed without asking first'
      yes.click()
      for (let i = 0; i < 40; i++) {
        if (!find()) { type(document.querySelector('[data-security-current]'), ''); return 'ok' }
        await sleep(100)
      }
      return 'the row is still there'
    })()`, 1500)
  })
}
