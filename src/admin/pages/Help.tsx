// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { useAdminT } from '@/admin/components/I18nProvider'
import { HelpGuide } from '@/admin/components/HelpGuide'

export default function Help() {
  const t = useAdminT()
  const state = useView<{ version: string }>('shell')
  return <View state={state}>{(data) => <HelpGuide title={t.navHelp} version={data.version} firstRunTitle={t.firstRunTitle} />}</View>
}
