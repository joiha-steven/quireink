// WHICH SENTENCE A GREEN LAMP GETS, after a card's own Save.
//
// The colour was never the bug. `connectionOk` reads "Saved, and the far end answered", and the
// island printed it for every successful save — including the ones where `tried()` returned
// early because the card had no test route at all, and the ones where its gate found nothing to
// try. A card that stores a switch was reporting that a service had replied to it.
//
// Nothing the SERVER draws may say it either (`web/admin/screens/settings-safety.test.ts`);
// this is the other half, for the one place that can legitimately know.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { goodTitle, tried, type CardWords } from './lib/settings-cards'

const t = adminT('en')
const w: CardWords = {
  connectionOk: t.connectionOk,
  connectionUntested: t.connectionUntested,
  connectionOn: t.connectionOn,
}

describe('what a green lamp says', () => {
  it('claims a reply only when something was actually asked', () => {
    expect(goodTitle(w, true, true)).toBe(t.connectionOk)
  })

  it('says saved-but-untried for a far end nobody asked', () => {
    // The gate in `tried()` returns `{ ok: true }` without calling anything when the card has
    // nothing to try yet. That is a success, and it is not an answer.
    expect(goodTitle(w, false, true)).toBe(t.connectionUntested)
  })

  it('says simply on for a card with no far end', () => {
    expect(goodTitle(w, false, false)).toBe(t.connectionOn)
  })

  it('never says the far end answered unless it was asked', () => {
    // The counter-test, and the shape of the bug: every `asked: false` route must avoid that
    // one sentence, whatever else it picks.
    for (const hasFarEnd of [true, false]) {
      expect(goodTitle(w, false, hasFarEnd)).not.toBe(t.connectionOk)
    }
  })

  it('answers with a string even when a word is missing from the wire', () => {
    expect(goodTitle({}, true, true)).toBe('')
    expect(goodTitle({}, false, false)).toBe('')
  })
})

// AND WHAT FEEDS IT. `goodTitle` is only as honest as the flag it is handed: with `tried()`
// returning `asked: true` from its early exits, every assertion above still passes and the lamp
// lies again. This is the wiring, and it is why `tried` was lifted out of the click handler.
describe('whether a card actually asked anybody', () => {
  beforeAll(() => GlobalRegistrator.register())
  afterAll(() => GlobalRegistrator.unregister())

  const card = (attrs: Record<string, string>, field = ''): HTMLElement => {
    const el = document.createElement('div')
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    if (field) el.innerHTML = `<input data-card-field="${field}" value="">`
    return el
  }
  const noLogin = (): void => { throw new Error('should not have been sent to the login page') }
  const answering = (body: unknown, status = 200) => {
    const before = globalThis.fetch
    // `as unknown as typeof fetch`: the real signature carries `preconnect`, which nothing here
    // calls and which a stub has no business inventing.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
    return () => { globalThis.fetch = before }
  }

  it('says it asked nobody when the card has no test route', async () => {
    const restore = answering({ success: true })
    try {
      expect(await tried(card({}), noLogin)).toEqual({ ok: true, asked: false })
    } finally { restore() }
  })

  it('says it asked nobody when the gate finds nothing to try', async () => {
    const restore = answering({ success: true })
    try {
      // A route, a gate field, and the field is empty with nothing stored: an install with no
      // bucket is not broken, so nothing is sent — and nothing answered.
      const el = card({ 'data-card-test': '/api/try', 'data-card-test-when': 'bucket' }, 'bucket')
      expect(await tried(el, noLogin)).toEqual({ ok: true, asked: false })
    } finally { restore() }
  })

  it('says it asked when a route answered, and carries the answer', async () => {
    let restore = answering({ success: true })
    try {
      const res = await tried(card({ 'data-card-test': '/api/try' }), noLogin)
      expect(res.asked).toBe(true)
      expect(res.ok).toBe(true)
    } finally { restore() }
    // ⚠️ AND A REFUSAL IS STILL AN ANSWER. `asked` is about whether anybody was contacted, not
    // about whether they were happy: a far end that said no has still spoken.
    restore = answering({ success: false, error: 'ENOTFOUND' })
    try {
      const res = await tried(card({ 'data-card-test': '/api/try' }), noLogin)
      expect(res).toEqual({ ok: false, error: 'ENOTFOUND', asked: true })
    } finally { restore() }
  })

  it('sends an expired session to the login page rather than reporting a reply', async () => {
    const restore = answering({}, 401)
    let sent = false
    try {
      const res = await tried(card({ 'data-card-test': '/api/try' }), () => { sent = true })
      expect(sent).toBe(true)
      expect(res.ok).toBe(false)
      expect(res.asked).toBeUndefined()
    } finally { restore() }
  })
})
