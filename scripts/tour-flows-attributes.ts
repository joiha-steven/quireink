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
