// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { TrashView } from '@/admin/components/TrashView'

export default function Trash() {
  const state = useView('trash')
  return <View state={state}>{(data) => <TrashView {...data} />}</View>
}
