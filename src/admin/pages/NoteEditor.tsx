// Page shell for the note editor, at `/admin/note-editor` and `/admin/note-editor/<slug>`.
// Same shape as the page editor, with the site's clock passed through for the date field.

import { usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { NoteForm } from '@/admin/components/NoteForm'
export default function NoteEditor() {
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/note-editor\/?/, ''))
  const state = useView('note-editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    // The list is drawn by the shell — see `PostEditor`.
    <div className="min-w-0 flex-1">
        <View state={state}>
          {(d) => (
        <NoteForm
          // See PostEditor: without a key the editor keeps the previous document.
          key={d.note?.slug ?? 'new'}
          initial={d.note ?? undefined}
          contentWidth={d.contentWidth}
          keySound={d.keySound}
          autosaveSeconds={d.autosaveSeconds}
          autosaveAt={d.autosaveAt}
          timezone={d.timezone}
        />
          )}
      </View>
    </div>
  )
}
