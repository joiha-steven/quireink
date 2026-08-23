// The conversation is client state, so the only round trip is the two facts the screen has
// to be honest about: whether a model is connected, and which one is answering.
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { AssistantView } from '@/admin/components/AssistantView'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function Assistant() {
  const t = useAdminT()
  const state = useView<{ configured: boolean; model: string }>('assistant')
  return (
    <View state={state}>
      {(data) => <AssistantView title={t.navAssistant} configured={data.configured} model={data.model} />}
    </View>
  )
}
