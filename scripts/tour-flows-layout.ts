// The WRITE LAYOUT — what the shell draws AROUND the writing, and when it draws nothing.
//
// Split from `tour-flows-pane.ts` on 2026-09-06: the pane's own flows are about controls
// inside the list, these two are about `WriteLayout` in `App.tsx` deciding whether the list
// is on the screen at all. Both faults below are invisible to every other guard — one is a
// remount that repaints identically, the other is a preference read from localStorage.
import type { Tour } from './tour'

/**
 * OPENING A PIECE KEEPS THE LIST YOU WERE LOOKING AT.
 *
 * ⚠️ THE CLAIM CHANGED WHEN THE COLUMN DID, and it is worth saying what it used to be. The
 * column was React, mounted outside the router, so this flow asserted IDENTITY: the same DOM
 * element before and after, proved by a mark only that element could carry. Under ADR 0054 a
 * row click is a real navigation and the column is a new element every time — so identity is
 * not merely unprovable, it is false.
 *
 * What the reader actually wanted from that identity is what is asserted now: the piece opens,
 * the row is marked as the open one, and the column comes back NARROWED THE WAY THEY LEFT IT.
 * That is the promise `island/content.ts` keeps in `sessionStorage`, and it is the half a
 * screenshot cannot see — a column that silently forgets its filter on every click is a list
 * that has quietly become the list of everything, twenty times an afternoon.
 */
export function registerWriteLayoutFlows({ flow, expect, atWidth }: Tour): void {
  flow('admin: opening a piece keeps the list you were looking at', async () => {
    const said = await expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const pane = document.querySelector('aside[data-write-pane]')
      if (!pane) return 'no write column on the write screen'
      const seen = () => [...document.querySelectorAll('[data-write-row]')]
        .filter((r) => r.offsetParent !== null)
      if (!seen().length) return 'the column listed nothing'

      // Narrow it to posts, so the thing being remembered is something a reader chose.
      const posts = [...pane.querySelectorAll('[data-tab]')].find((b) => b.dataset.tab === 'post')
      if (!posts) return 'the column has no Posts filter'
      posts.click()
      await sleep(250)
      const narrowed = seen().length
      if (!narrowed) return 'filtering to posts emptied the column'
      if (narrowed >= document.querySelectorAll('[data-write-row]').length) {
        return 'the Posts filter hid nothing'
      }
      const row = seen().find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
      if (!row) return 'the column offered no post to open'
      return 'ok|' + narrowed + '|' + new URL(row.href).pathname
    })()`, 1500)
    if (!said.startsWith('ok|')) return said
    const [, narrowed, href] = said.split('|')

    // ⚠️ A REAL navigation, so the assertions run in a new document — which is the whole point
    // — and at 1700, which is the other half. Beside an EDITOR the column only appears from
    // 1640px, so at the tour's own 1440 it is display:none for a reason that has nothing to do
    // with what is being asserted, and this read 0 rows against the 38 it was told to expect.
    return await atWidth(1700, href ?? '/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      for (let i = 0; i < 60 && !document.querySelector('.ProseMirror'); i++) await sleep(100)
      if (!document.querySelector('.ProseMirror')) return 'the editor never opened'
      const pane = document.querySelector('aside[data-write-pane]')
      if (!pane) return 'the column is gone beside the editor'
      const seen = [...document.querySelectorAll('[data-write-row]')]
        .filter((r) => r.offsetParent !== null).length
      const want = ${Number(narrowed)}
      if (seen !== want) {
        return 'the column came back showing ' + seen + ' rows, not the ' + want + ' left behind'
      }
      if (!document.querySelector('[data-write-row][aria-current="page"]')) {
        return 'no row is marked as the open one'
      }
      return 'ok (' + seen + ' rows, filter kept, the open row marked)'
    })()`, 1500)
  })

  /**
   * NEW POST MEANS A BLANK SHEET, even one click after a save.
   *
   * The editor moves the address itself when a new piece is saved for the first time: the URL
   * becomes the post's own, by a raw history call, because routing there would refetch and
   * remount the editor and take the caret and the undo stack with it. The router therefore
   * still held `/admin/editor` — so the next click on New post pushed the address it believed
   * it was already at, no key changed, nothing remounted, and the blank sheet came up holding
   * the piece just saved. The next article typed into it and saved OVERWROTE the first.
   *
   * The pane's own New link, at 1700 where the pane stands beside the sheet, because that is
   * the click a writer actually makes. It cleans up the post it creates.
   */
  flow('editor: New post after a save gives a blank sheet, not the piece just saved', async () => {
    const said = await atWidth(1700, '/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await sleep(gap) }
        return null
      }
      // Through the prototype setter, or React's own value tracker swallows the event.
      const setValue = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const field = () => document.querySelector('textarea')
      const ta = await wait(field)
      if (!ta) return 'no title field on the editor'
      const mark = 'Tour probe ' + Date.now()
      setValue(ta, mark)
      await sleep(300)
      const save = [...document.querySelectorAll('button')].find((b) => /save draft/i.test(b.textContent || ''))
      if (!save) return 'no Save draft key on the editor'
      save.click()
      const path = await wait(() => location.pathname !== '/admin/editor' ? location.pathname : null)
      if (!path) return 'the save never moved the address onto the new post'
      const slug = path.replace('/admin/editor/', '')

      // The New-post link beside the editor is a REAL navigation now, so what it goes to is
      // asserted in a second visit rather than after a click this document would not survive.
      const link = [...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname === '/admin/editor')
      if (!link) return 'no New post link beside the editor at this width'
      return 'ok|' + slug + '|' + mark
    })()`, 1500)
    if (!said.startsWith('ok|')) return said
    const [, slug, mark] = said.split('|')
    return await atWidth(1700, '/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      let now = null
      for (let i = 0; i < 60 && !now; i++) { now = document.querySelector('textarea'); if (!now) await sleep(100) }
      try {
        if (!now) return 'the new sheet has no title field'
        if (now.value === ${JSON.stringify(mark)}) return 'the blank sheet came up holding the post just saved'
        if (now.value !== '') return 'the new sheet opened holding ' + JSON.stringify(now.value)
        if (location.pathname !== '/admin/editor') return 'the address says ' + location.pathname
        return 'ok (saved as ${slug}, then a blank sheet)'
      } finally {
        await fetch('/api/posts/${slug}', { method: 'DELETE' }).catch(() => {})
      }
    })()`, 1500)
  })
}

/**
 * Focus mode, and the screen it may NOT empty.
 *
 * The switch is device-wide and persists, so turning it on inside an editor also answered for
 * the Write screen — where the pane is not chrome beside the paper, it IS the screen. That
 * left the list gone on every later visit, an invitation to "pick a piece on the left" with
 * nothing on the left, and below `xl` a blank page with no switch on it to undo any of it,
 * because `Mod-\` is registered by the editor's action line.
 *
 * Read from localStorage in the page, which is where the preference actually lives: a flow
 * that toggled it through the editor's button would prove the button and not the rule.
 *
 * ⚠️ 1700px, and the width is the assertion's other half. Beside an EDITOR the pane only
 * appears from 1640px, so at the tour's own 1440 it is already absent for a reason that has
 * nothing to do with focus mode — and the second check below would pass against a build
 * where focus mode does nothing at all.
 */
export function registerFocusFlows({ flow, atWidth }: Tour): void {
  flow('admin: focus mode empties the editor\'s chrome, never the Write screen', async () => {
    const said = await atWidth(1700, '/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const rows = () => [...document.querySelectorAll('[data-write-row]')]
        .filter((r) => r.offsetParent !== null).length
      const set = (on) => {
        localStorage.setItem('quireink-admin-focus', on ? '1' : '0')
        window.dispatchEvent(new Event('quireink:focus'))
      }
      for (let i = 0; i < 60 && !rows(); i++) await sleep(100)
      if (!rows()) return 'the column listed nothing to begin with'
      set(true)
      // The same room a removal would need, then look again: an assertion that reads on the
      // same tick passes whether or not the column went away.
      await sleep(400)
      const kept = rows()
      if (!kept) return 'focus mode emptied the Write screen — the list IS the screen here'

      // ⚠️ THE SWITCH IS LEFT ON, and the second visit is the other half. Beside an editor the
      // column and the button row are exactly what focus mode takes away, and without that
      // half this flow would pass against a build where the switch does nothing at all. It
      // cannot be one expression any more: opening a piece is a real navigation since the
      // column became server-rendered HTML (ADR 0054).
      const row = [...document.querySelectorAll('[data-write-row]')]
        .filter((r) => r.offsetParent !== null)
        .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
      if (!row) return 'the column offered no post to open'
      return 'ok|' + kept + '|' + new URL(row.href).pathname
    })()`, 1500)
    if (!said.startsWith('ok|')) return said
    const [, kept, href] = said.split('|')
    return await atWidth(1700, href ?? '/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      try {
        for (let i = 0; i < 60 && !document.querySelector('.ProseMirror'); i++) await sleep(100)
        if (!document.querySelector('.ProseMirror')) return 'the editor never opened'
        await sleep(400)
        const seen = [...document.querySelectorAll('[data-write-row]')]
          .filter((r) => r.offsetParent !== null).length
        if (seen) return 'focus mode left the column standing beside an editor'
        return 'ok (${Number(kept)} rows on the Write screen, none beside the sheet)'
      } finally {
        // OFF again whatever happened: the switch is device-wide and a tour that leaves it on
        // changes what every later flow is looking at.
        localStorage.setItem('quireink-admin-focus', '0')
        window.dispatchEvent(new Event('quireink:focus'))
      }
    })()`, 1500)
  })

  // A phone's editor is mostly paper. Measured at 390 × 844 before this: the action bar
  // wrapped to two lines of 139px, the toolbar strip took 125 more, and the post's title
  // began 378px down — 45% of the screen was chrome before the first word.
  flow('editor: a phone gets the paper, not the chrome', () => atWidth(390, '/admin/editor/ligatures-and-the-three-you-can-turn-off', `
    (async () => {
      await new Promise((r) => setTimeout(r, 900))
      const title = document.querySelector('.reading-font')
      if (!title) return 'no title field on the editor'
      const top = Math.round(title.getBoundingClientRect().top)
      if (top > 220) return 'the title starts ' + top + 'px down; the chrome is back'
      // The action bar is at the BOTTOM, where the thumb is, and the paper has room under it.
      // Found by its COMPUTED position rather than by a class name: what is being asserted is
      // where the bar is, and a class list is a guess about that.
      const bar = [...document.querySelectorAll('main div')]
        .find((d) => getComputedStyle(d).position === 'fixed'
          && Math.abs(d.getBoundingClientRect().bottom - innerHeight) < 3
          && d.getBoundingClientRect().height > 20)
      if (!bar) return 'no action bar fixed to the bottom edge'
      // And nothing scrolls sideways, which is what a wrapped bar used to cause.
      const d = document.documentElement
      const spill = d.scrollWidth - d.clientWidth
      return spill > 1 ? 'the page scrolls sideways by ' + spill + 'px' : 'ok (title at ' + top + 'px, bar on the bottom)'
    })()`, 1400))
}
