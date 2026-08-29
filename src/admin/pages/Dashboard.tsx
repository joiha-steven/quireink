// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { Overview } from '@/admin/components/Overview'

export default function Dashboard() {
  // Typed by NAME through ViewPayloads; the {...data} spread is where the compiler
  // checks the server's payload against Overview's props.
  const state = useView('dashboard')
  return <View state={state}>{(data) => <Overview {...data} />}</View>
}
