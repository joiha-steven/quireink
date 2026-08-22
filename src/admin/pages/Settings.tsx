// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { SettingsView } from '@/admin/components/SettingsView'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof SettingsView>

export default function Settings() {
  const state = useView<Props>('settings')
  return <View state={state}>{(data) => <SettingsView {...data} />}</View>
}
