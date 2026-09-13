// The scratch a headless browser leaves behind, and the one rule for clearing it.
//
// `tour.ts` and `drive.ts` both hand Chrome a private profile directory — they have to, since
// Chrome 136 ignores the remote-debugging switches on the default profile — and both remove it
// on the way out. Neither can remove it when the run itself is killed, and a run that is only
// killed sometimes leaves a mess that grows for weeks: twenty-eight directories were sitting
// under `.tmp` on 2026-09-14, the oldest two days old and the largest 3 MB.
//
// So each script sweeps what earlier runs abandoned, on the way IN, where nothing is at stake.
import { readdirSync, rmSync, statSync } from 'node:fs'

/**
 * Remove the profile directories under `.tmp` that no live run can still be using.
 *
 * AN HOUR, because these runs are minutes: the tour waits at most thirty seconds for a
 * browser and the whole run takes a few, and a screenshot is seconds. A directory older than
 * that belongs to nobody. The age matters because two runs may now go at once — the debugging
 * port is ephemeral since 2026-09-14 — and neither may sweep the other's profile out from
 * under it.
 *
 * @param prefix the directory name's prefix, e.g. `tour-chrome-profile-`.
 * @returns how many were removed, so the caller can say so rather than doing it in silence.
 */
export function sweepAbandonedProfiles(prefix: string): number {
  const HOUR = 60 * 60 * 1000
  let swept = 0
  for (const name of readdirSync('.tmp')) {
    if (!name.startsWith(prefix)) continue
    try {
      if (Date.now() - statSync(`.tmp/${name}`).mtimeMs < HOUR) continue
      rmSync(`.tmp/${name}`, { recursive: true, force: true })
      swept++
    } catch { /* another run got there first, or it is already gone */ }
  }
  return swept
}
