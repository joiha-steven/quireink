// The list screens the SERVER draws (ADR 0054): the trash today, the rest as they convert.
//
// Its own file because `tour-flows-admin.ts` and `tour-flows-settings.ts` are both within a
// couple of lines of the 400-line ceiling, and because the seam is real: every flow here asks
// the same question of a different screen — did the server draw it, and does the island do the
// screen's work over rows that were already in the markup.
//
// ⚠️ THESE FLOWS ARE THE ONLY THING THAT CHECKS THE ISLAND AT ALL. An island is a plain-TS
// entry with no React and no mount test: `check:all` can prove it compiles and nothing else, so
// a tab strip that stopped switching, or a search that quietly started folding both sides, would
// be green everywhere except here.
import type { Tour } from './tour'

export function registerListFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  // THE SCREEN ARRIVES FINISHED. Not "eventually renders" — the markup that comes off the wire
  // already holds the heading, all seven kinds and every row, which is the whole claim of the
  // conversion and the one thing a client-side assertion cannot distinguish from React having
  // been fast. So the flow fetches the page as TEXT and reads the bytes.
  // NOTE: a template literal. No backticks.
  flow('admin: the trash arrives finished, without React drawing it', () => expect('/admin/trash', `
    (async () => {
      const html = await (await fetch('/admin/trash')).text()
      if (!html.includes('data-screen="trash"')) return 'the server did not draw the trash'
      if (!html.includes('data-admin-screen="trash"')) return 'the page did not tell React to stand down'
      const panels = (html.match(/data-trash-panel=/g) || []).length
      if (panels !== 7) return 'expected seven kinds in the markup, found ' + panels
      // Every row of every kind, not just the open one: that is what makes a tab switch free.
      const inMarkup = (html.match(/data-trash-row/g) || []).length
      const onScreen = document.querySelectorAll('[data-trash-row]').length
      if (inMarkup !== onScreen) return 'markup held ' + inMarkup + ' rows, the page shows ' + onScreen
      // React owns no route for this address any more.
      const screens = document.documentElement.getAttribute('data-admin-screens') || ''
      if (!screens.includes('/admin/trash')) return 'the trash is not listed as a server screen'
      return 'ok seven kinds, ' + inMarkup + ' row(s), all of it in the first response'
    })()`, 900))

  // THE STRIP SWITCHES WITHOUT A ROUTE, and the address follows it — which is load-bearing
  // rather than cosmetic: every write on this screen ends in a reload, so a kind held only in
  // the page would put the owner back on Posts after emptying the picture trash.
  flow('admin: the trash swaps kinds in a frame, and the address remembers which', () => expect('/admin/trash', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const root = document.querySelector('[data-screen="trash"]')
      if (!root) return 'the trash was not server-drawn'
      const shown = () => [...document.querySelectorAll('[data-trash-panel]')]
        .filter((p) => !p.hidden).map((p) => p.getAttribute('data-trash-panel'))
      if (shown().length !== 1) return 'expected one kind on screen, found ' + shown().length
      const media = document.querySelector('[data-tab="media"]')
      if (!media) return 'no Pictures tab'
      media.click()
      await sleep(200)
      if (shown().join() !== 'media') return 'clicking Pictures showed ' + shown().join()
      if (media.getAttribute('aria-pressed') !== 'true') return 'the pressed tab did not move'
      if (!location.search.includes('tab=media')) return 'the address did not follow: ' + location.search
      // And the server draws that same kind when the address is asked for cold.
      const cold = await (await fetch('/admin/trash?tab=media')).text()
      if (!cold.includes('data-trash-tab="media"')) return 'a cold /admin/trash?tab=media opened another kind'
      document.querySelector('[data-tab="posts"]').click()
      await sleep(200)
      if (location.search.includes('tab=')) return 'going back to Posts left a tab in the address'
      return 'ok one kind on screen, the address and the server agree on which'
    })()`, 900))

  // THE SEARCH KEEPS THE BLOG'S OWN ACCENT RULE, and this is the flow that would have caught
  // the shortcut. The log island folds its haystack on the server and matches a folded needle,
  // which is right for a ledger of machine events; copying it here would have been one import
  // and would have quietly broken Vietnamese, where five words live inside one folded spelling
  // — "lề", "lệ", "lê", "lẻ" and "lễ" — so a search for the first would return all five.
  //
  // TWO HALVES, because they fail differently and in different files. The SERVER must write the
  // name as typed into `data-find`; folding it there loses the accents before the browser ever
  // sees them, and that half is checked against the real bytes of a real trashed post. The
  // ISLAND must then narrow on them, and that half is checked against a row this flow puts on
  // the page itself.
  //
  // ⚠️ A PLANTED ROW, and it is the right instrument rather than a shortcut. The tour fixture is
  // English, so a flow that waited for a Vietnamese title in the trash could only ever report
  // "skip" — a guard that guards nothing. What is under test here is the island's MATCHING, the
  // island re-reads the rows on every keystroke, and the row's shape is the server's contract,
  // which the half above has just verified on bytes.
  //
  // ⚠️ NO RELOAD. A flow's body is evaluated in the page, so `location.reload()` destroys the
  // context it has to return its verdict through, and the tour reads that as "(no value)".
  // NOTE: a template literal. No backticks.
  flow('admin: the trash search answers accents the way the rest of the blog does', () => expect('/admin/trash', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const slug = 'tour-accent-' + Date.now()
      const title = 'Bên lề một trang'
      const done = async (verdict) => {
        await fetch('/api/trash', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'posts', action: 'purge', ids: [slug], force: true }),
        })
        return verdict
      }
      const made = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, slug, content: 'x', status: 'draft', categories: [], tags: [] }),
      })
      if (!made.ok) return 'POST /api/posts -> ' + made.status
      await fetch('/api/posts/' + slug, { method: 'DELETE' })

      // HALF ONE: the accents reach the markup.
      const html = await (await fetch('/admin/trash')).text()
      if (!html.includes('data-find="' + title + '"')) {
        return await done('the server did not write the name as typed; folding it there loses the accents')
      }

      // HALF TWO: the island narrows on them.
      const list = document.querySelector('[data-trash-panel="posts"] ul')
      const box = document.querySelector('[data-trash-search]')
      if (!list || !box) return await done('the trash has no list and search to test against')
      const row = document.createElement('li')
      row.setAttribute('data-trash-row', '')
      row.setAttribute('data-find', title)
      row.textContent = title
      list.append(row)
      const type = (v) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const end = async (verdict) => { type(''); row.remove(); return await done(verdict) }
      type('le'); await sleep(150)
      if (row.hidden) return await end('a word typed without accents did not find the accented text')
      type('lề'); await sleep(150)
      if (row.hidden) return await end('the word typed with its own accents did not find itself')
      type('lê'); await sleep(150)
      if (!row.hidden) return await end('a DIFFERENT accent matched: the search is folding both sides')
      return await end('ok le finds lề, lề finds lề, lê does not')
    })()`, 1200))
}
