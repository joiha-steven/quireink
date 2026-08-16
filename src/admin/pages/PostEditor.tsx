// Page shell for the post editor, at `/admin/editor` (new) and `/admin/editor/<slug>`.
//
// The slug comes out of the path rather than a route parameter, because the router here is
// a `popstate` listener and not a matcher. One endpoint serves both cases, so this does not
// branch on "new or existing" — only the editor itself knows the difference, from whether
// `initial` is set.

import { usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { PostForm } from '@/admin/components/PostForm'
import { WritePane } from '@/admin/components/WritePane'
import type { PostWithContent } from '@/types'

type Props = {
  post: PostWithContent | null
  allCategories: string[]
  allTags: string[]
  allSeries: string[]
  contentWidth: number
  typewriterEffects: boolean
  autosaveSeconds: number
}

export default function PostEditor() {
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/editor\/?/, ''))
  const state = useView<Props>('editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    <View state={state}>
      {(d) => (
        <div className="flex items-start gap-6">
          {/* The mock's write screen: the list beside the paper. `key`ed remount of the form
              on navigation keeps the pane mounted — clicking a row swaps only the sheet. */}
          <WritePane activeSlug={d.post?.slug} />
          <div className="min-w-0 flex-1">
        <PostForm
          // `key` matters: navigating from one post to another must REMOUNT the editor.
          // Without it Tiptap keeps the previous document and the form silently edits the
          // wrong post.
          key={d.post?.slug ?? 'new'}
          initial={d.post ?? undefined}
          allCategories={d.allCategories}
          allTags={d.allTags}
          allSeries={d.allSeries}
          contentWidth={d.contentWidth}
          typewriterEffects={d.typewriterEffects}
          autosaveSeconds={d.autosaveSeconds}
        />
          </div>
        </div>
      )}
    </View>
  )
}
