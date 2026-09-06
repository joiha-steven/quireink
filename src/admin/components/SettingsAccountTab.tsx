// Settings → Account: you, and this admin.
//
// ADR 0041. Two things that had nowhere to be: how the OWNER signs in, which was filed under
// System beside the cache and the importer, and the handful of preferences that describe this
// TOOL rather than the blog — the dashboard's footer line, the activity log, the editor's
// chrome, motion, the key sounds, the autosave interval. Those last were on Appearance, which
// is a tab about what READERS see, so an owner turning off a sound they alone hear was
// changing a setting filed under their site's looks.
//
// EVERY CARD SAVES ITSELF. The security card is made of ACTIONS that each commit when pressed
// — a password change, a fresh set of recovery codes, a device signed out — so it has nothing
// left for a Save key to do; the preferences card is ordinary settings keys and saves them.
import type { SiteSettings } from '@/types'
import { SettingsCard } from './SettingsCard'
import { SettingsGroup } from './SettingsGroup'
import { ConnectionCard } from './ConnectionCard'
import { useAdminT } from './I18nProvider'
import { SecurityFields } from './SecurityFields'
import { AdvancedFields } from './AdvancedFields'
import { ActivityLogField } from './FeatureFields'
import { ToggleRow } from '@/admin/ui/Switch'
import { PANEL_LIST } from './kit'
import type { SettingsSave } from './useSettingsSave'

export function SettingsAccountTab({ s, update, form, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  form: SettingsSave
  grid: string
  col: string
}) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        {/* First on the tab, because it is the one card here somebody opens in a hurry — a
            laptop is gone and they want the session ended now. */}
        <SettingsCard title={t.securityTitle}>
          <SecurityFields />
        </SettingsCard>
      </div>
      <div className={col}>
        <ConnectionCard
          title={t.cardThisAdmin}
          connected
          dirty={form.changedIn('dashboard', 'features', 'ideChrome', 'motion', 'autosaveSeconds', 'typography')}
          onSave={() => form.savePartial({
            dashboard: s.dashboard,
            features: s.features,
            ideChrome: s.ideChrome,
            motion: s.motion,
            autosaveSeconds: s.autosaveSeconds,
            typography: s.typography,
          })}
        >
          <SettingsGroup title={t.dashboardTitle} first>
            <div className={PANEL_LIST}>
              <ToggleRow
                label={t.dashboardSystemLine}
                desc={t.dashboardSystemLineDesc}
                checked={s.dashboard.systemLine}
                onChange={(systemLine) => update({ dashboard: { ...s.dashboard, systemLine } })}
              />
            </div>
          </SettingsGroup>
          {/* THE ADMIN'S OWN RECORD, and it was filed under Reading and then System. It
              records what the OWNER did — saves, uploads, deletes — which is neither a
              reader feature nor a fact about the install: it is a fact about this person
              using this tool. */}
          <SettingsGroup title={t.cardActivity}>
            <ActivityLogField features={s.features} onChange={(features) => update({ features })} />
          </SettingsGroup>
          <SettingsGroup title={t.cardRendering}>
            <AdvancedFields
              typography={s.typography}
              onTypography={(typography) => update({ typography })}
              ideChrome={s.ideChrome}
              onIdeChrome={(ideChrome) => update({ ideChrome })}
              motion={s.motion}
              onMotion={(motion) => update({ motion })}
              autosaveSeconds={s.autosaveSeconds}
              onAutosaveSeconds={(autosaveSeconds) => update({ autosaveSeconds })}
            />
          </SettingsGroup>
        </ConnectionCard>
      </div>
    </div>
  )
}
