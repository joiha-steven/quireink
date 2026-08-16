// The owner's half of the tour. Split from `tour-flows.ts` when that file passed the 400-line
// ceiling, on the same seam the file itself was split from `tour.ts`: by READER. This one needs
// the session cookie and knows the admin's markup; the public half knows neither.
//
// Every assertion runs in the page and returns `ok`, `ok <detail>`, `skip: <why>`, or the reason
// it is not ok. A flow that WRITES cleans up after itself.

import type { Tour } from './tour'
import { registerEditorFlows } from './tour-flows-editor'

export function registerAdminFlows({ flow, expect, atWidth }: Tour): void {

  const ADMIN_PAGES: [string, string][] = [
    ['/admin', 'dashboard'],
    ['/admin/content', 'content list'],
    ['/admin/media', 'library'],
    ['/admin/comments', 'comments'],
    ['/admin/newsletter', 'newsletter'],
    ['/admin/analytics', 'analytics'],
    ['/admin/log', 'activity log'],
    ['/admin/trash', 'trash'],
    ['/admin/settings', 'settings'],
    ['/admin/help', 'help'],
  ]

  for (const [path, label] of ADMIN_PAGES) {
    flow(`admin: ${label} renders`, () => expect(path, `
      (() => {
        // The MARKER, not the word: the Help page's troubleshooting table has a row about a URL
        // that 404s, and matching the text called a working page broken.
        if (document.querySelector('[data-admin-404]')) return 'the admin router found nothing'
        if (/Sign in|Đăng nhập/.test(document.body.innerText)) return 'bounced to the sign-in page'
        // The shell alone is not the page: every admin screen puts something past the nav.
        const main = document.querySelector('main') ?? document.body
        return main.innerText.trim().length > 30 ? 'ok' : 'rendered the shell and nothing else'
      })()`, 900))
  }

  // The Overview could not survive a phone and nothing said so: at 375px its `scrollWidth` was
  // 422, so 47px of the page was reachable only by dragging it sideways. The cause is a grid
  // item's automatic minimum size — a `truncate` row's min-content is its full untruncated
  // headline, so the widget track refused to go below 406px inside a 343px grid.
  //
  // ⚠️ `atWidth`, and the first version of this flow is why. It squeezed the GRID's own width
  // instead of the viewport, ran green against a build with the bug still in it, and would have
  // shipped as a guard over nothing: the one-column layout is a `lg:` media query, so a narrow
  // BOX still lays out as two columns and no track ever has to hold a whole card.
  //
  // The rule that catches this: a new guard is not finished until it has been watched to FAIL
  // on the broken build.
  flow('admin: the dashboard fits a phone', () => atWidth(375, '/admin', `
    (() => {
      // The whole PAGE, not one card: the symptom is the Overview scrolling sideways, and the
      // element responsible has already moved once. scrollWidth on the DOCUMENT sees this;
      // scrollWidth on a grid whose overflow is visible does not, which cost one green run.
      // (No backticks in here — this string is itself a template literal.)
      const doc = document.documentElement
      const spill = doc.scrollWidth - doc.clientWidth
      if (spill > 1) {
        const grid = document.querySelector('.grid.lg\\\\:grid-cols-2')
        const track = grid ? getComputedStyle(grid).gridTemplateColumns : '?'
        return 'the dashboard scrolls sideways by ' + spill + 'px at ' + doc.clientWidth + 'px (widget track ' + track + ')'
      }
      return 'ok no sideways scroll at ' + doc.clientWidth + 'px'
    })()`, 1200))

  flow('admin: the settings tabs all have content', () => expect('/admin/settings', `
    (async () => {
      const empty = []
      for (const label of ['Site','Layout','Reading','Appearance','Search & URLs','Connections','System']) {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label)
        if (!b) { empty.push(label + ' (no tab)'); continue }
        b.click()
        await new Promise((r) => setTimeout(r, 250))
        const cards = document.querySelectorAll('h2, h3').length
        if (cards === 0) empty.push(label + ' (no cards)')
      }
      return empty.length ? empty.join(', ') : 'ok'
    })()`, 1000))

  flow('admin: the Storage card offers both limits', () => expect('/admin/settings', `
    (async () => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'System')
      if (!b) return 'no System tab'
      b.click()
      await new Promise((r) => setTimeout(r, 300))
      const n = document.querySelectorAll('input[type=number][max="4096"]').length
      return n === 2 ? 'ok' : 'found ' + n + ' storage fields, expected 2'
    })()`, 1000))

  flow('admin: settings save and come back', () => expect('/admin/settings', `
    (async () => {
      // No GET /api/settings exists — PUT is the only verb, and the admin reads settings through
      // its view endpoint. Both are used here: the view to read, the response to confirm.
      const read = async () => (await (await fetch('/api/admin/view/settings')).json())?.data?.settings?.excerptLength
      const before = await read()
      const target = before === 42 ? 43 : 42
      const put = await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ excerptLength: target }),
      })
      if (!put.ok) return 'PUT /api/settings -> ' + put.status
      const after = await read()
      await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ excerptLength: before }),
      })
      return after === target ? 'ok' : 'wrote ' + target + ', read back ' + after
    })()`, 900))

  // The editor half, next door — see its header for the seam.
  registerEditorFlows({ flow, expect, atWidth })

  flow('admin: the trash takes a post and gives it back', () => expect('/admin/trash', `
    (async () => {
      const slug = 'tour-trash-' + Date.now()
      await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour trash', slug, content: 'x', status: 'draft', categories: [], tags: [] }),
      })
      await fetch('/api/posts/' + slug, { method: 'DELETE' })
      const gone = await fetch('/' + slug)
      const trashed = await (await fetch('/api/admin/view/trash')).json()
      const inTrash = (trashed?.data?.posts ?? []).some((p) => p.slug === slug)
      const back = await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'restore', ids: [slug] }),
      })
      await fetch('/api/posts/' + slug, { method: 'DELETE' })
      if (gone.status !== 404) return 'a trashed post still answers ' + gone.status
      if (!inTrash) return 'the post was not listed in the trash'
      return back.ok ? 'ok' : 'restore -> ' + back.status
    })()`, 900))

  flow('admin: an oversized upload is refused with a reason', () => expect('/admin/media', `
    (async () => {
      const before = await (await fetch('/api/settings')).json()
      const keep = before?.data?.maxUploadMb ?? 0
      await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxUploadMb: 1 }),
      })
      const form = new FormData()
      form.append('file', new File([new Uint8Array(2 * 1024 * 1024)], 'huge.png', { type: 'image/png' }), 'huge.png')
      const r = await fetch('/api/media/upload', { method: 'POST', body: form })
      const body = await r.json().catch(() => ({}))
      await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxUploadMb: keep }),
      })
      if (r.status !== 413) return 'expected 413, got ' + r.status
      return body.error === 'file_too_large' ? 'ok' : 'refused with ' + JSON.stringify(body)
    })()`, 900))

  flow('admin: a real image uploads and lists', () => expect('/admin/media', `
    (async () => {
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
      const form = new FormData()
      form.append('file', new File([png], 'tour.png', { type: 'image/png' }), 'tour.png')
      const r = await fetch('/api/media/upload', { method: 'POST', body: form })
      if (!r.ok) return '/api/media/upload -> ' + r.status
      const items = (await r.json())?.data ?? []
      const url = items[0]?.url
      if (!url) return 'upload returned no url'
      const served = await fetch(url)
      await fetch('/api/media/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: [url] }),
      })
      return served.ok ? 'ok' : 'the stored image answered ' + served.status
    })()`, 900))

  flow('admin: the cache can be cleared', () => expect('/admin', `
    (async () => {
      const r = await fetch('/api/cache/clear', { method: 'POST' })
      return r.ok ? 'ok' : '/api/cache/clear -> ' + r.status
    })()`, 900))

  flow('admin: the backup archive builds', () => expect('/admin/settings', `
    (async () => {
      const r = await fetch('/api/backup/export')
      if (!r.ok) return '/api/backup/export -> ' + r.status
      const buf = await r.arrayBuffer()
      // A gzip member starts 1f 8b. An empty or HTML answer would not.
      const head = new Uint8Array(buf.slice(0, 2))
      return head[0] === 0x1f && head[1] === 0x8b
        ? 'ok (' + Math.round(buf.byteLength / 1024) + ' KB)'
        : 'the archive was not gzip: ' + buf.byteLength + ' bytes'
    })()`, 900))

  // The search exists because seven defined tabs still left the owner hunting. Two flows:
  // one that it WORKS, one that it is COMPLETE — and the second is the one that matters over
  // time, because a hand-written index rots silently and a search that cannot find a setting
  // teaches you the setting is not there.
  flow('admin: the settings search finds a setting and opens its tab', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const box = document.querySelector('input[type=search]')
      if (!box) return 'no search box on the settings screen'
      const setValue = (v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // A word from the System tab, typed while the Site tab is open: the point is crossing.
      setValue('backup')
      await sleep(300)
      const row = document.querySelector('main ul li button')
      if (!row) return 'no result for "backup"'
      const label = row.textContent.trim()
      row.click()
      await sleep(900)
      const marked = document.querySelector('.setting-found')
      if (!marked) return 'clicked "' + label + '" and nothing was marked'
      const box2 = marked.getBoundingClientRect()
      if (box2.top < -40 || box2.top > innerHeight) return 'marked "' + marked.textContent.trim() + '" off screen'
      return 'ok (' + marked.textContent.trim().slice(0, 30) + ')'
    })()`, 1200))

  // ADR 0024, step 1, in one assertion: a phrase the owner remembers writing, inside a post
  // whose TITLE carries no word of it. The filter this replaces matched title, tags and
  // categories over an array in the browser, so this row could not have appeared before —
  // and the flow refuses to pass on a title match, because that is what used to work.
  flow('admin: the content search reaches into the body of a post', () => expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const box = document.querySelector('input[type=search]')
      if (!box) return 'no search box on the content screen'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(box, 'widen the leading')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(800)
      const rows = [...document.querySelectorAll('tbody tr')]
      if (!rows.length) return 'searching a body phrase listed no post at all'
      const titles = rows.map((r) => (r.querySelector('a') || {}).textContent || '')
      if (titles.some((t) => /widen|leading/i.test(t))) return 'a TITLE carries the words, so this proves nothing'
      if (!/leading/i.test(rows[0].textContent || '')) return 'the row showed no matching line, only its title'
      return 'ok (' + titles[0] + ')'
    })()`, 1200))

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
      const labels = new Set()
      const tabs = [...document.querySelectorAll('button')].filter((b) => b.closest('[class*="bg-neutral-200"]'))
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

  // The owner asked for it in two halves and the second is the one that gets forgotten:
  // shown the first time, and reachable afterwards. A tour you can never re-open is a tour
  // you have to remember, which is the problem it exists to solve.
  flow('admin: the first-run steps show, dismiss, and come back', () => expect('/admin', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const put = (body) => fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      // No reload to set this up: a reload tears down the very evaluation this flow IS, and
      // the verdict comes back empty. The seeded instance has never dismissed anything, so
      // the card is on screen already; the flow puts it back that way on the way out.
      const steps = document.querySelectorAll('main ol li p')
      if (steps.length !== 5) return 'expected 5 first-run steps, saw ' + steps.length
      // Every step is a link, and a link to a tab that exists — the four that pointed at a
      // deleted tab shipped for two weeks without anything noticing.
      const hrefs = [...document.querySelectorAll('main ol li a')].slice(0, 5).map((a) => a.getAttribute('href'))
      // Compared against a list, NOT a regex: this whole flow is a template literal, so a
      // \\b in it is a backspace character long before it is a word boundary, and the first
      // version called two perfectly good links dead.
      const TABS = ['site','layout','reading','appearance','seo','connections','system']
      const bad = hrefs.filter((h) => h.includes('tab=') && !TABS.includes(h.split('tab=')[1]))
      if (bad.length) return 'step links at a tab that does not exist: ' + bad.join(', ')

      const dismiss = document.querySelector('[data-first-run-dismiss]')
      if (!dismiss) return 'no dismiss button under the steps'
      dismiss.click()
      await sleep(700)
      if (document.querySelector('main ol li p')) return 'dismissing left the steps on screen'

      const saved = (await (await fetch('/api/admin/view/dashboard')).json())?.data?.firstRunDone
      if (saved !== true) return 'dismissal did not reach the settings (firstRunDone=' + saved + ')'

      const reopen = document.querySelector('[data-first-run-reopen]')
      if (!reopen) return 'dismissed and left no way back'
      reopen.click()
      await sleep(400)
      const back = document.querySelectorAll('main ol li p').length
      await put({ firstRunDone: false })
      return back === 5 ? 'ok' : 'reopening showed ' + back + ' steps'
    })()`, 1500))

  flow('the owner gate refuses a write with no session', () => expect('/', `
    (async () => {
      // Same-origin, but the cookie is stripped: an owner route must still answer 401.
      const r = await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'nope' }), credentials: 'omit',
      })
      return r.status === 401 ? 'ok' : 'a cookieless write got ' + r.status
    })()`))
}
