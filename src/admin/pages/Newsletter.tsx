// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { NewsletterView } from '@/admin/components/NewsletterView'

export default function Newsletter() {
  const state = useView('newsletter')
  return <View state={state}>{(data) => <NewsletterView {...data} />}</View>
}
