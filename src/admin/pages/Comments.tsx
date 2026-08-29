// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { CommentsTable } from '@/admin/components/CommentsTable'

export default function Comments() {
  const state = useView('comments')
  return <View state={state}>{(data) => <CommentsTable initial={data.rows} />}</View>
}
