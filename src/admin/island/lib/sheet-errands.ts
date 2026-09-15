// THE TWO THINGS THE SHEET DOES THAT ARE NOT WRITING OR SAVING: read it as a stranger would,
// and take it off the site.
//
// Both are one request and a navigation, and both are easy to get subtly wrong — which is why
// they are here rather than inline in the entry.
import type { SheetKind, SheetWords } from '@/admin-shared/sheet-wire'
import { uploadImages } from '@/admin/upload-client'
import { say } from './media-bridge'
import { sayAcross } from './say-across'

/**
 * A picture dropped or pasted into the writing, uploaded.
 *
 * ⚠️ IT SAYS WHICH REFUSAL IT WAS. A file the library will not take is a different problem from
 * a network that dropped, and one sentence for both sends somebody to check their connection
 * over a `.heic`.
 */
export async function uploadInline(t: SheetWords, file: File): Promise<string | null> {
  try {
    const [item] = await uploadImages([file])
    return item?.url ?? null
  } catch (err) {
    const unsupported = err instanceof Error && err.message === 'unsupported_type'
    say(unsupported ? t.unsupportedType : t.imageUploadFailed, 'error')
    return null
  }
}

/**
 * OPEN THE DRAFT PREVIEW, having first saved anything pending.
 *
 * ⚠️ THE TAB IS OPENED BEFORE THE AWAIT, and that is the whole shape of this function. A
 * `window.open` after an `await` is a popup the browser blocks, because by then the click that
 * justified it is over. So the tab is claimed synchronously and pointed somewhere afterwards —
 * or closed again, if there turns out to be nothing to point it at.
 *
 * The save comes first because the autosave never reaches the published body: a preview that
 * showed the last SAVE while the writer was looking at their last paragraph would be answering
 * a different question from the one they asked.
 */
export async function openPreview(
  t: SheetWords,
  saveFirst: () => Promise<boolean>,
  slugNow: () => string,
): Promise<void> {
  const tab = window.open('', '_blank')
  if (!(await saveFirst())) { tab?.close(); return }
  const slug = slugNow()
  if (!slug) { tab?.close(); return }
  try {
    const res = await fetch(`/api/preview-link?slug=${encodeURIComponent(slug)}`)
    const json = await res.json() as { success?: boolean; data?: { token?: string } }
    if (!json.success || !json.data?.token) throw new Error('no token')
    const url = `${location.origin}/preview/${slug}?key=${json.data.token}`
    if (tab) tab.location.href = url
    else window.open(url, '_blank') // the popup was blocked — one best-effort second try
  } catch {
    tab?.close()
    say(t.saveFailed, 'error')
  }
}

/**
 * MOVE THE PIECE TO THE TRASH.
 *
 * It ASKS NOTHING, and that is deliberate: the delete is soft — the row keeps its body, its
 * revisions and its slug — so a question before it is a toll on the ninety-nine times somebody
 * meant it, paid to save the one time they did not. And it does not save that one either,
 * because a dialog answered by reflex is not read. The way back is in the toast, where the eye
 * already is — carried across the navigation, because this page does not survive it.
 */
export async function moveToTrash(
  t: SheetWords, kind: SheetKind, slug: string,
  /** Called once the row is gone and before the page leaves: see the warning below. */
  onGone: () => void,
): Promise<void> {
  try {
    const res = await fetch(`/api/${kind}s/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    // A failed delete must not navigate: leaving the editor would look like it worked. AND IT
    // HAS TO SAY SO — silently un-greying the button is indistinguishable from a click that did
    // not register, so the owner presses it again, and again.
    if (!res.ok) { say(t.trashFailed, 'error'); return }
    // ⚠️ AND THE SAFETY NET COMES DOWN FIRST. The editor is holding unsaved changes to a piece
    // that no longer exists: left standing, the exit guard would ask whether to leave, and the
    // flush on the way out would write a snapshot of a trashed post for the next visit to
    // offer back.
    onGone()
    // ⚠️ THE SENTENCE TRAVELS, because this page is about to stop existing. Said here it would
    // be raised and destroyed in the same frame, and the undo with it — see `say-across.ts`.
    sayAcross({ message: t.trashedOne, undo: { label: t.undo, kind: `${kind}s`, ids: [slug] } })
    location.href = '/admin/content'
  } catch {
    say(t.trashFailed, 'error')
  }
}
