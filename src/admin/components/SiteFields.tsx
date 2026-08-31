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
import { FIELD_W, Select, Setting, SETTING_GAP } from './kit'

/**
 * Every zone the RUNTIME knows, asked for rather than listed.
 *
 * A list written here would be a second copy of the IANA database, staler than the one the
 * browser already ships and wrong the first time a country changes its rules — which they
 * do, several times a decade. `supportedValuesOf` has been in every current browser since
 * 2022; the fallback is not a shorter list but the ONE zone that is always right, because a
 * half-list would quietly hide somebody's own country from them.
 */
const ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
})()

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SiteFields({ s, update }: Props) {
  const t = useAdminT()
  const setLang = useSetAdminLang()

  return (
    <div className={SETTING_GAP}>
      {/* A SELECT, not a segmented strip. Ten languages in a wrapping track was a grey slab
          two rows tall holding one sunken key — a segmented control is for THREE or four
          answers read at a glance, and past that it is the worst of both worlds: the bulk of
          radio buttons with none of their scannability. One value from a long closed list is
          what a dropdown is FOR, and the timezone right under this one already shows the
          shape. `inline`, same as the timezone: a short answer takes a short field. */}
      <Setting inline label={t.siteLanguage} note={t.siteLanguageHint}>
        <Select
          value={s.language}
          onChange={(e) => {
            const v = e.target.value as SiteSettings['language']
            update({ language: v })
            setLang(v) // switch the admin UI instantly
          }}
          aria-label={t.siteLanguage}
        >
          {SITE_LANGS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </Select>
      </Setting>

      {/* Beside its label, and no longer the width of the card: a zone is a short answer, so
          it takes a short field and the row it was spending on its own. */}
      <Setting inline label={t.siteTimezone} note={t.siteTimezoneHint}>
        <Select
          className={FIELD_W.medium}
          wrapClassName="flex"
          value={s.timezone}
          onChange={(e) => update({ timezone: e.target.value })}
        >
          <option value="">{t.siteTimezoneServer}</option>
          {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </Select>
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
