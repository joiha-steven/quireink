// Timezone-correct time buckets, computed in TypeScript.
//
// The frozen tree did this in SQL: `date_trunc(bucket, created_at at time zone tz)`.
// SQLite has no timezone database and cannot truncate in a named zone, and a fixed UTC
// offset is wrong in general because zones observe DST: on the two changeover days a
// "day" is 23 or 25 hours long, so stepping by 86,400,000 ms silently slides every
// later bucket by an hour.
//
// So the boundaries are produced here, as explicit [lo, hi) pairs in epoch milliseconds,
// and SQLite is left to do what it is good at: counting rows inside a range that its
// index already orders. `Intl.DateTimeFormat` carries the IANA rules; it is a stable web
// standard and needs no dependency.
//
// Labels match the frozen tree's `to_char` formats exactly, because the admin renders
// them as-is.

export type Bucket = 'hour' | 'day' | 'week' | 'month'

export type BucketRange = {
  lo: number // inclusive, epoch ms
  hi: number // exclusive, epoch ms
  label: string
}

type Wall = { year: number; month: number; day: number; hour: number }

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = FORMATTERS.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      // `hourCycle: 'h23'`, NOT `hour12: false`. Under hour12:false a local midnight is
      // rendered as hour "24" of the PREVIOUS day, so `offsetAt` computed an offset a full
      // day out — and it did so precisely at the instants day and week buckets start on,
      // which is how a DST day came out 23 hours long instead of 25.
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    FORMATTERS.set(tz, f)
  }
  return f
}

/** Wall-clock fields of an instant, in `tz`. */
function localParts(ms: number, tz: string): Wall & { minute: number; second: number } {
  const p: Record<string, string> = {}
  for (const part of formatter(tz).formatToParts(ms)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    // Some engines render midnight as hour 24 under hour12:false.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute), second: Number(p.second),
  }
}

/** Zone offset in ms at an instant (positive east of Greenwich). */
function offsetAt(ms: number, tz: string): number {
  const p = localParts(ms, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * Interpret wall-clock fields as local time in `tz` and return the instant.
 *
 * Two passes: the first guess uses the offset at the wall time read as UTC, the second
 * corrects it using the offset actually in force at that guess. One pass is wrong within
 * an hour of a DST transition, which is exactly the case this file exists for.
 */
function fromWall(w: Wall, tz: string): number {
  const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour)
  const first = wall - offsetAt(wall, tz)
  return wall - offsetAt(first, tz)
}

/** Calendar-date helpers. Plain UTC arithmetic on the wall fields, never on instants. */
const toUtcDate = (w: Wall) => new Date(Date.UTC(w.year, w.month - 1, w.day))
const fromUtcDate = (d: Date, hour = 0): Wall => ({
  year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour,
})

function truncate(w: Wall, bucket: Bucket): Wall {
  if (bucket === 'hour') return { ...w }
  if (bucket === 'day') return { ...w, hour: 0 }
  if (bucket === 'month') return { year: w.year, month: w.month, day: 1, hour: 0 }
  // Week: Postgres `date_trunc('week')` starts on MONDAY. getUTCDay is 0 = Sunday.
  const d = toUtcDate(w)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return fromUtcDate(d)
}

function step(w: Wall, bucket: Bucket): Wall {
  if (bucket === 'hour') {
    // Adding an hour can roll the date, so go through the date object rather than
    // incrementing `hour` past 23.
    const d = toUtcDate(w)
    d.setUTCHours(w.hour + 1)
    return fromUtcDate(d, d.getUTCHours())
  }
  if (bucket === 'month') {
    return w.month === 12
      ? { year: w.year + 1, month: 1, day: 1, hour: 0 }
      : { year: w.year, month: w.month + 1, day: 1, hour: 0 }
  }
  const d = toUtcDate(w)
  d.setUTCDate(d.getUTCDate() + (bucket === 'week' ? 7 : 1))
  return fromUtcDate(d)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `to_char` equivalents: 'YYYY-MM-DD HH24:00', 'YYYY-MM', else 'YYYY-MM-DD'. */
function label(w: Wall, bucket: Bucket): string {
  const date = `${w.year}-${pad(w.month)}-${pad(w.day)}`
  if (bucket === 'hour') return `${date} ${pad(w.hour)}:00`
  if (bucket === 'month') return `${w.year}-${pad(w.month)}`
  return date
}

/** Falls back to UTC for a zone `Intl` does not know, rather than throwing at a reader. */
export function safeTimeZone(tz: string): string {
  try {
    formatter(tz).format(0)
    return tz
  } catch {
    return 'UTC'
  }
}

/**
 * Where a `days`-long window STARTS, so its first bucket is a whole one.
 *
 * `now - days * 86_400_000` is the obvious answer and the wrong one for anything drawn as a
 * chart: that instant lands mid-day, `bucketRanges` labels the bucket it falls in by its true
 * start, and the clamp counts only the tail — so a "30 days" chart drew THIRTY-ONE columns
 * whose leftmost was a sliver. Measured on a live blog 2026-08-29: column 0 covered 0.10 of a
 * day, showed 1 view beside the next day's 29, and read as a collapse in traffic that never
 * happened. Worse, the sliver is a function of the time of day, so the left edge shrank all day
 * and reset at midnight.
 *
 * Aligning to the bucket makes the window `days` whole days ending with today, which is what
 * the label says. The LAST bucket is still partial, and that one is honest: today is not over.
 *
 * `week` and `month` are not reachable from the admin but are part of the type, so they
 * truncate to their own bucket rather than pretending.
 */
export function windowStart(now: number, days: number, bucket: Bucket, tzRaw: string): number {
  const tz = safeTimeZone(tzRaw)
  if (bucket === 'hour' || bucket === 'day') {
    const span = bucket === 'hour' ? 3_600_000 : 86_400_000
    const count = bucket === 'hour' ? days * 24 : days
    return fromWall(truncate(localParts(now - (count - 1) * span, tz), bucket), tz)
  }
  return fromWall(truncate(localParts(now - days * 86_400_000, tz), bucket), tz)
}

/**
 * Every bucket touching [since, now], oldest first.
 *
 * The first range is CLAMPED to `since`, so its label is the true bucket start (matching
 * `date_trunc`) while it still counts only events inside the requested window, exactly as
 * the frozen tree's `where created_at >= since` did.
 */
export function bucketRanges(since: number, now: number, bucket: Bucket, tzRaw: string): BucketRange[] {
  const tz = safeTimeZone(tzRaw)
  const out: BucketRange[] = []
  let wall = truncate(localParts(since, tz), bucket)
  // A pathological zone/bucket combination must not spin forever; a year of hours is 8,784.
  for (let guard = 0; guard < 20_000; guard++) {
    const lo = fromWall(wall, tz)
    const next = step(wall, bucket)
    const hi = fromWall(next, tz)
    if (lo > now) break
    out.push({ lo: Math.max(lo, since), hi, label: label(wall, bucket) })
    if (hi <= lo) break // no forward progress: bail rather than loop
    wall = next
  }
  return out
}
