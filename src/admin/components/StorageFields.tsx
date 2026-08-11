// Settings → System → Storage: the largest single upload, and the largest the whole store
// may grow.
//
// Both fields NARROW a ceiling they cannot raise (`media/limits.ts`). `MAX_UPLOAD_MB` and
// `STORAGE_QUOTA_GB` belong to whoever runs the server; 0 here means "whatever they said",
// which is why the hints name that rather than printing a number this component cannot know.
// The dashboard is where the bytes actually in use are shown.

import { Input } from '@/admin/ui/Input'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST } from './kit'

/**
 * A size field that accepts being emptied mid-retype, and reads an empty box as 0.
 *
 * `Count` in `ExportFields` clamps to a minimum of 1 and would turn an emptied box into a 1,
 * which here is the difference between "follow the server" and "one megabyte".
 */
function Size({
  label, note, value, max, onChange,
}: {
  label: string
  note: string
  value: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <Input
      label={label}
      note={note}
      type="number"
      min={0}
      max={max}
      value={value}
      onChange={(e) => {
        if (e.target.value === '') return onChange(0)
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, Math.round(n))))
      }}
    />
  )
}

export function StorageFields({
  maxUploadMb, storageQuotaGb, onMaxUploadMb, onStorageQuotaGb,
}: {
  maxUploadMb: number
  storageQuotaGb: number
  onMaxUploadMb: (n: number) => void
  onStorageQuotaGb: (n: number) => void
}) {
  const t = useAdminT()
  return (
    <div className={PANEL_LIST}>
      <Size
        label={t.maxUploadLabel}
        note={t.maxUploadHint}
        value={maxUploadMb}
        max={4096}
        onChange={onMaxUploadMb}
      />
      <Size
        label={t.storageQuotaLabel}
        note={t.storageQuotaHint}
        value={storageQuotaGb}
        max={4096}
        onChange={onStorageQuotaGb}
      />
    </div>
  )
}
