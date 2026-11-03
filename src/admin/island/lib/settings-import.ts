// THE IMPORTER: a file in, and then the images it left behind on somebody else's server.
//
// ⚠️ THE CARD WAS MARKUP AND NOTHING ELSE UNTIL 2026-09-15. ADR 0054 drew it — the hidden file
// input, the Choose key, the filename slot, the Import key with its three labels — and the
// island was never written. `docs/spec/07-parity-admin.md` §15 lists WordPress import as a
// shipped feature; what an owner actually had was a card that looked operable, a Choose key
// that opened nothing, and a Run key that shipped `disabled` and was never armed.
//
// ⚠️ THIS IS THE ONE CONTROL ON THE SETTINGS SCREEN THAT BULK-WRITES CONTENT. `ops.ts` never
// overwrites, and a re-run recognises what an earlier one brought in (by slug, title and date,
// or by the redirect from the item's old path), but an item with no date or a page edited since
// still comes in twice, and the server has no lock on `/api/import/*`. So an impatient second
// press is still worth stopping here: `disabled` is set before the request and restored in a
// `finally`, and the file is cleared on success.
//
// ⚠️ NO RELOAD WHEN IT IS DONE. The React card called `router.refresh()`; the obvious port is
// `location.reload()`, and on THIS screen that is wrong — `settings-save.ts` holds a
// `beforeunload` guard and a leave-question for a dirty form, so a reload mid-import either
// raises the browser's own warning or throws away unsaved edits across seven tabs. The toast
// says what landed; the lists are a navigation away.
import { say } from './media-bridge'
import { show, type ListWords } from './list-dom'

/** `notes` arrives only from a Quire Ink bundle; no other export has the kind (ADR 0044). */
type Imported = { posts: number; pages: number; notes?: number; skipped: number; already?: number; redirects: number; locked?: number; uploads?: number }
/** What `/api/import/images` answers. `remaining` COUNTS FAILURES, which is what ends the loop. */
type Images = { found: number; moved: number; remaining: number; failed: { url: string; reason: string }[] }

/**
 * Which route reads this file, by its name.
 *
 * ⚠️ `.xml` IS THE FALLBACK, NOT A MATCH, and that is deliberate rather than sloppy: a WordPress
 * export is the overwhelmingly common case and its extension is the one people rename. The
 * server checks the CONTENT anyway (`not_a_wordpress_export`), so a wrong guess is refused
 * rather than mis-imported.
 */
function routeFor(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) return '/api/import/ghost'
  if (lower.endsWith('.zip')) return '/api/import/archive'
  return '/api/import/wordpress'
}

/**
 * Bring the images home, one batch at a time, saying where it has got to.
 *
 * ⚠️ TWO STOP CONDITIONS, AND BOTH ARE REQUIRED. `remaining` is what is still remote INCLUDING
 * what has permanently failed — a 404 on the old host is counted every pass, because the route
 * re-derives its queue from the posts each call and remembers no failures. So a loop that waits
 * for `remaining === 0` never ends on a blog with one dead image. `moved === 0` is the other
 * half: this batch moved nothing, so the next one will move nothing either.
 */
async function bringImagesHome(screen: HTMLElement, key: HTMLButtonElement, w: ListWords): Promise<void> {
  const word = key.dataset.labelImages ?? ''
  let moved = 0
  for (;;) {
    const res = await fetch('/api/import/images', { method: 'POST' }).catch(() => null)
    const json = await res?.json().catch(() => null) as { success?: boolean; data?: Images } | null
    // ⚠️ A BROKEN QUESTION IS NOT AN EMPTY ANSWER. The React card returned here in silence, so a
    // 500 or an expired session halfway through left the owner with a card that had simply
    // stopped and no reason why.
    if (!json?.success || !json.data) { say(w.importFailed ?? '', 'error'); return }
    const report = json.data
    moved += report.moved
    key.textContent = `${word}… ${moved}/${moved + report.remaining}`
    if (report.remaining === 0 || report.moved === 0) {
      const failed = report.failed.length
      // Each address it could not fetch, into the slot the server drew: the owner's checklist
      // before the old host goes (`docs/features/editing.md`). A count alone named none of them.
      const box = screen.querySelector<HTMLElement>('[data-import-failed]')
      const list = screen.querySelector<HTMLElement>('[data-import-failed-list]')
      if (box && list) {
        list.textContent = report.failed.map((f) => `${f.url}  (${f.reason})`).join('\n')
        show(box, failed > 0)
      }
      say(failed > 0
        ? `${w.importImagesDone ?? ''}: ${moved} · ${failed} ${w.importImagesFailed ?? ''}`
        : `${w.importImagesDone ?? ''}: ${moved}`)
      return
    }
  }
}

async function run(screen: HTMLElement, file: File, key: HTMLButtonElement, w: ListWords): Promise<void> {
  const body = new FormData()
  // The field name the three routes read. No `content-type` header: the browser has to write
  // the multipart boundary itself, and setting one by hand is how an upload arrives unparseable.
  body.append('file', file)
  const res = await fetch(routeFor(file.name), { method: 'POST', body }).catch(() => null)
  if (res?.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return
  }
  const json = await res?.json().catch(() => null) as
    { success?: boolean; data?: Imported; error?: string } | null
  // WHICH refusal: the server names a file of the wrong kind or size, and all of them read
  // "Upload failed", which sends somebody to check their connection over a wrong file.
  if (!json?.success || !json.data) {
    const why = json?.error ?? ''
    say((why.startsWith('not_a_') ? w.importWrongKind : why === 'file_too_large' ? w.importTooBig : w.importFailed) ?? '', 'error')
    return
  }
  const notes = json.data.notes ?? 0
  // What was left out is counted aloud: it came back in the answer and was never said.
  const skipped = json.data.skipped > 0 ? ` · ${(w.importSkipped ?? '').replace('{n}', String(json.data.skipped))}` : ''
  // Already here from an earlier run, said apart: it is not something wrong with the file.
  const already = (json.data.already ?? 0) > 0 ? ` · ${(w.importAlready ?? '').replace('{n}', String(json.data.already))}` : ''
  const uploads = (json.data.uploads ?? 0) > 0 ? ` · ${(w.importUploads ?? '').replace('{n}', String(json.data.uploads))}` : ''
  // Locked where they came from, so drafts here: said, or the owner finds them by chance.
  const locked = (json.data.locked ?? 0) > 0 ? ` · ${(w.importLocked ?? '').replace('{n}', String(json.data.locked))}` : ''
  say(`${w.importDone ?? ''}: ${json.data.posts} + ${json.data.pages}` + (notes > 0 ? ` + ${notes}` : '') + uploads + skipped + already + locked)
  await bringImagesHome(screen, key, w)
}

export function wireImport(screen: HTMLElement, w: ListWords): void {
  const input = screen.querySelector<HTMLInputElement>('[data-import-file]')
  const name = screen.querySelector<HTMLElement>('[data-import-name]')
  const key = screen.querySelector<HTMLButtonElement>('[data-import-run]')
  if (!input || !key) return

  // ⚠️ THE SLOT IS SHOWN, NOT BUILT. The server drew the `<span>` hidden and empty; a node made
  // here would be a second copy of this screen's classes, drifting from the server's in silence.
  const chose = (): void => {
    const file = input.files?.[0] ?? null
    if (name) { name.textContent = file?.name ?? ''; show(name, file != null) }
    key.disabled = file == null
  }
  input.addEventListener('change', chose)

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-import-choose]')) { input.click(); return }
    if (!target.closest('[data-import-run]')) return
    const file = input.files?.[0]
    if (!file) return
    void (async () => {
      key.disabled = true
      key.textContent = key.dataset.labelBusy ?? key.textContent
      try {
        await run(screen, file, key, w)
        // Cleared on success AND on a reported failure, because the second press is the one
        // that doubles the blog. The owner chooses the file again, which is a keystroke; the
        // alternative costs them an afternoon of deleting posts by hand.
        input.value = ''
        chose()
      } finally {
        key.textContent = key.dataset.labelIdle ?? key.textContent
        key.disabled = input.files?.[0] == null
      }
    })()
  })
}
