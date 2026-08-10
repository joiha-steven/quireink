import { TrendChart } from 'quireink'
import { DAILY } from './_fixtures'

// 30 days with a clear spike, so the peak marker and the two series are both legible.
export function ThirtyDays() {
  return (
    <TrendChart
      points={DAILY}
      peakLabel="Peak"
      viewsLabel="Views"
      visitorsLabel="Visitors"
    />
  )
}

export function OneWeek() {
  return (
    <TrendChart
      points={DAILY.slice(-7)}
      peakLabel="Peak"
      viewsLabel="Views"
      visitorsLabel="Visitors"
    />
  )
}

export function Flat() {
  return (
    <TrendChart
      points={DAILY.map((p) => ({ ...p, views: 120, visitors: 80 }))}
      peakLabel="Peak"
      viewsLabel="Views"
      visitorsLabel="Visitors"
    />
  )
}
