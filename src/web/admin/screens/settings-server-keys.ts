// Settings → Server: THE CREDENTIALS. Three cards that reach something outside this machine —
// the CDN whose cache this blog flushes, the model it pays for, the bucket its snapshots leave
// on — plus the one shape they all use to ask for a secret.
//
// ⚠️ NOT ONE SECRET IS WRITTEN HERE, and it is not an oversight that the fields look empty.
// These keys live in the server-only `integration_keys` table and are NEVER returned:
// `getIntegrationStatus()` hands back booleans plus the values that are deliberately public —
// the Cloudflare zone, the bucket name, the AI provider and model. A credential field therefore
// ships BLANK with a placeholder saying one is stored, and blank means KEEP: the save sends
// only the fields that were typed into, because anything else silently wipes a working key the
// first time somebody saves the card to change something else (`useSecretKeys.ts`).
//
// ⚠️ NO `data-k` ON ANY CREDENTIAL. `data-k` is what puts a control in the sheet's diff and in
// the payload its one Save sends; an API token is none of the sheet's business and its endpoint
// is not `PUT /api/settings`. They wear `data-cf-*`, `data-ai-*` and `data-s3-*`, which the
// form's reader does not look at. `keys: []` on those cards says the same thing to the island:
// nothing here can make the settings form dirty.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import type { IntegrationStatus } from '@/store/integration-keys'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { META, NOTE_ALERT, NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { settingRow, switchList, switchRow, textControl } from '@/web/admin/fields'
import { connectionCard, pairGrid } from '@/web/admin/fields-box'
import { pickControl } from '@/web/admin/fields-pick'
import { AI_PROVIDERS, AI_PROVIDER_NAMES } from '@/server/ai-capabilities'

/** Cloudflare's own page for minting a Zone.Cache Purge token. */
const CF_TOKENS = 'https://dash.cloudflare.com/profile/api-tokens'

/**
 * ONE CREDENTIAL FIELD: a real label, and a placeholder carrying the only thing a placeholder
 * was ever good for.
 *
 * Nine of these used the placeholder AS the label until 2026-09-07, which is the one job a
 * placeholder cannot do: it disappears the moment somebody types, so the field they are typing
 * into stops saying what it is, and a screen reader never had the name at all. With the name on
 * a label, the placeholder is free to say whether something is already stored — and therefore
 * that leaving it blank keeps it.
 */
function secret(t: AdminStrings, f: {
  label: string
  /**
   * The name the card's ROUTE takes this by, and the only hook these fields need.
   *
   * ⚠️ THEY USED TO WEAR A `data-cf-*` / `data-s3-*` HOOK AS WELL, as the marker that said "not
   * a setting". `data-card-field` is that marker now and it carries the name too, so a second
   * attribute would be a second answer to the same question with nothing reading it.
   */
  name: string
  /** Whether the server holds one already. Never the value — the server will not return it. */
  stored?: boolean
  /** A PUBLIC value worth showing as the ghost text, where there is one: the bucket's name. */
  shown?: string
  password?: boolean
}): string {
  return settingRow({
    label: f.label,
    control: textControl({
      value: '', label: f.label, type: f.password ? 'password' : 'text',
      placeholder: f.shown || (f.stored ? t.commentsKeySet : ''),
      // ⚠️ `data-card-field` IS WHAT SENDS IT. Until 2026-09-15 these boxes carried only their
      // own `data-x` hook, and `settings-cards.ts` collects `[data-card-field]` — so nothing on
      // any of the three cards was ever posted. Worse than a dead key: with no route on the card
      // the island fell through to the settings partial, found no `data-k` inside, sent nothing,
      // and turned the lamp GREEN. An owner pasted a token, pressed Save, was told the
      // connection was good, and nothing had been stored.
      attrs: `data-card-field="${escapeAttr(f.name)}"`,
    }),
  })
}

/**
 * The CDN this blog flushes when anything changes.
 *
 * Once set, the app purges the whole zone on every content change and on "Clear cache", so an
 * edit is live with no manual purge. The webhook beside it is any OTHER CDN (ADR 0033) — one
 * URL this blog POSTs to when it flushes, so an install behind Bunny, Fastly or a script in
 * front of nginx gets what a Cloudflare install has had. Password-typed because a purge URL
 * usually carries its own token in it.
 *
 * The zone id is not a secret and `getIntegrationStatus()` returns it — and the field still
 * ships blank, because on this card blank is what means KEEP. A prefilled zone would be resent
 * on every save of the card, which is a different rule for one field out of three.
 */
export function cloudflareCard(t: AdminStrings, i: IntegrationStatus): string {
  const on = i.cloudflareConfigured
  return connectionCard({
    title: t.cardCloudflare,
    keys: [],
    route: '/api/integrations/cloudflare',
    // ⚠️ AMBER, NOT GREY, WHEN THERE ARE NO CREDENTIALS. Grey is `connectionOff` and it means
    // somebody switched this off on purpose; this card has no switch, so the only thing "off"
    // could mean here is "never set up", and that is a thing to DO rather than a settled state.
    // React's `ConnectionCard` defaulted `enabled` to true for exactly this reason, so an
    // unconfigured connection read amber with "Saved, but not tried yet". Measured against it
    // 2026-09-15: this lamp was the wrong colour on both of these cards.
    state: on ? 'good' : 'attention',
    lampTitle: on ? t.connectionOk : t.connectionUntested,
    saveLabel: t.save,
    body: `<div class="space-y-3">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.cfHelp)} `
      + `<a href="${CF_TOKENS}" target="_blank" rel="noopener"`
      + ` class="font-medium underline hover:text-neutral-900 dark:hover:text-white">`
      + `${escapeHtml(t.commentsHelpOpen)}</a></p>`
      + secret(t, { label: t.cfZoneId, name: 'cloudflareZoneId',
        stored: Boolean(i.cloudflareZoneId) })
      + secret(t, { label: t.cfToken, name: 'cloudflareApiToken',
        stored: on, password: true })
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.cfWebhookHelp)}</p>`
      + secret(t, {
        label: t.cfWebhook, name: 'purgeWebhookUrl',
        stored: i.purgeWebhookConfigured, password: true,
      })
      + `</div>`,
  })
}

/**
 * ONE CARD, TWO STORES, ONE BUTTON (ADR 0041).
 *
 * The MODEL half — provider, key, model — is a secret with its own endpoint. The JOBS half is
 * `settings.ai`. They used to be saved by two different buttons with nothing on screen saying
 * which switch belonged to which; the card's Save now writes both, credentials first, because a
 * job switched on against a key that did not store is a switch pointing at nothing.
 *
 * ⚠️ THE MODEL MENU IS EMPTY AT RENDER, and there is no server read that would fill it. The
 * list comes from `POST /api/integrations/ai/models`, which is also the only TEST of the key —
 * listing models is the cheapest request that still has to authenticate. So the select ships
 * holding the ONE model the server does know it is using, disabled, which is the state React
 * drew when the list failed: obviously not a menu, still an answer. The island removes
 * `disabled` and fills it once the provider has replied.
 *
 * ⚠️ THE FOUR REFUSALS RIDE AS ATTRIBUTES. The provider's own sentence is the half that
 * explains WHICH of the several things that return 401 has happened — a revoked key, a key from
 * the wrong account, a project with no billing — and the island has no locale dictionary to put
 * in front of it.
 */
export function aiCard(t: AdminStrings, s: SiteSettings, i: IntegrationStatus): string {
  const off = i.aiProvider === ''
  const said = `<span data-ai-said`
    + ` data-tpl-ok="${escapeAttr(t.aiModelsOk)}" data-say-bad-key="${escapeAttr(t.aiKeyRejected)}"`
    + ` data-say-limited="${escapeAttr(t.aiKeyLimited)}" data-say-unreachable="${escapeAttr(t.aiNoReach)}"`
    + ` data-say-refused="${escapeAttr(t.aiProviderRefused)}" data-say-failed="${escapeAttr(t.aiModelsFailed)}">`
    // `META`, not `NOTE_TEXT`: these two say what the last attempt FOUND, and `NOTE_TEXT`
    // carries `admin-note` — the handle that hides every explanation on this screen at once. An
    // owner with the explanations quiet would press Load models and be told nothing at all,
    // which is the same reason `NOTE_ALERT` (the refusal below) does not carry the handle.
    + `<span class="${META}" data-ai-loading hidden>${escapeHtml(t.aiModelsLoading)}</span>`
    + `<span class="${META}" data-ai-ok hidden></span>`
    + `<span class="${NOTE_ALERT}" data-ai-bad hidden></span></span>`
  // THE BUTTON, and why a card that loads the list by itself needs one. The automatic load
  // fires on mount and on blur, which are moments the owner is not watching — so a key that
  // stopped working showed up as a menu that simply did not change. Pressing this is the only
  // thing on the page that says, right now, whether the provider will take the key.
  const check = `<div class="flex flex-wrap items-center gap-x-3 gap-y-2">`
    + `<button type="button" data-ai-models-load${i.aiConfigured ? '' : ' disabled'}`
    + ` class="${buttonClass('secondary')}">${escapeHtml(t.aiModelsLoad)}</button>${said}</div>`
  const model = `<span data-ai-model-box${i.aiModel ? '' : ' hidden'}>`
    + pickControl({
      value: i.aiModel, width: 'full', label: t.aiModelLabel, attrs: 'data-ai-model data-card-field="aiModel" disabled',
      options: i.aiModel ? [[i.aiModel, i.aiModel]] : [],
    }) + `</span>`
  // THE KEY IS THE SWITCH for everything the model does with the owner's OWN material: alt text
  // and excerpts follow it and are not decisions on this card. The comment guard keeps its
  // switch, and that is the one difference that matters — it sends a READER'S words to a third
  // party, which is a decision about somebody else's data, and the person who has to declare it
  // in a privacy policy is the person who should be asked.
  //
  // ⚠️ THE SWITCH SHOWS WHAT IS STORED, where React drew it off whenever no model was
  // configured. It is DISABLED either way, which is what says "unavailable" rather than "off" —
  // but here the payload IS the DOM, so a switch drawn off over a record that says on would
  // turn the guard off the next time anybody saved this card for an unrelated reason.
  const jobs = `<div class="border-t border-neutral-100 pt-5 dark:border-neutral-800">`
    + settingRow({
      label: t.aiTasksLabel,
      noteHtml: `<span data-ai-need-model${i.aiConfigured ? ' hidden' : ''}>`
        + `${escapeHtml(t.aiTasksNeedModel)}</span>`,
      control: `<p class="${NOTE_TEXT}">${escapeHtml(t.aiAutoJobs)}`
        + `<span data-ai-blind${i.aiSeesImages ? ' hidden' : ''}> ${escapeHtml(t.aiCannotSeeImages)}</span></p>`
        + `<div class="mt-3">` + switchList(switchRow({
          k: 'ai.commentGuard', label: t.aiTaskComments, note: t.aiTaskCommentsDesc,
          on: s.ai.commentGuard, disabled: !i.aiConfigured,
        })) + `</div>`,
    }) + `</div>`
  return connectionCard({
    title: t.cardAi,
    keys: ['ai'],
    // ⚠️ BOTH HALVES, and the card said so for three days before either happened. The
    // credentials go to their own endpoint and `ai.commentGuard` goes to the settings record;
    // `settings-cards.ts` sends the route first, then the keys.
    route: '/api/integrations/ai',
    state: off ? 'off' : i.aiConfigured ? 'good' : 'attention',
    lampTitle: off ? t.connectionOff : i.aiConfigured ? t.connectionOk : t.connectionUntested,
    saveLabel: off ? t.save : t.saveAndTest,
    body: `<div class="${SETTING_GAP}">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.aiHelp)}</p>`
      + settingRow({
        label: t.aiProviderLabel, inline: true,
        control: pickControl({
          value: i.aiProvider, width: 'medium', label: t.aiProviderLabel, attrs: 'data-ai-provider data-card-field="aiProvider"',
          // Derived from the one table the routes check against, so the menu cannot offer a
          // provider the server would refuse, or miss one it would take.
          options: [['', t.aiProviderOff], ...AI_PROVIDERS.map((id) =>
            [id, AI_PROVIDER_NAMES[id] ?? id] as [string, string])],
        }),
      })
      // Everything below the provider is a question about a provider, so it is in the DOM
      // whether or not one is picked and hidden while none is. `data-ai-when-on` and not
      // `data-gate-when`: that hook reads a settings key, and the provider is not one.
      + `<div class="${SETTING_GAP}" data-ai-when-on${off ? ' hidden' : ''}>`
      + settingRow({
        label: t.aiKeyLabel,
        noteHtml: `<span data-ai-key-stored${i.aiConfigured ? '' : ' hidden'}>`
          + `${escapeHtml(t.aiKeyStored)}</span>`,
        control: textControl({
          // The placeholder says whether one is STORED, the way every other credential field on
          // this tab does (`useSecretKeys`' `phSet`). React left that to the note beside it, and
          // the note is an explanation — hidden with the rest of them — so the one sentence
          // telling the owner that leaving this blank keeps their key could be off the screen.
          value: '', label: t.aiKeyLabel, type: 'password',
          placeholder: i.aiConfigured ? t.commentsKeySet : t.aiKeyPh,
          attrs: 'data-ai-key data-card-field="aiApiKey" autocomplete="off"',
        }),
      })
      + settingRow({ label: t.aiModelLabel, inline: true, control: model })
      + check
      + `</div>`
      + jobs
      + `</div>`,
  })
}

/**
 * The snapshot that leaves the machine (ADR 0035): a copy beside the data does not survive the
 * disk. Any S3-compatible bucket — R2, S3, MinIO — takes every archive the schedule writes and
 * is pruned to the same retention.
 *
 * ⚠️ SAVE, THEN REACH THE BUCKET — one press, in that order, which is why this card's key says
 * "Save and test". They were two buttons and the second was disabled until the first had run,
 * an arrangement that teaches nothing: what an owner wants to know is whether the keys they
 * just typed work, and that question needs both halves. The test PUTs and deletes one marker
 * object, so a wrong paste is found while they are still here rather than on the day the
 * machine is gone.
 *
 * The bucket's NAME is shown as the field's ghost text, because it is not a secret and it is
 * the one of these six an owner is likely to be checking rather than setting.
 */
export function offsiteCard(t: AdminStrings, i: IntegrationStatus): string {
  const on = i.offsiteConfigured
  return connectionCard({
    title: t.offsiteTitle,
    keys: [],
    route: '/api/integrations/s3',
    // ⚠️ AND IT TRIES THE BUCKET, which is what `saveAndTest` on the key below has been
    // promising. `POST /api/backup/offsite-test` writes a marker object and removes it — the
    // only way to learn that a pasted endpoint, region and secret agree with each other while
    // the owner is still here to fix them. The route existed and nothing called it, so the card
    // said "Save and test", saved nothing, tested nothing and went green.
    //
    // `data-card-test-when` on the bucket: with no bucket there is nothing to write into, and a
    // test that cannot run must not report a failure.
    //
    // ⚠️ AND THE GATE HAS TO KNOW ABOUT A BUCKET IT CANNOT SEE. A stored credential ships as an
    // empty box (blank means keep), so on an install that already HAS a bucket the gate field
    // was empty and the test was skipped — the card saved, tested nothing, and reported that
    // the far end had answered. `data-card-test-stored` says what only the server knows.
    attrs: 'data-card-tests data-card-test="/api/backup/offsite-test"'
      + ' data-card-test-when="s3Bucket"'
      + (on ? ' data-card-test-stored' : ''),
    // ⚠️ AMBER, NOT GREY, WHEN THERE ARE NO CREDENTIALS. Grey is `connectionOff` and it means
    // somebody switched this off on purpose; this card has no switch, so the only thing "off"
    // could mean here is "never set up", and that is a thing to DO rather than a settled state.
    // React's `ConnectionCard` defaulted `enabled` to true for exactly this reason, so an
    // unconfigured connection read amber with "Saved, but not tried yet". Measured against it
    // 2026-09-15: this lamp was the wrong colour on both of these cards.
    state: on ? 'good' : 'attention',
    lampTitle: on ? t.connectionOk : t.connectionUntested,
    saveLabel: t.saveAndTest,
    body: `<div class="space-y-3">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.offsiteHelp)}</p>`
      + secret(t, { label: t.s3Endpoint, name: 's3Endpoint' })
      + pairGrid(
        secret(t, { label: t.s3Bucket, name: 's3Bucket', shown: i.s3Bucket })
        + secret(t, { label: t.s3Region, name: 's3Region' }),
      )
      + secret(t, { label: t.s3Prefix, name: 's3Prefix' })
      + secret(t, { label: t.s3KeyId, name: 's3AccessKeyId', stored: on })
      + secret(t, { label: t.s3Secret, name: 's3SecretAccessKey',
        stored: on, password: true })
      + `</div>`,
  })
}
