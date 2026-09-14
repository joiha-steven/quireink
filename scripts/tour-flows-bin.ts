// BINNING THE PIECE THE EDITOR IS HOLDING, which is the one destructive control inside the
// writing screen.
//
// It came out of `tour-flows-editor.ts` on 2026-09-15, when the write column became
// server-rendered HTML and this flow had to grow a second visit: opening a piece is a real
// navigation now, so picking a row and acting on it cannot be one expression. That growth put
// the file over the 400-line limit, and this flow is the one that was least about the editor's
// writing surface and most about what stands beside it.
import type { Tour } from './tour'

export function registerTrashFromEditorFlows({ flow, expect }: Tour): void {
  // ⚠️ IT OPENS THE EDITOR BY ITS OWN ADDRESS, not by clicking a row. Since the write column
  // became server-rendered HTML (ADR 0054) a row click is a REAL navigation, so everything
  // after it ran in a document that no longer existed and the flow reported "(no value)". What
  // a row click proves belongs to the column, and `tour-flows-layout.ts` proves it there; this
  // flow is about the editor's own way of binning the piece it is holding.
  flow('admin: the editor can move a piece to the trash', async () => {
    const picked = await expect('/admin/content', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      let row = null
      for (let i = 0; i < 60 && !row; i++) {
        row = [...document.querySelectorAll('[data-write-row]')]
          .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname))
        if (!row) await sleep(100)
      }
      return row ? new URL(row.href).pathname : 'the write column offered no post to open'
    })()`, 900)
    if (!picked.startsWith('/admin/editor/')) return picked
    return await expect(picked, `
    (async () => {
      window.confirm = () => true
      // VISIBLE controls only. Since ADR 0054 the rail is one DOM in every state and CSS
      // decides what is shown, so a folded group still holds a link that says "Trash" — and a
      // search by WORDS found the rail's row instead of the editor's button. offsetParent is
      // null for anything display:none, which is the same reason a person cannot click it.
      const find = (re) => [...document.querySelectorAll('button, a')]
        .filter((b) => b.offsetParent !== null)
        .find((b) => re.test((b.textContent || '').trim()))
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      const slug = location.pathname.split('/').pop()

      const attributes = await wait(() => find(/attribut|thuộc tính/i))
      if (!attributes) return 'the editor never showed its Attributes control'
      attributes.click()

      const trash = await wait(() => find(/trash|rác|papierkorb|corbeille|papelera|lixo|cestino|ごみ箱|휴지통|回收站|корзину/i), 40)
      if (!trash) return 'the Attributes panel offers no way to trash the piece'
      trash.click()

      // Gone when the PUBLIC url stops answering — what a reader would check, rather than
      // trusting the button's own optimism.
      const gone = await wait(async () => (await fetch('/' + slug)).status === 404 ? true : null, 60, 200)
      const listed = await (await fetch('/api/admin/view/trash')).json()
        .then((j) => (j?.data?.posts ?? []).some((p) => p.slug === slug))
      // Put it back before reporting either way: a tour that eats a seeded post changes
      // what every later run is testing. SOFT is also what the confirmation promises.
      const back = await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'restore', ids: [slug] }),
      })
      if (!gone) return 'the piece still answers after Move to Trash'
      if (!listed) return 'it left the site but never reached the trash'
      return back.ok ? 'ok (' + slug + ')' : 'restore -> ' + back.status
    })()`, 1200)
  })
}
