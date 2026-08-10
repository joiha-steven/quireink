import { StatTile } from 'quireink'

// `value` must be a NUMBER for the comparison to show: StatTile formats numbers itself with
// `toLocaleString()` and only renders its Trend when `typeof value === 'number'`. Passing a
// pre-formatted "4,218" silently drops `prev` — the tile then looks exactly like one with no
// baseline. Strings are still correct for values that are not counts ("3m 12s", "42%"), which
// is precisely when there is no trend to draw.
export function Basic() {
  return <StatTile label="Views" value={4218} />
}

export function WithComparison() {
  return <StatTile label="Views" value={4218} prev={3106} />
}

export function WithSub() {
  return <StatTile label="Visitors" value={1902} prev={1740} sub="unique, last 30 days" />
}

// A non-numeric value: formatted by the caller, and no trend by construction.
export function NonNumericValue() {
  return <StatTile label="Avg. read time" value="3m 12s" sub="median, last 30 days" />
}

export function AsARow() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile label="Views" value={4218} prev={3106} />
      <StatTile label="Visitors" value={1902} prev={1740} />
      <StatTile label="Comments" value={18} prev={27} />
      <StatTile label="Avg. read" value="3m 12s" />
    </div>
  )
}
