// What the site IS: its language, its name, the words under the name, and how long an
// auto-written excerpt runs. No local settings state and no save button — the parent
// SettingsView owns both.
//
// The marks (logo, favicon, app icon) used to be in here too, which made this the one card on
// its tab and the tab the one that was a single column. They are `BrandFields` now: a
// different question, its own card, and the tab reads as two columns like every other.

import type { SiteSettings } from '@/types'
import { Input, Textarea } from '@/admin/ui/Input'
import { ToggleField } from '@/admin/ui/Switch'
import { SITE_LANGS } from '@/locales/langs'
import { useAdminT, useSetAdminLang } from './I18nProvider'
import { SEGMENT_TRACK, Setting, SETTING_GAP, tabItemClass } from './kit'

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SiteFields({ s, update }: Props) {
  const t = useAdminT()
  const setLang = useSetAdminLang()

  return (
    <div className={SETTING_GAP}>
      <Setting label={t.siteLanguage} note={t.siteLanguageHint}>
        <div className={`${SEGMENT_TRACK} flex-wrap`}>
          {SITE_LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => {
                update({ language: l.value })
                setLang(l.value) // switch the admin UI instantly
              }}
              className={tabItemClass(s.language === l.value, 'sm')}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Setting>

      <Input label={t.siteTitle} value={s.title} onChange={(e) => update({ title: e.target.value })} placeholder="Quire Ink" />

      <Textarea
        label={t.siteDescription}
        rows={2}
        value={s.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder={t.siteDescriptionPlaceholder}
      />

      <ToggleField label={t.showDescription} checked={s.showDescription} onChange={(v) => update({ showDescription: v })} />

      <Input
        label={t.excerptLength}
        note={t.excerptLengthHint}
        type="number"
        min={10}
        max={100}
        value={s.excerptLength}
        onChange={(e) => update({ excerptLength: Number(e.target.value) })}
      />
    </div>
  )
}
