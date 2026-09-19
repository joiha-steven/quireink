// THE ATTRIBUTES PANEL, driven with a keyboard.
//
// Its own file because the panel is a different subject from the sheet's furniture: it is the
// piece's METADATA — the slug, the date, the terms, the pictures — standing beside the writing
// rather than over it, and every control in it is a field somebody types into. That is also why
// these flows are worth having: a unit test can prove a date parses and cannot prove the field
// holding it can be typed into at all.
import type { Tour } from './tour'

export function registerAttributeFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * THE PUBLISH DATE CAN BE TYPED, which it could not be until 2026-09-15.
   *
   * The field was a button that opened a calendar, and the calendar's only way to another month
   * was a pair of arrows: nine clicks to reach next March, twelve to correct a year. It takes
   * writing now, in the admin language's own day/month order — and that order is why this flow
   * reads the placeholder instead of assuming one. `04/03` is April 3rd to an English admin and
   * March 4th to a Vietnamese one; a probe that assumes reports a correct save as a wrong date,
   * which is what the first version of this did.
   */
  flow('editor: the publish date can be typed, not only clicked at', async () => {
    const slug = 'tour-date-' + Date.now()
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a date', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'A piece with a publish date.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post'
    })()`, 900)
    if (made !== 'ok') return made

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      const pm = await wait(() => document.querySelector('.ProseMirror'), 140)
      if (!pm) return done('the editor never opened')
      const sheet = document.querySelector('.admin-enter') || document.body
      const seen = (el) => el && el.offsetParent !== null

      const attrs = [...sheet.querySelectorAll('button')].filter(seen).find((b) => b.hasAttribute('data-attrs'))
      if (!attrs) return done('no key for the attributes panel')
      attrs.click()
      // The panel is not asked for by role: it drops the dialog role when it DOCKS beside the
      // paper, because it is not modal then and saying so would be a lie to a screen reader.
      // This flow runs at 1700, which is docked, so it looks for the field itself.
      // (No backticks anywhere in here: this whole expression is a template literal.)
      await sleep(700)

      // No regex literal in here either: a backslash is eaten before the browser sees it, so
      // an escaped slash arrives unterminated and the flow dies with a bare Uncaught.
      const field = [...document.querySelectorAll('input')].filter(seen).find((el) => {
        const shape = el.getAttribute('placeholder') || ''
        return shape.indexOf('dd/') === 0 || shape.indexOf('mm/') === 0
      })
      if (!field) return done('the publish date is not a field anybody can type in')

      const shape = field.getAttribute('placeholder') || ''
      const put = (text) => {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set
        setter.call(field, text)
        field.dispatchEvent(new Event('input', { bubbles: true }))
      }

      // A date that does not exist must be refused rather than quietly moved to the next month.
      put('31/2/2027')
      await sleep(200)
      if (field.getAttribute('aria-invalid') !== 'true') return done('the 31st of February was accepted')

      put('04/03/2027 09:30')
      field.dispatchEvent(new Event('blur', { bubbles: true }))
      await sleep(400)
      if (field.value !== '04/03/2027 09:30') return done('the box did not keep what was typed: ' + field.value)

      const save = [...sheet.querySelectorAll('button')].filter(seen).find((b) => /save|lưu/i.test(b.textContent))
      if (!save) return done('no key to save with')
      save.click()
      await sleep(1800)

      const body = await (await fetch('/api/posts/${slug}', { headers: { accept: 'application/json' } })).json()
      const held = (body && body.data ? body.data : body).date || ''
      const want = shape.indexOf('mm') === 0 ? '2027-04-03' : '2027-03-04'
      if (held.indexOf(want) !== 0) return done('typed 04/03/2027 into a ' + shape + ' field and the server holds ' + held)
      return done('ok typed into a ' + shape + ' field, stored ' + held.slice(0, 16))
    })()`, 1600)
  })
}

/**
 * THE LANGUAGE PAIR, PRESSED (ADR 0056).
 *
 * `translations.test.ts` proves the rule and the two documents. What it cannot prove is that
 * the two controls exist on the panel, are reachable, and carry what the owner typed all the
 * way to the page — which is three separate wires and the place this feature would fail
 * silently: a select drawn with no `data-k` saves nothing and looks perfect.
 *
 * ⚠️ IT CLEANS UP AFTER ITSELF. The flows after this one read the same fixture, and a post left
 * behind in English with a translation group changes what they are testing.
 */
export function registerLanguageFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  flow('editor: a piece can say what language it is in, and who its translations are', async () => {
    const group = 'tour-tr-' + Date.now()
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const panel = [...document.querySelectorAll('button')]
        .find((b) => /attributes|thuộc tính/i.test(b.textContent || ''))
      if (panel) { panel.click(); await sleep(500) }

      const pick = document.querySelector('select[data-k="lang"]')
      if (!pick) return 'no language select on the panel'
      if (pick.offsetParent === null) return 'the language select is in the markup but not on screen'
      // Eleven languages and "same as the blog", and the empty value has to be FIRST: it is
      // what every piece already written has, and a list that opens on Deutsch is a list that
      // sets Deutsch on the next piece somebody tabs through.
      if (pick.options.length < 12) return 'the language select offers ' + pick.options.length
      if (pick.options[0].value !== '') return 'the first option is not "same as the blog"'

      const box = document.querySelector('[data-k="translationGroup"]')
      if (!box) return 'no translation group field'

      const title = document.querySelector('[data-sheet-title], input[data-k="title"], h1[contenteditable]')
      if (title) {
        title.textContent = 'Tour language'
        title.value = 'Tour language'
        title.dispatchEvent(new Event('input', { bubbles: true }))
      }
      pick.value = 'en'
      pick.dispatchEvent(new Event('change', { bubbles: true }))
      box.value = ${JSON.stringify('PLACEHOLDER')}
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)

      const save = [...document.querySelectorAll('button')]
        .find((b) => /^(save draft|lưu nháp)$/i.test((b.textContent || '').trim()))
      if (!save) return 'no save key'
      save.click()
      await sleep(1400)
      return 'saved at ' + location.pathname
    })()`.replace('"PLACEHOLDER"', JSON.stringify(group)), 3000)
    if (!String(made).startsWith('saved at /admin/editor/')) return String(made)

    const slug = String(made).replace('saved at /admin/editor/', '')
    // Back through the server: the panel has to READ what the save wrote, which is the other
    // half of the wire and the half a save-only probe cannot see.
    const read = await atWidth(1700, `/admin/editor/${slug}`, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const panel = [...document.querySelectorAll('button')]
        .find((b) => /attributes|thuộc tính/i.test(b.textContent || ''))
      if (panel) { panel.click(); await sleep(500) }
      const pick = document.querySelector('select[data-k="lang"]')
      const box = document.querySelector('[data-k="translationGroup"]')
      return JSON.stringify({ lang: pick && pick.value, group: box && box.value })
    })()`, 2500)
    const back = JSON.parse(String(read))
    if (back.lang !== 'en') return `the language came back as ${JSON.stringify(back.lang)}`
    if (back.group !== group) return `the group came back as ${JSON.stringify(back.group)}`

    await atWidth(1700, `/admin/editor/${slug}`, `
    (async () => {
      await fetch('/api/posts/' + ${JSON.stringify(slug)}, { method: 'DELETE' })
      await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: [${JSON.stringify(slug)}] }),
      })
      return 'gone'
    })()`, 1500)
    return `ok language ${back.lang} and group kept through a save and a reload`
  })
}
