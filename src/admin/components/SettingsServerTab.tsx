// Settings → Server & connections: who this machine talks to, and what it does on its own.
//
// ADR 0041. It absorbs the old Search & URLs, Connections, AI and System tabs, on the
// argument that all four answered one question with four names on it — what this INSTALL
// does, as opposed to what the blog is or what a post looks like.
//
// EVERY CARD THAT HOLDS SETTINGS KEYS SAVES ITSELF, and since 2026-09-07 the sheet's Save
// renders here too (ADR 0041, revised). That is the reason the ADR collapses mixed keys into
// one CARD rather than one tab: the SEO switches, the custom code, the cache, the update
// check and the storage limits are ordinary settings keys, so they go into a single card at
// the top with its own Save that PUTs only those keys. Everything else on the tab already
// owned an endpoint before this ADR.
//
// ⚠️ TWO CARDS KEEP THEIR OWN CONTROLS RATHER THAN A SAVE KEY, and that is not an exception
// to the rule. Redirects and the import are made of ACTIONS — add a row, upload a file — each
// of which commits by itself the moment it is pressed. A card whose every control has already
// committed has nothing left for a Save key to do, and adding one would invent a state
// ("pressed the button, did not save") that cannot exist.
//
// The backup card was counted among them and should not have been: running a snapshot is an
// action, but the SCHEDULE beside it is three settings keys, and with no key on the card and
// none on the tab there was nowhere to store them from.
import type { SiteSettings } from '@/types'
import type { IntegrationStatus } from '@/store/integration-keys'
import { SettingsCard } from './SettingsCard'
import { SettingsGroup } from './SettingsGroup'
import { ConnectionCard } from './ConnectionCard'
import { useAdminT } from './I18nProvider'
import { SeoFields } from './SeoFields'
import { SnippetEditor } from './SnippetEditor'
import { RedirectsManager } from './RedirectsManager'
import { CloudflareCard } from './CloudflareFields'
import { OffsiteCard } from './OffsiteFields'
import { AiCard } from './AiFields'
import { McpFields } from './McpFields'
import { CacheFields } from './CacheFields'
import { StorageFields } from './StorageFields'
import { UpdateFields, type UpdateStatus } from './UpdateFields'
import { ImportFields } from './ImportFields'
import { ExportFields } from './ExportFields'
import type { SettingsSave } from './useSettingsSave'

export function SettingsServerTab({ s, update, integrations, updateStatus, updateStatusValue, form, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  integrations: IntegrationStatus
  updateStatus: UpdateStatus
  updateStatusValue: boolean
  form: SettingsSave
  grid: string
  col: string
}) {
  const t = useAdminT()
  void updateStatusValue
  return (
    <div className={grid}>
      <div className={col}>
        {/* ⚠️ TWO CARDS OF ORDINARY SETTINGS KEYS on a tab that otherwise saves through five
            different endpoints. Each Save calls the same PUT the save-as-one tabs' key does,
            with only that card's keys in the body — the endpoint merges, so nothing else on
            the record is touched.
            It was ONE card holding all five groups, which measured 1,389px and took the tab
            to 2,188 against the 1,800 this regrouping was measured to fix. Splitting on the
            line the tab already draws — what the SITE says to the world, and what the INSTALL
            does on its own — is what a second card is for. */}
        <ConnectionCard
          title={t.cardServerSettings}
          dirty={form.changedIn('seo', 'customHead', 'customBodyEnd')}
          connected
          onSave={() => form.savePartial({
            seo: s.seo,
            customHead: s.customHead,
            customBodyEnd: s.customBodyEnd,
          })}
        >
          <SettingsGroup title={t.tabServer} first>
            <SeoFields s={s} update={update} />
          </SettingsGroup>
          <SettingsGroup title={t.cardCustomCode} note={t.customCodeNote}>
            <div className="space-y-4">
              <SnippetEditor
                value={s.customHead}
                onChange={(customHead) => update({ customHead })}
                label={t.customHeadLabel}
                note={t.customHeadHint}
                placeholder={'<script defer src="https://example.com/script.js"></script>'}
              />
              <SnippetEditor
                value={s.customBodyEnd}
                onChange={(customBodyEnd) => update({ customBodyEnd })}
                label={t.customBodyEndLabel}
                note={t.customBodyEndHint}
                placeholder={'<script defer src="https://example.com/beacon.js"></script>'}
              />
            </div>
          </SettingsGroup>
        </ConnectionCard>
        <CloudflareCard
          configured={integrations.cloudflareConfigured}
          zoneId={integrations.cloudflareZoneId}
          webhookConfigured={integrations.purgeWebhookConfigured}
        />
        {/* ⚠️ THE STACKS ARE ASSIGNED BY MEASUREMENT, not by subject, and this tab is where
            that matters most: it absorbed four of the old eight, so it holds nine cards and
            any hand-made split leaves a hole. Measured at 1440px on the showcase fixture:
            994 · 424 · 282 · 203 on the left against 500 · 282 · 339 · 384 · 378 on the
            right — 1,963 a side. Re-measure before moving one across. */}
        <SettingsCard title={t.redirectsTitle}>
          <RedirectsManager />
        </SettingsCard>
        <SettingsCard title={t.cardImport}>
          <ImportFields />
        </SettingsCard>
      </div>
      <div className={col}>
        {/* ⚠️ THE STACKS ARE ASSIGNED BY MEASUREMENT, not by subject. At 1440px on the
            showcase fixture the first cut left 2,134 against 1,664 — a 470px hole beside
            the tallest card on the screen, and a tab 2,409px long against the 1,800 this
            regrouping was measured to fix. Redirects and the import moved; re-measure
            before moving anything back. */}
        <ConnectionCard
          title={t.cardInstall}
          dirty={form.changedIn('cache', 'updateCheck', 'maxUploadMb', 'storageQuotaGb')}
          connected
          onSave={() => form.savePartial({
            cache: s.cache,
            updateCheck: s.updateCheck,
            maxUploadMb: s.maxUploadMb,
            storageQuotaGb: s.storageQuotaGb,
          })}
        >
          <SettingsGroup title={t.cacheTitle} first>
            <CacheFields cache={s.cache} onChange={(cache) => update({ cache })} />
          </SettingsGroup>
          <SettingsGroup title={t.updateTitle}>
            <UpdateFields
              updateCheck={s.updateCheck}
              status={updateStatus}
              onChange={(updateCheck) => update({ updateCheck })}
            />
          </SettingsGroup>
          <SettingsGroup title={t.storageTitle}>
            <StorageFields
              maxUploadMb={s.maxUploadMb}
              storageQuotaGb={s.storageQuotaGb}
              onMaxUploadMb={(maxUploadMb) => update({ maxUploadMb })}
              onStorageQuotaGb={(storageQuotaGb) => update({ storageQuotaGb })}
            />
          </SettingsGroup>
        </ConnectionCard>
        <AiCard
          configured={integrations.aiConfigured}
          provider={integrations.aiProvider}
          model={integrations.aiModel}
          seesImages={integrations.aiSeesImages}
          ai={s.ai}
          onChangeAi={(ai) => update({ ai })}
          savePartial={form.savePartial}
          dirty={form.changedIn('ai')}
        />
        <ConnectionCard
          title={t.cardMcp}
          enabled={s.mcp.enabled}
          connected={s.mcp.enabled}
          dirty={form.changedIn('mcp')}
          onSave={() => form.savePartial({ mcp: s.mcp })}
        >
          {/* `live` is the switch as the SERVER has it, derived rather than fetched: an
              unchanged card means the form value and the stored one are the same, so a clean
              card plus `enabled` is exactly "the endpoint is answering". */}
          <McpFields
            mcp={s.mcp}
            live={s.mcp.enabled && !form.changedIn('mcp')}
            siteUrl={s.siteUrl}
            onChange={(mcp) => update({ mcp })}
          />
        </ConnectionCard>
        {/* ⚠️ A CARD WITH KEYS NEEDS A KEY. The backup schedule — on/off, how often, how many
            to keep — is three ordinary settings keys, and this card was a plain one: the
            switch changed the form and nothing on the tab could store it, because the
            sheet's Save did not render here. Running a snapshot and downloading one are the
            card's actions and commit themselves; the schedule is a setting and needed this. */}
        <ConnectionCard
          title={t.backupTitle}
          connected={s.backups.enabled}
          enabled={s.backups.enabled}
          dirty={form.changedIn('backups')}
          onSave={() => form.savePartial({ backups: s.backups })}
        >
          <ExportFields backups={s.backups} onChange={(backups) => update({ backups })} />
        </ConnectionCard>
        {/* The snapshot that leaves the machine (ADR 0035): a copy beside the data does not
            survive the disk. Sits under the backups it ships. */}
        <OffsiteCard configured={integrations.offsiteConfigured} bucket={integrations.s3Bucket} />
      </div>
    </div>
  )
}
