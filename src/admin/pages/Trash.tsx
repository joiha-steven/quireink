// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { TrashView } from '@/admin/components/TrashView'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof TrashView>

export default function Trash() {
  const state = useView<Props>('trash')
  return <View state={state}>{(data) => <TrashView {...data} />}</View>
}
