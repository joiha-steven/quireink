// Settings → Connections: the other services this site talks to, and the snippets somebody
// else's service asks you to paste.
//
// Split from `SettingsView.tsx` on 2026-09-06, when moving Custom code into the left column
// put that file three lines over its 400-line ceiling — the rule is split, not squeeze, and
// this tab was the largest block left in it. Same seam as `SettingsAiTab` and
// `SettingsSystemTab`: the state stays in `SettingsView`, this takes fields and hands back
// changes, so there is still ONE form and ONE save button for the settings half.
//
// Every credential here is written to the server and never read back, which is why these
// cards show status rather than values.
import type { SiteSettings } from '@/types'
import type { CommentEnv } from '@/comments/comment-env'
import type { IntegrationStatus } from '@/store/integration-keys'
import { SettingsCard } from './SettingsCard'
import { NOTE_TEXT } from './kit'
import { useAdminT } from './I18nProvider'
import { NewsletterFields } from './NewsletterFields'
import { SnippetEditor } from './SnippetEditor'
import { CloudflareFields } from './CloudflareFields'
import { CommentIntegrations } from './CommentIntegrations'

export function SettingsConnectionsTab(
  { s, update, integrations, commentEnv, grid, col }: {
    s: SiteSettings
    update: (partial: Partial<SiteSettings>) => void
    integrations: IntegrationStatus
    commentEnv: CommentEnv
    grid: string
    col: string
  },
) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        <SettingsCard title={t.cardNewsletter}>
          <NewsletterFields />
        </SettingsCard>
        {/* IN THE LEFT COLUMN, not full width under both, since 2026-09-06. It sat
            across the bottom so the two code fields could have the whole width — but
            SMTP is a short form, so the tab was two short stacks with a band of empty
            paper beside them and the code strip stranded underneath. Measured at
            1440px on the showcase fixture with no service configured: 389 and 427 with
            a 469-tall strip under both; now 877 against 427 and no strip. The fields
            narrow from 1,034px to 477, which still holds a `<script defer src="…">`
            line unwrapped — the length that actually gets pasted here. A site with
            Cloudflare and the comment services filled in has a taller right column
            than this fixture, so re-measure there before moving it back. */}
        <SettingsCard title={t.cardCustomCode}>
          <div className="space-y-4">
            <p className={NOTE_TEXT}>{t.customCodeNote}</p>
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
        </SettingsCard>
      </div>
      <div className={col}>
        {/* The two services that sit in FRONT of the site — the CDN that caches it and
            the checks a commenter passes — against the one that sends from it. This
            column has not moved since 2026-08-19; what stands beside it has, twice, and
            the note above carries the current measurement. */}
        <SettingsCard title={t.cardCloudflare}>
          <CloudflareFields configured={integrations.cloudflareConfigured} zoneId={integrations.cloudflareZoneId} webhookConfigured={integrations.purgeWebhookConfigured} />
        </SettingsCard>
        <SettingsCard title={t.cardCommentIntegrations}>
          <CommentIntegrations
            comments={s.comments}
            env={commentEnv}
            onChange={(comments) => update({ comments })}
          />
        </SettingsCard>
      </div>
    </div>
  )
}
