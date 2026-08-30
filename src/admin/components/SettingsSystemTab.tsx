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
import { SecurityFields } from './SecurityFields'
import { OffsiteFields } from './OffsiteFields'
import { StorageFields } from './StorageFields'
import { UpdateFields, type UpdateStatus } from './UpdateFields'
import { ActivityLogField } from './FeatureFields'

export function SettingsSystemTab(
  { s, update, updateStatus, offsiteConfigured, s3Bucket, grid, col }: {
    s: SiteSettings
    update: (partial: Partial<SiteSettings>) => void
    updateStatus: UpdateStatus
    offsiteConfigured: boolean
    s3Bucket: string
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
        {/* First on the tab, because it is the one card here somebody opens in a hurry —
            a laptop is gone and they want the session ended now. */}
        <Card panel title={t.securityTitle}>
          <SecurityFields />
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
        {/* THE ADMIN'S OWN RECORD, and it was filed under Reading.
            It records what the OWNER did — saves, uploads, deletes — to the Log page, which
            is neither a reader feature nor anything a reader can see. The tab it sat on
            prints "What a reader gets on a post: the extras, and whether they can reply", so
            the tab's own printed promise was the argument against keeping it there; its
            component comment already said "Not a reader feature at all". This tab answers
            about the INSTALL, which is what an audit log is. `settings-index.ts` moved with
            it, or search would still send people to Reading. */}
        <Card panel title={t.cardActivity}>
          <ActivityLogField features={s.features} onChange={(features) => update({ features })} />
        </Card>
      </div>
      <div className={col}>
        <Card panel title={t.backupTitle}>
          <ExportFields backups={s.backups} onChange={(backups) => update({ backups })} />
        </Card>
        {/* The snapshot that leaves the machine (ADR 0035): a copy beside the data does
            not survive the disk. Sits under the backups it ships. */}
        <Card panel title={t.offsiteTitle}>
          <OffsiteFields configured={offsiteConfigured} bucket={s3Bucket} />
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
