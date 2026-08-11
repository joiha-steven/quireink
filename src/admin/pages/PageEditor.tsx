// Page shell for the static-page editor, at `/admin/page-editor` and
// `/admin/page-editor/<slug>`. Same shape as the post editor, one field lighter.

import { usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { PageForm } from '@/admin/components/PageForm'
import type { PageWithContent } from '@/types'

type Props = { page: PageWithContent | null; contentWidth: number; typewriterEffects: boolean; autosaveSeconds: number }

export default function PageEditor() {
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/page-editor\/?/, ''))
  const state = useView<Props>('page-editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    <View state={state}>
      {(d) => (
        <PageForm
          // See PostEditor: without a key the editor keeps the previous document.
          key={d.page?.slug ?? 'new'}
          initial={d.page ?? undefined}
          contentWidth={d.contentWidth}
          typewriterEffects={d.typewriterEffects}
          autosaveSeconds={d.autosaveSeconds}
        />
      )}
    </View>
  )
}
