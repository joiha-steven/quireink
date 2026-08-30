// The cache switch (Settings -> System), plus the manual purge that was already in the
// sidebar.
//
// One switch, two layers: the page cache inside this process and what a shared cache in
// front of it is allowed to do. They move together because separating them is a trap —
// turning off only the in-process cache leaves Cloudflare answering with the copy you are
// trying to get rid of, and the switch looks broken from outside.

import type { CacheSettings } from '@/types'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { buttonClass } from '@/admin/ui/Button'
import { CacheButton } from './CacheButton'
import { PANEL, Setting, SETTING_GAP } from './kit'

/** `CacheButton` takes a class rather than a variant, so it asks Button for one. It used to
    carry a transcription of the secondary variant instead, under a comment saying so. */
const CLEAR_BUTTON = buttonClass('secondary')

export function CacheFields(
  { cache, onChange }: { cache: CacheSettings; onChange: (c: CacheSettings) => void },
) {
  const t = useAdminT()
  return (
    <div className={SETTING_GAP}>
      <div className={PANEL}>
        <ToggleRow
          label={t.cacheEnable}
          desc={t.cacheEnableDesc}
          checked={cache.enabled}
          onChange={(enabled) => onChange({ ...cache, enabled })}
        />
      </div>
      <Setting label={t.clearCache} note={t.cacheClearDesc} inline>
        <CacheButton className={CLEAR_BUTTON} />
      </Setting>
    </div>
  )
}
