// A wall clock on a named zone and the instant it names, both ways. Out of `utils.ts` at its
// 400-line ceiling; `utils.ts` re-exports both, so every caller keeps its import.

/**
 * How far a zone is from UTC at a given instant, in milliseconds.
 *
 * `Intl` is the only thing in the platform that knows a zone's rules, and it will only
 * FORMAT. So the instant is formatted in the zone, read back as if those numbers were UTC,
 * and the difference between that and the real instant is the offset. Unknown zone or bad
 * date: 0, because a wrong setting must not be able to throw inside a form.
 */
function zoneOffsetMs(at: Date, tz: string): number {
  if (!tz.trim()) return 0
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(f.find((x) => x.type === type)?.value ?? '0')
    // `hour12: false` still reports midnight as 24 in some engines.
    const hour = get('hour') % 24
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
    return asUtc - at.getTime()
  } catch {
    return 0
  }
}

/** An instant as the wall clock reads in `tz`, shaped for `<input type="datetime-local">`. */
export function isoToZonedInput(iso: string, tz: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return new Date(at.getTime() + zoneOffsetMs(at, tz)).toISOString().slice(0, 16)
}

/**
 * The reverse: a wall-clock `YYYY-MM-DDTHH:mm` in `tz`, as the instant it names.
 *
 * The offset depends on the instant, which is what is being solved for, so it is asked of the
 * day before and the day after: no zone moves its clock twice in two days. Each offset gives a
 * candidate, and a candidate is the answer when the zone really has that offset at it.
 *
 * ⚠️ A CALENDAR'S RULE AT THE BOUNDARY. A time the clock SKIPS is read as the hour after (02:30 on
 * a spring-forward night is 03:30), a time it REPEATS as the first of the two. The two passes this
 * replaced settled them by which side of UTC the zone sits: New York read the skipped 02:30 as
 * 01:30 and Berlin as 03:30, and the repeated hour as the first in one and the second in the other.
 */
export function zonedInputToIso(local: string, tz: string): string {
  const naive = new Date(`${local}:00.000Z`).getTime()
  if (Number.isNaN(naive)) return new Date().toISOString()
  const DAY = 86_400_000
  const before = zoneOffsetMs(new Date(naive - DAY), tz)
  const after = zoneOffsetMs(new Date(naive + DAY), tz)
  const fits = (offset: number): boolean => zoneOffsetMs(new Date(naive - offset), tz) === offset
  // Both fit in a repeated hour: the larger offset is the earlier instant. Neither fits in a
  // skipped one: the offset from before the jump lands an hour on, past the gap.
  const offset = fits(before) && fits(after) ? Math.max(before, after)
    : fits(after) ? after
    : before
  return new Date(naive - offset).toISOString()
}
