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
export default function PostEditor() {
  const path = usePathname()
  const slug = decodeURIComponent(path.replace(/^\/admin\/editor\/?/, ''))
  const state = useView('editor', slug ? `?slug=${encodeURIComponent(slug)}` : '')
  return (
    // The list is drawn by the shell and outlives this page — see `App.tsx`. Only the sheet
    // waits for the payload, which is what makes clicking a row swap one thing and not two.
    <div className="min-w-0 flex-1">
        <View state={state}>
          {(d) => (
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
          keySound={d.keySound}
          autosaveSeconds={d.autosaveSeconds}
          autosaveAt={d.autosaveAt}
        />
          )}
      </View>
    </div>
  )
}
