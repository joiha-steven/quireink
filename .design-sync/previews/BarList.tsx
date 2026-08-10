import { BarList } from 'quireink'
import { BAR_ROWS, REFERRERS } from './_fixtures'

// Plausible-style: the proportional bar IS the row background, and bars scale to the biggest
// value in the set, so the top row is always full width.
export function TopPages() {
  return <BarList title="Top pages" rows={BAR_ROWS} unit="views" empty="No page views yet." />
}

export function Referrers() {
  return <BarList title="Referrers" rows={REFERRERS} unit="visitors" empty="No referrers yet." />
}

export function EmptyState() {
  return <BarList title="Countries" rows={[]} unit="visitors" empty="No visitors in this range." />
}
