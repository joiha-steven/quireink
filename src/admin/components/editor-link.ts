// APPLYING WHAT THE LINK BOX CAME BACK WITH.
//
// The BOX is asked for by whoever has a way to ask — the island uses `quire:confirm`
// (`island/lib/ask-link.ts`) — and this is the half that does not care how it was asked: the
// three doors to it (the toolbar button, the bubble bar over a selection, and `Mod-k`) all ran
// the same three lines around a `window.prompt` until 2026-09-07, and three copies of three
// lines is how one of them ends up not clearing a link on an empty answer.
import type { Editor } from '@/admin/editor/editor'

/**
 * `extendMarkRange` covers the whole link when the caret is merely inside it, so an existing
 * link can be EDITED rather than only created; the previous href is prefilled for the same
 * reason.
 *
 * `null` is "backed out"; `''` REMOVES the link — the one gesture with no button of its own.
 */
export async function editLink(
  editor: Editor,
  askLink: (previous: string) => Promise<string | null>,
): Promise<void> {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
  const url = await askLink(previous)
  if (url === null) return
  const range = editor.chain().focus().extendMarkRange('link')
  if (url === '') range.unsetLink().run()
  else range.setLink({ href: url }).run()
}
