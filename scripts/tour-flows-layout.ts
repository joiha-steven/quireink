// The WRITE LAYOUT — what the shell draws AROUND the writing, and when it draws nothing.
//
// Split from `tour-flows-pane.ts` on 2026-09-06: the pane's own flows are about controls
// inside the list, these two are about `WriteLayout` in `App.tsx` deciding whether the list
// is on the screen at all. Both faults below are invisible to every other guard — one is a
// remount that repaints identically, the other is a preference read from localStorage.
import type { Tour } from './tour'

/**
 * The pane SURVIVES the click, which is a different claim from "there is a pane afterwards".
 *
 * It was drawn by each of the three writing pages, so a click inside it changed the route,
 * swapped the page component and took the list with it. The list came back looking identical
 * and scrolled to the top — the failure is invisible in a screenshot and obvious to anybody
 * using it. So the assertion is on IDENTITY: the same DOM element before and after.
 */
export function registerWriteLayoutFlows({ flow, expect, atWidth }: Tour): void {
  flow('admin: clicking a row swaps the sheet and leaves the list alone', () => expect('/admin/content', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      const paneBefore = await wait(() => document.querySelector('aside'))
      if (!paneBefore) return 'no write pane on the write screen'
      const rowsBefore = document.querySelectorAll('[data-write-row]').length
      if (!rowsBefore) return 'the pane listed nothing'
      // Something only this element can carry, so "the same pane" cannot be faked by a
      // replacement that happens to look the same.
      paneBefore.dataset.tourMark = 'kept'

      // Watch for the list ever being absent: a remount empties it for at least one commit.
      let emptied = false
      const watch = new MutationObserver(() => {
        if (document.querySelectorAll('[data-write-row]').length === 0) emptied = true
      })
      watch.observe(document.body, { childList: true, subtree: true })

      const row = [...document.querySelectorAll('[data-write-row]')]
        .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
      if (!row) return 'the pane offered no post to open'
      row.click()

      const sheet = await wait(() => document.querySelector('.ProseMirror'))
      watch.disconnect()
      if (!sheet) return 'the editor never opened'

      const paneAfter = document.querySelector('aside')
      if (!paneAfter) return 'the pane is gone after opening a post'
      if (paneAfter.dataset.tourMark !== 'kept') return 'the pane was REPLACED, not kept'
      if (emptied) return 'the list emptied during the navigation'
      const active = document.querySelector('[data-write-row][aria-current="page"]')
      if (!active) return 'no row is marked as the open one'
      return 'ok (' + rowsBefore + ' rows kept)'
    })()`, 1500))

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
  flow('editor: New post after a save gives a blank sheet, not the piece just saved', () => atWidth(1700, '/admin/editor', `
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

      try {
        const link = [...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname === '/admin/editor')
        if (!link) return 'no New post link beside the editor at this width'
        link.click()
        await sleep(1200)
        const now = field()
        if (!now) return 'the new sheet has no title field'
        if (now.value === mark) return 'the blank sheet came up holding the post just saved'
        if (now.value !== '') return 'the new sheet opened holding ' + JSON.stringify(now.value)
        if (location.pathname !== '/admin/editor') return 'the address says ' + location.pathname
        return 'ok (saved as ' + slug + ', then a blank sheet)'
      } finally {
        await fetch('/api/posts/' + slug, { method: 'DELETE' }).catch(() => {})
      }
    })()`, 1500))
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
  flow('admin: focus mode empties the editor\'s chrome, never the Write screen', () => atWidth(1700, '/admin/content', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      const rows = () => document.querySelectorAll('[data-write-row]').length
      const set = (on) => {
        localStorage.setItem('quireink-admin-focus', on ? '1' : '0')
        window.dispatchEvent(new Event('quireink:focus'))
      }
      const was = localStorage.getItem('quireink-admin-focus')

      try {
        if (!await wait(() => rows() || null)) return 'the pane listed nothing to begin with'
        set(true)
        // Give the re-render the same room a removal would need, then look again: an
        // assertion that reads on the same tick passes whether or not the pane went away.
        await new Promise((r) => setTimeout(r, 400))
        const kept = rows()
        if (!kept) return 'focus mode emptied the Write screen — the list is the screen here'

        // The other half, so this cannot be satisfied by focus mode doing nothing at all:
        // beside an editor the pane and the button row are exactly what it takes away.
        const row = [...document.querySelectorAll('[data-write-row]')]
          .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
        if (!row) return 'the pane offered no post to open'
        row.click()
        if (!await wait(() => document.querySelector('.ProseMirror'))) return 'the editor never opened'
        await new Promise((r) => setTimeout(r, 400))
        if (rows()) return 'focus mode left the pane standing beside an editor'
        return 'ok (' + kept + ' rows on the Write screen, none beside the sheet)'
      } finally {
        if (was === null) localStorage.removeItem('quireink-admin-focus')
        else localStorage.setItem('quireink-admin-focus', was)
        window.dispatchEvent(new Event('quireink:focus'))
      }
    })()`, 1500))

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
