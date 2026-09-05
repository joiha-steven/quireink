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

/**
 * The editor's server autosave, driven the way a person triggers it.
 *
 * The interval is a SETTING (`autosaveSeconds`, floored at 15) and a tour that sat waiting for
 * it would be the slowest flow here by an order of magnitude. It does not need to: the hook
 * flushes on `visibilitychange` to hidden as well, which is the flush that matters most —
 * switching tabs or closing the laptop — and is the one a browser can be asked for directly.
 *
 * What it proves is the pair of claims that make this feature worth having AND safe to have:
 * the words reached the server without anybody pressing Save, and the page a reader gets did
 * not move while they did.
 */
export function registerAutosaveFlows({ flow, expect }: Tour): void {
  flow('admin: leaving the tab puts unsaved words on the server, not on the page', () => expect('/admin/content', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      // A PUBLISHED post, because that is the dangerous case: its body is the live page.
      const feed = await (await fetch('/feed.xml')).text()
      const link = [...feed.matchAll(/<link>([^<]+)<\\/link>/g)].map((m) => m[1])
        .map((u) => new URL(u).pathname).find((p) => p !== '/')
      if (!link) return 'the feed named no published post'
      const slug = link.replace(/^\\//, '')

      const row = await wait(() => [...document.querySelectorAll('[data-write-row]')]
        .find((a) => new URL(a.href).pathname === '/admin/editor/' + slug))
      if (!row) return 'the write pane did not list ' + slug
      row.click()

      const surface = await wait(() => document.querySelector('.ProseMirror'))
      if (!surface) return 'the editor never showed its writing surface'
      const marker = 'tour-autosave-' + Date.now()
      surface.focus()
      document.execCommand('insertText', false, marker)
      await new Promise((r) => setTimeout(r, 400))

      // The flush a browser performs when the tab goes away. sendBeacon is fire-and-forget,
      // so what follows waits for the SERVER to show the snapshot rather than for a promise.
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

      const stored = await wait(async () => {
        const res = await fetch('/api/posts/' + slug + '/autosave')
        if (!res.ok) return null
        const j = await res.json()
        return (j?.data?.json || '').includes(marker) ? j.data : null
      }, 50, 200)
      if (!stored) return 'the words never reached the server'

      // And the promise: the reader's page is untouched by any of it.
      const publicPage = await (await fetch('/' + slug)).text()
      if (publicPage.includes(marker)) return 'THE UNSAVED TEXT IS ON THE PUBLIC PAGE'

      // Leave the post as it was found. A real save is what clears the snapshot, and this
      // flow never made one, so the column is cleared directly.
      await fetch('/api/posts/' + slug + '/autosave', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshot: '' }),
      })
      return 'ok (' + slug + ')'
    })()`, 2000))
}

/**
 * ⌘K, pressed — and it has to LAND somewhere, not merely open.
 *
 * The palette's whole claim is that you no longer need to know which of eight tabs holds a
 * setting. A flow that opened it and counted rows would prove the list exists; what has to be
 * true is that choosing a row puts you on the tab with that setting on it.
 */
export function registerPaletteFlows({ flow, expect }: Tour): void {
  // The chord cannot be discovered, so the rail carries a control that opens the same thing
  // and PRINTS the chord beside itself. A button that does not open it teaches a shortcut that
  // does not exist, which is worse than teaching nothing.
  flow('admin: the rail teaches ⌘K by offering it', () => expect('/admin', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      const button = await wait(() => [...document.querySelectorAll('button')]
        .find((b) => /⌘K|Ctrl\\+K/.test(b.textContent || '') || /⌘K|Ctrl\\+K/.test(b.getAttribute('title') || '')))
      if (!button) return 'the rail prints the chord nowhere — nobody will find it'
      if (document.querySelector('[role=dialog] input')) return 'something was already open'
      button.click()
      const box = await wait(() => document.querySelector('[role=dialog] input'))
      if (!box) return 'the control prints the chord and does not open the thing'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return 'ok (' + (button.textContent || button.getAttribute('title')).trim() + ')'
    })()`, 1200))

  flow('admin: ⌘K finds a setting and lands on its tab', () => expect('/admin', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
      const box = await wait(() => document.querySelector('[role=dialog] input'))
      if (!box) return 'the palette did not open'

      // React owns the value, so the native setter is how a real keystroke is simulated.
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setValue.call(box, 'font')
      box.dispatchEvent(new Event('input', { bubbles: true }))

      const row = await wait(() => [...document.querySelectorAll('[role=dialog] li button')]
        .find((b) => /\\/admin\\/settings\\?tab=/.test(b.getAttribute('data-href') || '') || /appearance|erscheinung|apparence|apariencia|aspetto|外観|外观|디자인|Оформление|Aparência|Giao diện/i.test(b.textContent || '')))
      if (!row) return 'typing a word found no setting'
      row.click()

      const landed = await wait(() => location.pathname === '/admin/settings' ? location.search : null)
      if (!landed) return 'choosing a setting did not go to Settings'
      if (!/tab=/.test(landed)) return 'it reached Settings but named no tab: ' + landed
      // The palette must also be gone: a dialog that survives the navigation traps the page.
      if (document.querySelector('[role=dialog] input')) return 'the palette stayed open after choosing'
      return 'ok (' + landed + ')'
    })()`, 1500))
}
