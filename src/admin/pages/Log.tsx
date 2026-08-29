// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { ActivityLog } from '@/admin/components/ActivityLog'

export default function Log() {
  const state = useView('log')
  return <View state={state}>{(data) => <ActivityLog {...data} />}</View>
}
