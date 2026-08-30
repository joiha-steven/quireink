// Page shell for the static-page editor, at `/admin/page-editor` and
// `/admin/page-editor/<slug>`. Same shape as the post editor, one field lighter.

import { usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { PageForm } from '@/admin/components/PageForm'
export default function PageEditor() {
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/page-editor\/?/, ''))
  const state = useView('page-editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    // The list is drawn by the shell — see `PostEditor`.
    <div className="min-w-0 flex-1">
        <View state={state}>
          {(d) => (
        <PageForm
          // See PostEditor: without a key the editor keeps the previous document.
          key={d.page?.slug ?? 'new'}
          initial={d.page ?? undefined}
          contentWidth={d.contentWidth}
          keySound={d.keySound}
          autosaveSeconds={d.autosaveSeconds}
          autosaveAt={d.autosaveAt}
        />
          )}
      </View>
    </div>
  )
}
