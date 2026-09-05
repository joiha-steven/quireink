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
export function registerWriteLayoutFlows({ flow, expect }: Tour): void {
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
}
