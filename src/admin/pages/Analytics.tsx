// Page shell for analytics. Two views behind one route, exactly as the frozen tree had it:
// the summary, or one page's detail when `?path=` is set. The range lives in the query
// string too, so a chosen window survives a reload and can be linked to.

import { useSearchParams } from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { AnalyticsView } from '@/admin/components/AnalyticsView'
import { AnalyticsPageDetail } from '@/admin/components/AnalyticsPageDetail'
export default function Analytics() {
  const params = useSearchParams()
  const range = params.get('range') ?? ''
  const path = params.get('path') ?? ''
  const query = `?${new URLSearchParams({ ...(range ? { range } : {}), ...(path ? { path } : {}) })}`
  const state = useView('analytics', query)
  return (
    <View state={state}>
      {(d) => ('detail' in d
        ? <AnalyticsPageDetail data={d.detail} title={d.title} range={d.range} />
        : <AnalyticsView data={d.summary} range={d.range} titles={d.titles} pieces={d.pieces} years={d.years} rightNow={d.rightNow} />)}
    </View>
  )
}
