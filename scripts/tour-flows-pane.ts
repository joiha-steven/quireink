// The Write pane's own flows — the list beside the paper, driven the way a person drives it.
//
// Its own file because `tour-flows-editor.ts` and `tour-flows-admin.ts` are both within a
// dozen lines of the 400-line rule, and because the pane is a screen in its own right: it is
// the Write page at every width and it rides beside every editor above 1640px.
//
// THESE FLOWS CLICK. That is the whole reason they exist. The admin lost every path to
// `DELETE /api/posts/:slug` on 2026-08-17 and 2,137 tests and a 64-flow tour ran green for
// thirteen days over the gap, because every assertion that touched the trash reached for the
// endpoint. Selecting pieces and binning them is a second control on the same endpoint, so it
// gets a second test that cannot be satisfied by the API being alive.
import type { Tour } from './tour'

// Eleven languages, one control. The seeded instance answers in whichever language the
// settings carry, so a flow that matches only English passes by accident or not at all.
const SELECT = 'select|chọn|wählen|choisir|elegir|escolher|scegli|選択|选择|선택|выбрать'
const TRASH = 'trash|rác|papierkorb|corbeille|papelera|lixo|cestino|ごみ箱|휴지통|回收站|корзин'

export function registerPaneFlows({ flow, expect }: Tour): void {
  flow('admin: the write pane can bin several pieces at once', () => expect('/admin/content', `
    (async () => {
      window.confirm = () => true
      const find = (re) => [...document.querySelectorAll('button')]
        .find((b) => re.test((b.textContent || '').trim()))
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      const enter = await wait(() => find(new RegExp('^(' + ${JSON.stringify(SELECT)} + ')$', 'i')))
      if (!enter) return 'the write pane offers no way to select pieces'
      enter.click()

      // POSTS only, and two of them: a page restores through a different kind, and one row
      // would prove nothing a single delete has not already proved.
      const rows = await wait(() => {
        const found = [...document.querySelectorAll('[data-write-pick]')]
          .filter((el) => el.getAttribute('data-write-pick').startsWith('post:'))
        return found.length >= 2 ? found.slice(0, 2) : null
      })
      if (!rows) return 'selecting produced no rows to tick'
      const slugs = rows.map((el) => el.getAttribute('data-write-pick').slice(5))
      for (const row of rows) row.click()

      // The count is the selection made visible; a mode that ticks boxes and counts none is
      // a mode that will bin nothing.
      const bin = await wait(() => find(new RegExp(${JSON.stringify(TRASH)}, 'i')), 40)
      if (!bin) return 'the selection offers no way to bin what is ticked'
      if (!/\\(2\\)/.test(bin.textContent || '')) return 'two rows ticked, the control counts ' + bin.textContent
      bin.click()

      // Gone when the PUBLIC urls stop answering — what a reader would check, rather than
      // trusting the button's own optimism.
      const gone = await wait(async () => {
        const codes = await Promise.all(slugs.map((s) => fetch('/' + s).then((r) => r.status)))
        return codes.every((c) => c === 404) ? true : null
      }, 60, 200)
      const trashed = await fetch('/api/admin/view/trash').then((r) => r.json())
        .then((j) => slugs.filter((s) => (j?.data?.posts ?? []).some((p) => p.slug === s)).length)
      // Put them back before reporting either way: a tour that eats seeded posts changes what
      // every later run is testing. SOFT is also what the confirmation promises.
      const back = await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'restore', ids: slugs }),
      })
      if (!gone) return 'a selected piece still answers after Move to Trash'
      if (trashed !== 2) return 'they left the site but ' + trashed + ' of 2 reached the trash'
      return back.ok ? 'ok (' + slugs.join(', ') + ')' : 'restore -> ' + back.status
    })()`, 1200))

  // Leaving the mode has to leave it: rows that stay ticked-but-unmarked, or a list that
  // stays un-clickable, are both invisible to a flow that only ever bins things.
  flow('admin: leaving selection gives the pane back its links', () => expect('/admin/content', `
    (async () => {
      const find = (re) => [...document.querySelectorAll('button')]
        .find((b) => re.test((b.textContent || '').trim()))
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      const enter = await wait(() => find(new RegExp('^(' + ${JSON.stringify(SELECT)} + ')$', 'i')))
      if (!enter) return 'the write pane offers no way to select pieces'
      enter.click()
      const picked = await wait(() => document.querySelectorAll('[data-write-pick]').length || null)
      if (!picked) return 'selecting produced no rows to tick'
      if (document.querySelectorAll('[data-write-row]').length) return 'rows are still links while selecting'
      document.querySelector('[data-write-pick]').click()

      const leave = await wait(() => [...document.querySelectorAll('button')]
        .find((b) => b !== enter && /^(done|xong|fertig|terminé|listo|pronto|fatto|完了|完成|완료|готово)$/i.test((b.textContent || '').trim())))
      if (!leave) return 'the selection offers no way out'
      leave.click()

      const links = await wait(() => document.querySelectorAll('[data-write-row]').length || null)
      if (!links) return 'leaving the mode left the pane without links'
      if (document.querySelectorAll('[data-write-pick]').length) return 'a tick survived leaving the mode'
      // Back in a second time: the selection must not still be carrying the earlier tick.
      find(new RegExp('^(' + ${JSON.stringify(SELECT)} + ')$', 'i')).click()
      const bin = await wait(() => find(new RegExp(${JSON.stringify(TRASH)}, 'i')), 40)
      if (!bin) return 'the selection offers no way to bin what is ticked'
      return /\\(0\\)/.test(bin.textContent || '') ? 'ok (' + links + ' rows)' : 'the mode reopened holding ' + bin.textContent
    })()`, 1200))
}

/**
 * The editor's keyboard, pressed.
 *
 * Same lesson as the trash control, one screen over: a shortcut is only ever proved by a real
 * key event. Asserting that `SHORTCUTS` contains `Mod-s` proves a list has a row in it.
 *
 * `Mod-s` is the one worth a flow of its own — it takes the key back from the BROWSER, whose
 * own "Save page as…" was the previous answer, and the editor's autosave never reaches the
 * server, so this chord is the whole difference between saved and not.
 */
export function registerKeyFlows({ flow, expect }: Tour): void {
  flow('admin: the save chord saves, and the browser does not get the key', () => expect('/admin/content', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      // There is no GET for one post; the admin reads its list through the content view, and
      // the row's own updatedAt is what a save moves.
      const touched = async (slug) => (await (await fetch('/api/admin/view/content')).json())
        ?.data?.posts?.find((p) => p.slug === slug)?.updatedAt ?? null

      const row = await wait(() => [...document.querySelectorAll('[data-write-row]')]
        .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname)))
      if (!row) return 'the write pane offered no post to open'
      const slug = new URL(row.href).pathname.split('/').pop()
      const before = await touched(slug)
      row.click()

      const surface = await wait(() => document.querySelector('.ProseMirror'))
      if (!surface) return 'the editor never showed its writing surface'
      // Dirty it the way a person does — Save is disabled on a clean document, and a chord
      // that fires into a disabled button proves nothing.
      surface.focus()
      document.execCommand('insertText', false, ' ')
      await new Promise((r) => setTimeout(r, 300))

      // Whether the BROWSER still gets the key is half the point: unprevented, Chrome opens
      // its own "Save page as…" and the writer believes the work is safe.
      let prevented = false
      const spy = (e) => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) prevented = e.defaultPrevented }
      window.addEventListener('keydown', spy)
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true,
      }))
      window.removeEventListener('keydown', spy)

      const after = await wait(async () => {
        const now = await touched(slug)
        return now && now !== before ? now : null
      }, 40, 150)
      if (!after) return 'the chord fired but the server never saw a save'
      if (!prevented) return 'the key reached the browser — its own Save dialog wins'
      return 'ok (' + slug + ')'
    })()`, 1500))
}
