// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { CommentsTable } from '@/admin/components/CommentsTable'
import type { ComponentProps } from 'react'

type Rows = { rows: ComponentProps<typeof CommentsTable>['initial'] }

export default function Comments() {
  const state = useView<Rows>('comments')
  return <View state={state}>{(data) => <CommentsTable initial={data.rows} />}</View>
}
