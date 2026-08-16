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
  // "mấy cái tính năng còn lại … chỉ là phụ" is about rank, not about removal.
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
      const behind = ['/admin/analytics', '/admin/comments', '/admin/trash', '/admin/settings', '/admin/log', '/admin/help']
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
}
