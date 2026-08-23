// No server view: the conversation is client state, and the page needs nothing fetched
// to exist. The one prop is the localized title, which every page shell carries.
import { AssistantView } from '@/admin/components/AssistantView'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function Assistant() {
  const t = useAdminT()
  return <AssistantView title={t.navAssistant} />
}
