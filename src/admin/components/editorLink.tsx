// The link box, and the three doors to it.
//
// Split out of `EditorMenus` when that file hit its 400-line cap: the toolbar button, the
// bubble bar over a selection and `Mod-k` all ran the same three lines around a
// `window.prompt` until 2026-09-07, and three copies of three lines is how one of them ends
// up not clearing a link on an empty answer.
import type { Editor as TiptapEditor } from '@tiptap/react'
import { useConfirmFor } from '@/admin/ui/ConfirmDialog'
import { useAdminT } from './I18nProvider'

/**
 * THE LINK BOX, in one place, because there are three doors to it: the toolbar button, the
 * bubble bar over a selection, and `Mod-k`. All three ran the same three lines around a
 * `window.prompt` until 2026-09-07, and three copies of three lines is how one of them ends
 * up not clearing a link on an empty answer.
 *
 * `extendMarkRange` covers the whole link when the caret is merely inside it, so an existing
 * link can be EDITED rather than only created; the previous href is prefilled for the same
 * reason. An empty answer unlinks — the one gesture with no button of its own.
 */
export function useLinkAsker(): (previous: string) => Promise<string | null> {
  const t = useAdminT()
  const askFor = useConfirmFor()
  return (previous: string) => askFor({
    title: t.tbLink,
    input: { label: t.promptLink, initial: previous, placeholder: 'https://' },
    confirmLabel: t.save,
    cancelLabel: t.askCancel,
  })
}

/** Apply what the box came back with. `null` is "backed out"; `''` removes the link. */
export async function editLink(
  editor: TiptapEditor,
  askLink: (previous: string) => Promise<string | null>,
): Promise<void> {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
  const url = await askLink(previous)
  if (url === null) return
  const range = editor.chain().focus().extendMarkRange('link')
  if (url === '') range.unsetLink().run()
  else range.setLink({ href: url }).run()
}

