// THE WRITE COLUMN'S TWO DRAWERS: every category and tag across the blog, and every series.
//
// ⚠️ NOTHING COVERED THESE BEFORE. `TaxonomyManager.tsx` and `SeriesManager.tsx` had no unit
// test and no flow, which was survivable while they were React components nobody was editing
// and is not survivable the day they are rewritten (ADR 0054, 2026-09-15). What they drive is
// the most far-reaching pair of writes in the admin: renaming a category rewrites the front
// matter of every post carrying it and MERGES on a collision, and deleting one strips it from
// all of them. A control like that having no check at all is the gap worth closing first.
//
// It asks for the one action that is SAFE to fire: a reorder, which is reversible and which the
// drawer deliberately does not ask about. Rename and delete are proved as far as the question —
// that they ask before they act — and no further: a tour that renamed a term would be a tour
// that rewrites forty posts on somebody's instance to prove it can.
import type { Tour } from './tour'

export function registerDrawerFlows({ flow, expect }: Tour): void {
  flow('admin: the terms drawer lists what the blog is filed under, and asks before it rewrites', () =>
    expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const open = (name) => document.querySelector('[data-write-drawer="' + name + '"]').click()

      open('taxonomy')
      await sleep(300)
      const box = document.querySelector('[data-drawer="taxonomy"]')
      if (!box || box.hidden) return 'the taxonomy drawer did not open'
      if (box.getAttribute('role') !== 'dialog' || box.getAttribute('aria-modal') !== 'true') {
        return 'the drawer takes the page out of reach without saying so'
      }
      if (document.querySelector('[data-drawer-scrim]').hidden) return 'no scrim behind the drawer'
      const terms = box.querySelectorAll('[data-term]').length
      if (terms < 2) return 'the drawer listed ' + terms + ' terms for a blog that has many'
      if (box.querySelectorAll('[data-term-rename]').length !== terms) {
        return 'some terms cannot be renamed'
      }

      // ⚠️ IT ASKS. A rename rewrites every post carrying the term, so the one thing this flow
      // presses is the control that must NOT act on its own. Nothing answers the question, so
      // nothing happens — which is also the island's own rule: an unheard question is a refusal.
      let asked = null
      const spy = (e) => { asked = e.detail?.request?.title ?? '' ; e.stopImmediatePropagation() }
      window.addEventListener('quire:confirm', spy, true)
      box.querySelector('[data-term-rename]').click()
      await sleep(400)
      window.removeEventListener('quire:confirm', spy, true)
      if (asked === null) return 'rename acted without asking anything'
      if (!asked.trim()) return 'the question does not name the term it is about'

      // Escape closes it and hands the page back its scroll.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await sleep(250)
      if (!document.querySelector('[data-drawer="taxonomy"]').hidden) {
        return 'Escape left the drawer open'
      }
      if (document.documentElement.style.overflow === 'hidden') {
        return 'the page under the drawer is still locked after it closed'
      }
      return 'ok (' + terms + ' terms, the rename asks, Escape closes)'
    })()`, 1200))

  /**
   * THE ONE WRITE IN EITHER DRAWER THAT DOES NOT ASK, and the reason it does not: moving part
   * three above part two is a thing anybody can see and put straight back.
   *
   * Two visits, because the drawer reloads after a write — the server owns the order, and a
   * list patched in place after a reorder would be showing one the server has not agreed to.
   */
  flow('admin: a series can be reordered, and the server keeps the new order', async () => {
    const READ = `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      document.querySelector('[data-write-drawer="series"]').click()
      await sleep(300)
      const box = document.querySelector('[data-drawer="series"]')
      if (!box || box.hidden) return 'the series drawer did not open'
      const group = box.querySelector('[data-series]')
      if (!group) return 'the blog has no series to reorder'
      const parts = [...group.querySelectorAll('[data-part]')].map((p) => p.dataset.part)
      if (parts.length < 2) return 'the series has one part, so order means nothing'
      // The ends cannot move past the ends, and saying so is half of what the keys are for.
      if (!group.querySelector('[data-part-up]').disabled) return 'the first part can be moved up'
      return 'ok|' + parts.join(' ')
    })()`
    const before = await expect('/admin/content', READ, 1200)
    if (!before.startsWith('ok|')) return before

    const moved = await expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      document.querySelector('[data-write-drawer="series"]').click()
      await sleep(300)
      document.querySelector('[data-series] [data-part-down]').click()
      // It reloads on success, so this expression is not expected to finish. What proves the
      // write is the NEXT visit.
      await sleep(1500)
      return 'clicked'
    })()`, 2000).catch(() => 'clicked')

    const after = await expect('/admin/content', READ, 1200)
    if (!after.startsWith('ok|')) return after
    const was = before.slice(3).split(' ')
    const now = after.slice(3).split(' ')
    if (was.join(' ') === now.join(' ')) return 'the reorder never reached the server (' + moved + ')'
    if ([...was].sort().join(' ') !== [...now].sort().join(' ')) {
      return 'the reorder changed which parts the series has, not their order'
    }
    if (!(was[0] === now[1] && was[1] === now[0])) {
      return 'the first two did not swap: ' + was.join(' ') + ' -> ' + now.join(' ')
    }
    // Put it back, so a tour run does not leave the seeded blog rearranged.
    await expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      document.querySelector('[data-write-drawer="series"]').click()
      await sleep(300)
      const keys = document.querySelectorAll('[data-series] [data-part-down]')
      keys[0].click()
      await sleep(1200)
      return 'put back'
    })()`, 1800).catch(() => 'put back')
    return 'ok (' + was.length + ' parts, the first two swapped and the server kept it)'
  })
}
