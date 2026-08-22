// Settings → System: content in and out, and the state of the install.
//
// Split out of `SettingsView.tsx` on 2026-08-22, when that file reached its 400-line
// ceiling. This is the tab that answers about the INSTALL rather than about the blog —
// import, cache, updates, backup, storage — which is also why nothing here reads a theme,
// a typeface or a menu. The other six tabs stay where they are: the point of the cut is one
// tab's worth of cards, not a scheme for splitting the screen seven ways.
//
// The state still lives in `SettingsView`. This takes the fields it needs and hands back
// changes, so there is still ONE form and ONE save button.

import type { SiteSettings } from '@/types'
import { Card } from './kit'
import { useAdminT } from './I18nProvider'
import { ImportFields } from './ImportFields'
import { ExportFields } from './ExportFields'
import { CacheFields } from './CacheFields'
import { StorageFields } from './StorageFields'
import { UpdateFields, type UpdateStatus } from './UpdateFields'

export function SettingsSystemTab(
  { s, update, updateStatus, grid, col }: {
    s: SiteSettings
    update: (partial: Partial<SiteSettings>) => void
    updateStatus: UpdateStatus
    grid: string
    col: string
  },
) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        {/* The WP importer is a one-time tool, not a setting, and it leads because it is the
            only card here somebody uses on their first day. */}
        <Card panel title={t.cardImport}>
          <ImportFields />
        </Card>
        <Card panel title={t.cacheTitle}>
          <CacheFields cache={s.cache} onChange={(cache) => update({ cache })} />
        </Card>
        <Card panel title={t.updateTitle}>
          <UpdateFields
            updateCheck={s.updateCheck}
            status={updateStatus}
            onChange={(updateCheck) => update({ updateCheck })}
          />
        </Card>
      </div>
      <div className={col}>
        <Card panel title={t.backupTitle}>
          <ExportFields backups={s.backups} onChange={(backups) => update({ backups })} />
        </Card>
        <Card panel title={t.storageTitle}>
          <StorageFields
            maxUploadMb={s.maxUploadMb}
            storageQuotaGb={s.storageQuotaGb}
            onMaxUploadMb={(maxUploadMb) => update({ maxUploadMb })}
            onStorageQuotaGb={(storageQuotaGb) => update({ storageQuotaGb })}
          />
        </Card>
      </div>
    </div>
  )
}
