// Page shell for the static-page editor, at `/admin/page-editor` and
// `/admin/page-editor/<slug>`. Same shape as the post editor, one field lighter.

import { usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { PageForm } from '@/admin/components/PageForm'
import { WritePane } from '@/admin/components/WritePane'
import { useFocusMode } from '@/admin/components/useFocusMode'
import type { PageWithContent, KeyFeedback } from '@/types'

type Props = { page: PageWithContent | null; contentWidth: number; keyFeedback: KeyFeedback; autosaveSeconds: number }

export default function PageEditor() {
  const [focus] = useFocusMode()
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/page-editor\/?/, ''))
  const state = useView<Props>('page-editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    <View state={state}>
      {(d) => (
        <div className="flex items-start gap-6">
          {!focus && <WritePane activeSlug={d.page?.slug} />}
          <div className="min-w-0 flex-1">
        <PageForm
          // See PostEditor: without a key the editor keeps the previous document.
          key={d.page?.slug ?? 'new'}
          initial={d.page ?? undefined}
          contentWidth={d.contentWidth}
          keyFeedback={d.keyFeedback}
          autosaveSeconds={d.autosaveSeconds}
        />
          </div>
        </div>
      )}
    </View>
  )
}
