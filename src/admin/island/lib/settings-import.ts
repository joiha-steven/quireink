// THE IMPORTER: a file in, and then the images it left behind on somebody else's server.
//
// ⚠️ THE CARD WAS MARKUP AND NOTHING ELSE UNTIL 2026-09-15. ADR 0054 drew it — the hidden file
// input, the Choose key, the filename slot, the Import key with its three labels — and the
// island was never written. `docs/spec/07-parity-admin.md` §15 lists WordPress import as a
// shipped feature; what an owner actually had was a card that looked operable, a Choose key
// that opened nothing, and a Run key that shipped `disabled` and was never armed.
//
// ⚠️ THIS IS THE ONE CONTROL ON THE SETTINGS SCREEN THAT BULK-WRITES CONTENT, and nothing on
// either side of it is idempotent. `ops.ts` never overwrites: a second run of the same file
// writes `hello-2`, `about-2` and so on, reports a perfectly successful import, and — because
// a multi-segment WordPress path is not caught by the live-content guard in `server/redirects.ts`
// — repoints the old-URL redirect at the DUPLICATE. Every inbound link then lands on the copy.
// The server has no rate limit, no lock and no dedupe on `/api/import/*`, so the only thing
// standing between an impatient second press and two copies of a blog is the `disabled`
// attribute this file maintains. That is why it is set before the request and restored in a
// `finally`, and why the file is cleared on success.
//
// ⚠️ NO RELOAD WHEN IT IS DONE. The React card called `router.refresh()`; the obvious port is
// `location.reload()`, and on THIS screen that is wrong — `settings-save.ts` holds a
// `beforeunload` guard and a leave-question for a dirty form, so a reload mid-import either
// raises the browser's own warning or throws away unsaved edits across seven tabs. The toast
// says what landed; the lists are a navigation away.
import { say } from './media-bridge'
import { show, type ListWords } from './list-dom'

type Imported = { posts: number; pages: number; skipped: number; redirects: number }
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
async function bringImagesHome(key: HTMLButtonElement, w: ListWords): Promise<void> {
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
      say(failed > 0
        ? `${w.importImagesDone ?? ''}: ${moved} · ${failed} ${w.importImagesFailed ?? ''}`
        : `${w.importImagesDone ?? ''}: ${moved}`)
      return
    }
  }
}

async function run(file: File, key: HTMLButtonElement, w: ListWords): Promise<void> {
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
    { success?: boolean; data?: Imported } | null
  if (!json?.success || !json.data) { say(w.importFailed ?? '', 'error'); return }
  say(`${w.importDone ?? ''}: ${json.data.posts} + ${json.data.pages}`)
  await bringImagesHome(key, w)
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
        await run(file, key, w)
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
