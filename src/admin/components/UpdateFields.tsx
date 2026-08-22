// Settings → System → Updates. One switch, and the answer it buys.
//
// The switch and the release line belong in one card because they are one bargain: the blog
// asks what the newest version is, and is counted by asking. Splitting them would leave a
// toggle whose value is not on the screen and a notice with no visible source.
//
// `server/update-check.ts` states exactly what leaves the machine, and `docs/self-host.md`
// states it again for somebody deciding whether to allow it. Neither sentence belongs here
// in full — this is the summary the note carries, and the deep answer is one link away.

import type { Release } from '@/server/update-check'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, PANEL, Setting, SETTING_GAP } from './kit'

export type UpdateStatus = { blockedBy: string | null; newer: Release | null }

export function UpdateFields(
  { updateCheck, status, onChange }:
  { updateCheck: boolean; status: UpdateStatus; onChange: (v: boolean) => void },
) {
  const t = useAdminT()
  return (
    <div className={SETTING_GAP}>
      <div className={PANEL}>
        <ToggleRow
          label={t.updateCheckLabel}
          desc={t.updateCheckDesc}
          // The badge, not a disabled switch, and it prints the VARIABLE that is in the way
          // rather than a sentence about it. Two things override this setting — an operator's
          // `UPDATE_CHECK=0`, and a build started without `NODE_ENV=production` — and a switch
          // left ON above a check that will never run is a screen telling its owner something
          // untrue. Naming which one won is the only honest option, and it is the difference
          // between two different fixes. The switch itself stays live: the value is the
          // owner's and outlives whoever is hosting them this month.
          badge={status.blockedBy ?? undefined}
          checked={updateCheck}
          onChange={onChange}
        />
      </div>
      {status.newer && (
        <Setting label={t.updateAvailable.replace('{v}', status.newer.latest)} note={t.updateAvailableNote}>
          <a
            href={status.newer.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${NOTE_TEXT} underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white`}
          >
            {t.updateAvailableLink} ({status.newer.date}) ↗
          </a>
        </Setting>
      )}
    </div>
  )
}
