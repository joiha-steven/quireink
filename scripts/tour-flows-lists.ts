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

  // THE GROUPING IS THE SERVER'S. It always was in effect: the React face fetched one flat list
  // of every comment and grouped it in the browser on every keystroke, so the grouping was never
  // a client decision, only a client cost. What this checks is that the cards come off the wire
  // built, with their counts, and that the band's four numbers are off the FULL set — a total
  // that changes as you type is not a total.
  // NOTE: a template literal. No backticks.
  flow('admin: the comments queue arrives grouped by post', () => expect('/admin/comments', `
    (async () => {
      const html = await (await fetch('/admin/comments')).text()
      if (!html.includes('data-screen="comments"')) return 'the server did not draw the queue'
      const cards = [...document.querySelectorAll('[data-card]')]
      if (cards.length === 0) return 'skip: the fixture left no comments to group'
      const rows = document.querySelectorAll('[data-comment]').length
      const inMarkup = (html.match(/data-comment=/g) || []).length
      if (inMarkup !== rows) return 'markup held ' + inMarkup + ' comments, the page shows ' + rows
      // Every card's badge is its own number of comments, written by the server.
      for (const card of cards) {
        const said = Number(card.querySelector('[data-card-count]').textContent)
        const has = card.querySelectorAll('[data-comment]').length
        if (said !== has) return 'a card says ' + said + ' and holds ' + has
      }
      const band = [...document.querySelectorAll('[data-screen="comments"] b')].map((b) => Number(b.textContent))
      if (band.length !== 4) return 'the band should carry four numbers, it carries ' + band.length
      if (band[0] !== rows) return 'the band says ' + band[0] + ' comments and the page holds ' + rows
      if (band[1] !== cards.length) return 'the band says ' + band[1] + ' posts and the page draws ' + cards.length
      return 'ok ' + rows + ' comment(s) on ' + cards.length + ' card(s), counted by the server'
    })()`, 900))

  // NARROW, REORDER, HIGHLIGHT — the three things the island does to an arrangement it did not
  // build. The highlighter is the one that can destroy what it is drawn over: it must rebuild
  // each span from the row's own text rather than from what it painted last time, or two
  // keystrokes in the row holds marks inside marks and the next match lands on the wrong letters.
  // So the flow types, checks a mark was drawn, clears, and checks the text is byte-for-byte
  // what the server sent.
  flow('admin: the comments queue narrows, reorders and highlights without a route', () => expect('/admin/comments', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const cards = () => [...document.querySelectorAll('[data-card]')].filter((c) => !c.hidden)
      if (cards().length < 2) return 'skip: the fixture left too few posts to reorder'

      // BUSIEST puts the fullest card first, and falls back to recency inside a tie.
      const counts = () => cards().map((c) => Number(c.querySelector('[data-card-count]').textContent))
      document.querySelector('[data-comment-sort] [data-tab="busiest"]').click()
      await sleep(200)
      const busiest = counts()
      for (let i = 1; i < busiest.length; i++) {
        if (busiest[i] > busiest[i - 1]) return 'busiest put ' + busiest[i - 1] + ' before ' + busiest[i]
      }
      document.querySelector('[data-comment-sort] [data-tab="recent"]').click()
      await sleep(200)

      const body = document.querySelector('[data-comment] [data-mark][class*="line-clamp"]')
      if (!body) return 'a comment carries no markable text'
      const whole = body.getAttribute('data-text')
      const word = (whole.split(' ').find((w) => w.length > 4) || '')
      if (!word) return 'skip: no word long enough to search for'
      const box = document.querySelector('[data-comment-search]')
      const type = (v) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      }
      type(word)
      await sleep(250)
      if (document.querySelectorAll('[data-card]:not([hidden]) mark').length === 0) {
        return 'the search matched nothing it could paint'
      }
      const narrowed = cards().length
      type('zzzz-nothing-matches-this')
      await sleep(250)
      if (cards().length !== 0) return 'a query matching nothing still showed ' + cards().length + ' card(s)'
      if (document.querySelector('[data-comment-nomatch]').hidden) return 'nothing said the filter matched nothing'
      type('')
      await sleep(250)
      if (document.querySelectorAll('mark').length !== 0) return 'clearing the search left the highlighter behind'
      if (body.textContent !== whole) return 'the highlighter ate the text it was drawn over'
      return 'ok busiest ordered ' + busiest.join('>') + ', one word narrowed to ' + narrowed + ' card(s)'
    })()`, 1200))
}
