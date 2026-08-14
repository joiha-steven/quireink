// The site's marks: the wordmark or logo in the header, its dark twin, the browser favicon
// and the installed-app icon. Split out of `SiteFields`, which held both these and the site's
// identity and so left its tab a single card in a two-column layout.
//
// Every note sits above the control it belongs to, through `Setting` — three of them used to
// sit underneath.

import { useState } from 'react'
import type { SiteSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { ToggleField } from '@/admin/ui/Switch'
import { MediaLibrary } from './MediaLibrary'
import { IconUpload } from './IconUpload'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, Setting, SETTING_GAP } from './kit'

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function BrandFields({ s, update }: Props) {
  const t = useAdminT()
  // Which logo slot the media picker is filling. One picker, two targets.
  const [picking, setPicking] = useState<'light' | 'dark' | null>(null)

  return (
    <div className={SETTING_GAP}>
      <ToggleField label={t.showLogo} checked={s.showLogo} onChange={(v) => update({ showLogo: v })} />

      {s.showLogo && (
        <div className={SETTING_GAP}>
          <div className="space-y-3">
            {s.logoUrl ? (
              <img src={s.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-neutral-100 p-1" />
            ) : (
              <p className={NOTE_TEXT}>{t.noLogo}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => setPicking('light')}>{t.chooseLogo}</Button>
              {s.logoUrl && (
                <Button variant="ghost" type="button" onClick={() => update({ logoUrl: '' })}>{t.removeLogo}</Button>
              )}
            </div>
          </div>

          {/* The dark twin. Optional: with none set, the light mark is used in both modes,
              which is what every install did before this existed. The preview sits on a
              dark tile because that is the only background it will ever be seen on. */}
          <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <Setting label={t.chooseLogoDark} note={t.logoDarkHint}>
              <div className="space-y-3">
                {s.logoDarkUrl ? (
                  <img src={s.logoDarkUrl} alt="Logo (dark)" className="h-12 w-auto rounded bg-neutral-900 p-1" />
                ) : (
                  <p className={NOTE_TEXT}>{t.noLogoDark}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" type="button" onClick={() => setPicking('dark')}>{t.chooseLogoDark}</Button>
                  {s.logoDarkUrl && (
                    <Button variant="ghost" type="button" onClick={() => update({ logoDarkUrl: '' })}>{t.removeLogo}</Button>
                  )}
                </div>
              </div>
            </Setting>
          </div>

          <Input
            label={t.logoWidth}
            note={t.logoWidthHint}
            type="number"
            min={24}
            max={600}
            value={s.logoWidth}
            onChange={(e) => update({ logoWidth: Number(e.target.value) })}
          />
        </div>
      )}

      <Setting label={t.favicon} note={t.faviconHint}>
        <IconUpload kind="favicon" value={s.faviconUrl} onChange={(faviconUrl) => update({ faviconUrl })} previewClassName="h-8 w-8 rounded" />
      </Setting>

      <Setting label={t.appIcon} note={t.appIconHint}>
        <IconUpload kind="app-icon" value={s.appIconUrl} onChange={(appIconUrl) => update({ appIconUrl })} previewClassName="h-12 w-12 rounded-xl" />
      </Setting>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update(picking === 'dark' ? { logoDarkUrl: url } : { logoUrl: url })
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}
