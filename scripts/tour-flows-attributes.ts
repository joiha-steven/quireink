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

/**
 * THE CARD A STANDALONE LINK BECOMES, and the switch that decides (ADR 0058).
 *
 * ⚠️ IT MAKES ITS OWN POST rather than leaning on the seed, because the thing under test is a
 * paragraph of a particular SHAPE — one link, alone — and a flow that depended on some seeded
 * body still having that shape would go quietly green the day somebody edited the seed.
 *
 * It tests the FILE card end to end and not the bookmark card, and the difference is the point:
 * a file card is built from this blog's own `files` table and needs nothing outside the box,
 * where a bookmark card needs a page fetched from the internet. A tour that reached the network
 * would fail on a runner that cannot, and one that stubbed the fetch would be testing the stub.
 * What the bookmark half shares with this one — the paragraph rule, the escaping, the switch —
 * is held by `content/link-cards.test.ts` in milliseconds.
 */
export function registerCardFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('a link alone on its line becomes a card, and the switch decides', () => expect('/admin', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const send = async (url, method, body) => {
        const res = await fetch(url, {
          method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        })
        return { ok: res.ok, json: await res.json().catch(() => null) }
      }
      // The seeded attachment, found rather than assumed: the upload slugifies a filename, so
      // the stored address is not the one the seed typed.
      const files = await (await fetch('/api/files')).json()
      const pdf = (files.data || []).find((f) => /\\.pdf$/.test(f.url))
      if (!pdf) return 'no seeded PDF to link at'

      const slug = 'tour-link-cards'
      // ⚠️ A REAL MARKDOWN LINK, not the bare path. Both become a card — the paragraph rule
      // takes a bare token too, which is how a standalone .mp4 path has been a player since the
      // port — but only the link spelling has something to fall BACK to. A bare path is not a
      // link in Markdown at all, so with the switch off it is the plain text it already was,
      // and the promise worth testing here is the other one: turn the card off and the link the
      // author wrote is exactly what is left.
      const body = 'A line of prose first.\\n\\n[The practice sheet](' + pdf.url + ')'
        + '\\n\\nhttps://nothing-known-about-this.test/page\\n\\nAnd a closing line.'
      const made = await send('/api/posts', 'POST', {
        title: 'Tour: link cards', slug, content: body, status: 'published',
        date: new Date(Date.now() - 60000).toISOString(),
      })
      if (!made.ok) return 'could not make the post: ' + JSON.stringify(made.json)

      // ⚠️ THE ARTICLE, NOT THE DOCUMENT. Every page carries the whole stylesheet inline, and
      // that stylesheet names both card classes — so a search of the page TEXT for a class name
      // is true whether or not any element wears it. The first cut of this flow did exactly
      // that: three of its assertions passed against the CSS, and the fourth then failed saying
      // an unknown URL had become a card when nothing of the kind had happened.
      //
      // (And no backticks in here: this whole script is one template literal. That is the same
      // fault check:css-literal exists for, in a file that check does not read.)
      // ⚠️ no-store, AND THAT IS ABOUT THE HARNESS RATHER THAN THE PRODUCT. A public page is
      // served cache-control: public with a shared-cache window, so this tab is free to answer
      // the second and third fetches of the same URL out of its own HTTP cache — which it did,
      // and the flow reported that a card had survived its switch being turned off when what
      // had survived was a copy of the page from two seconds earlier.
      const read = async () => {
        const res = await fetch('/' + slug, { cache: 'no-store' })
        const text = await res.text()
        const doc = new DOMParser().parseFromString(text, 'text/html')
        const article = doc.querySelector('article')
        return {
          status: res.status,
          bytes: text.length,
          files: article ? article.querySelectorAll('.file-card').length : -1,
          marks: article ? article.querySelectorAll('.link-card').length : -1,
          links: article ? [...article.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
          kind: article ? article.querySelector('.file-card-kind')?.textContent?.trim() ?? '' : '',
          name: article ? article.querySelector('.file-card-name')?.textContent?.trim() ?? '' : '',
          // Carried so a failure says what the page actually held. A flow that reports only
          // "expected one" sends the next reader back to the browser to find out what it got.
          // ⚠️ ONE LINE. The tour prints a verdict per flow, so a message carrying a newline is
          // a message cut off at it — which is how the first three attempts at this reported
          // nothing but the opening tag. String.fromCharCode(10) rather than an escape: this
          // whole script is a template literal, and a backslash-n in it is a real newline in
          // the source the browser is handed, which is a syntax error inside a string.
          // The LAST occurrence of this flow's own opening words: the first is in the meta
          // description, and reporting that one says nothing about what the body rendered as.
          saw: text.slice(Math.max(0, text.lastIndexOf('prose first')), text.lastIndexOf('prose first') + 400)
            .split(String.fromCharCode(10)).join(' '),
        }
      }
      let page = await read()
      if (page.files === -1) return 'the published page has no article element'
      if (page.files !== 1) {
        return page.files + ' file card(s), expected one (HTTP ' + page.status + ', '
          + page.bytes + ' bytes): ' + page.saw
      }
      if (!page.kind || !page.name) return 'the card is missing its kind or its name'
      // ⚠️ THE OTHER LINK STAYS A LINK. Nothing is known about it, and that renders exactly as
      // the feature being switched off renders — one fallback, not two.
      if (page.marks !== 0) return page.marks + ' bookmark card(s) for a URL nothing is known about'
      if (!page.links.some((h) => h && h.includes('nothing-known-about-this.test'))) {
        return 'the unknown link vanished from the article'
      }

      // Now the switch, through the real settings route the admin's Save uses.
      const off = await send('/api/settings', 'PUT', { features: { fileCards: false } })
      if (!off.ok) return 'the settings save was refused'
      await sleep(200)
      page = await read()
      if (page.files !== 0) return 'the card survived its switch being turned off'
      if (!page.links.some((h) => h === pdf.url)) return 'turning the card off lost the link as well'

      await send('/api/settings', 'PUT', { features: { fileCards: true } })
      await sleep(200)
      if ((await read()).files !== 1) return 'the card did not come back'
      // ⚠️ PURGED, NOT TRASHED. A DELETE is a SOFT delete, so a flow that made a post and
      // 'deleted' it leaves a row in the Trash for every flow after it — measured: the trash
      // screen went from 28 rows to 29 the first time this ran. A flow that changes the shared
      // instance puts it back, which is why the settings switch above is restored too.
      await fetch('/api/posts/' + slug, { method: 'DELETE' })
      await send('/api/trash', 'POST', { kind: 'posts', action: 'purge', ids: [slug] })
      return 'ok card -> plain link -> card, and the unknown URL stayed a link throughout'
    })()`, 2500))
}
