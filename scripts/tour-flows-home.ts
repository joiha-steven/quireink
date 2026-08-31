// The home screen and the rail (ADR 0024 step 6), in a real browser.
//
// Its own file for the reason `tour-flows-admin.ts` is its own file: that one reached the
// 400-line ceiling, and the seam here is a screen rather than a size — these three flows are
// about the SHAPE the rebuild settled on, and the shape is the thing a future change is most
// likely to undo without noticing.
//
// Every one of them was watched RED first, against a build with the step reverted. A guard
// that has only ever been green is a guard nobody has tested.
import type { Tour } from './tour'

export function registerHomeFlows({ flow, expect }: Tour): void {

  // Both halves matter. Counting only what is visible at rest would pass just as well on a
  // rail that had DELETED the other seven, which is the one outcome the ADR rules out:
  // everything that is not writing being secondary is about RANK, not about removal.
  flow('admin: the rail is four, and everything else is one click', () => expect('/admin', `
    (async () => {
      const rail = document.querySelector('aside nav')
      if (!rail) return 'no desktop rail'
      const hrefs = () => [...rail.querySelectorAll('a')].map((a) => a.getAttribute('href'))
      const atRest = hrefs()
      if (atRest.length !== 4) return 'the rail offers ' + atRest.length + ' destinations at rest: ' + atRest.join(' ')
      const wanted = ['/admin', '/admin/content', '/admin/media', '/admin/newsletter']
      const missing = wanted.filter((h) => !atRest.includes(h))
      if (missing.length) return 'not on the rail: ' + missing.join(' ')
      const control = rail.querySelector('button[aria-expanded]')
      if (!control) return 'nothing opens the rest'
      control.click()
      await new Promise((r) => setTimeout(r, 250))
      const opened = hrefs()
      // The assistant is in this list because no key is configured in the tour's instance.
      // Paste one and it moves UP, which the flow below proves; with none, a door onto a
      // refusal has no business taking a quarter of the rail.
      const behind = ['/admin/assistant', '/admin/analytics', '/admin/comments', '/admin/trash', '/admin/settings', '/admin/log', '/admin/help']
        .filter((h) => !opened.includes(h))
      if (behind.length) return 'still unreachable after one click: ' + behind.join(' ')
      return 'ok 4 at rest, ' + opened.length + ' after one click'
    })()`, 900))

  // The numbers moved onto the home screen, which is WHY Analytics could leave the rail. If
  // this goes red the rail is offering four doors to a screen that no longer answers the
  // question the fifth one used to.
  flow('admin: the home carries the reader numbers', () => expect('/admin', `
    (() => {
      const card = [...document.querySelectorAll('section')]
        .find((s) => s.querySelector('h2') && /Traffic|Lượt truy cập/.test(s.querySelector('h2').textContent))
      if (!card) return 'no traffic card on the home screen'
      // The FIGURES, not every number in the card: the "last 7 days" line is a span, and the
      // four that answer "did anybody read it" are the divs.
      const figures = [...card.querySelectorAll('div.tabular-nums')].map((d) => d.textContent.trim())
      if (figures.length < 4) return 'the card shows ' + figures.length + ' figures: ' + figures.join(' ')
      const dwell = figures.some((f) => f.includes(':'))
      const depth = figures.some((f) => f.endsWith('%'))
      if (!dwell || !depth) return 'no time-per-post or read-through among: ' + figures.join(' ')
      return 'ok ' + figures.join(' · ')
    })()`, 900))

  // A count of drafts used to be the whole of this. The band has to hand back the WRITING —
  // a chip that opens the editor on the piece it names — or it is the count again with more
  // furniture around it.
  flow('admin: the home hands back an unfinished piece', () => expect('/admin', `
    (async () => {
      // ⚠️ Whether there is anything unfinished is asked of the CONTENT view, not of the band.
      // The first version read it off the band itself and so answered "skip: nothing
      // unfinished" on a build with no band in it — a flow that cannot go red on the very
      // regression it exists for. This endpoint is the same on both builds.
      const view = await (await fetch('/api/admin/view/content')).json()
      const all = [...(view?.data?.posts ?? []), ...(view?.data?.pages ?? [])]
      const unfinished = all.filter((p) => p.status !== 'published').length
      const band = [...document.querySelectorAll('section')]
        .find((s) => s.querySelector('h2') && /Pick up|Viết tiếp/.test(s.querySelector('h2').textContent))
      if (!unfinished) return band ? 'a band for nothing: no unfinished pieces exist' : 'skip: nothing unfinished on this instance'
      if (!band) return unfinished + ' unfinished piece(s), and the home screen hands back none of them'
      const chips = [...band.querySelectorAll('a')]
      if (!chips.length) return 'the band is on screen and holds nothing'
      const href = chips[0].getAttribute('href') || ''
      if (!href.startsWith('/admin/editor/') && !href.startsWith('/admin/page-editor/')) {
        return 'a chip points at ' + href + ' rather than at an editor'
      }
      const named = chips[0].textContent.trim()
      chips[0].click()
      await new Promise((r) => setTimeout(r, 900))
      if (location.pathname !== href) return 'the chip did not navigate: ' + location.pathname
      // The editor, on the piece the chip named. The title field is the one element every
      // editor screen has and no other admin screen does.
      const title = document.querySelector('textarea, input[name=title], [data-editor-title]')
      if (!title) return 'landed on ' + href + ' with no editor on it'
      return 'ok ' + chips.length + ' chip(s), first one opened ' + named.slice(0, 40)
    })()`, 1000))

  // THE RAIL FOLLOWS THE KEY. Promoting the assistant was the owner's call, made on
  // 2026-08-31, and the condition is the thing worth pinning: nobody pastes an API key for
  // a screen they meant to visit twice a month, so the key IS the argument for the fifth
  // row. A rail that shows it either always or never has lost the argument.
  //
  // Writes, and cleans up after itself: the tour's own rule, and a stored key would change
  // what every flow after this one is looking at.
  //
  // THREE VISITS, not one expression, and that is the fix for how this flow first shipped.
  // The rail is drawn from a view fetched once when the admin boots, so seeing it change
  // takes a fresh document — and `location.reload()` from inside the expression destroys the
  // context that expression is running in, so everything after it is never reached and the
  // flow reports `(no value)` whatever the product does. `expect` navigates for us.
  flow('admin: a stored key moves the assistant onto the rail, under Home', async () => {
    // DIRECT children of the nav, which is the whole distinction this flow is about. The
    // secondary group ("Everything else") lives in a div inside the same nav, so
    // `aside nav a` collects BOTH lists and calls the assistant promoted while it is sitting
    // in the drawer where it belongs — which is what the first version of this did.
    const READ = `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const rail = () => [...document.querySelectorAll('aside nav > a')].map((a) => a.getAttribute('href'))
      const drawer = () => [...document.querySelectorAll('aside nav div a')].map((a) => a.getAttribute('href'))
      // The group is closed on a primary page, so it has to be opened before it can be read.
      const openDrawer = async () => {
        const toggle = document.querySelector('aside nav button[aria-expanded]')
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') { toggle.click(); await sleep(250) }
      }
      const save = (body) => fetch('/api/integrations/ai', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })`

    const before = await expect('/admin', `(async () => {${READ}
      if (rail().includes('/admin/assistant')) return 'the assistant is on the rail before any key exists'
      // Never in both lists, and never in neither: with no key it is one row down the drawer.
      await openDrawer()
      if (!drawer().includes('/admin/assistant')) return 'with no key the assistant is nowhere: ' + drawer().join(' ')
      // Never used to call anything: the assistant only reaches a provider when asked a
      // question, and this flow never asks one.
      const saved = await save({ aiProvider: 'openai', aiApiKey: 'tour-not-a-real-key', aiModel: '' })
      return saved.ok ? 'ok' : 'could not store a key: ' + saved.status
    })()`, 1200)
    if (before !== 'ok') return before

    try {
      return await expect('/admin', `(async () => {${READ}
        const after = rail()
        if (after[1] !== '/admin/assistant') return 'with a key stored the rail reads ' + after.join(' ')
        if (after.length !== 5) return 'the rail offers ' + after.length + ' destinations with a key'
        await openDrawer()
        if (drawer().includes('/admin/assistant')) return 'the assistant is on the rail AND in the drawer'
        return 'ok ' + after.join(' ')
      })()`, 1200)
    } finally {
      // '' clears it, which is what makes this a clear and not a set.
      await expect('/admin', `fetch('/api/integrations/ai', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aiProvider: '', aiApiKey: '', aiModel: '' }),
      }).then((r) => r.ok ? 'ok' : 'clear failed: ' + r.status)`, 600)
    }
  })
}