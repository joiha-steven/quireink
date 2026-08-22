// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { Overview } from '@/admin/components/Overview'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof Overview>

export default function Dashboard() {
  const state = useView<Props>('dashboard')
  return <View state={state}>{(data) => <Overview {...data} />}</View>
}
