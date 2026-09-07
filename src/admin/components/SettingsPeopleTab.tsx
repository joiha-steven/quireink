// Settings → Comments & mail: how readers answer back, and how mail leaves this machine.
//
// ADR 0041, and this tab is the clearest case the ADR makes. "How do readers sign in to
// comment?" used to be answered in two places three tabs apart: the switch that enables
// comments was on Reading, and the Google and Turnstile keys that decide how a commenter
// proves they are a person were on Connections. That is how `googleAuth` ran switched on for
// weeks with no credentials behind it and nothing on either screen saying so.
//
// EVERY CARD SAVES ITSELF, and since 2026-09-07 the sheet's Save renders here too (ADR 0041,
// revised). Both cards reach something — a provider, a mail host — so both say "Save and test"
// and try it, which is the part no page-level key can do.
import type { SiteSettings } from '@/types'
import type { CommentEnv } from '@/comments/comment-env'
import { useAdminT } from './I18nProvider'
import { CommentIntegrations } from './CommentIntegrations'
import { NewsletterCard } from './NewsletterFields'
import { ConnectionCard } from './ConnectionCard'
import { CommentFields } from './CommentFields'
import type { SettingsSave } from './useSettingsSave'

export function SettingsPeopleTab({ s, update, commentEnv, form, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  commentEnv: CommentEnv
  form: SettingsSave
  grid: string
  col: string
}) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        {/* The switch itself, which also appears at the foot of the Posts tab — one key,
            two places, because "should there be comments" is both the last thing on a post
            and the first thing on this tab. Whichever is changed, the other reads it. */}
        <ConnectionCard
          title={t.cardComments}
          enabled={s.comments.enabled}
          connected={s.comments.enabled}
          dirty={form.changedIn('comments')}
          onSave={() => form.savePartial({ comments: s.comments })}
        >
          <CommentFields comments={s.comments} onChange={(comments) => update({ comments })} />
        </ConnectionCard>
        <CommentIntegrations
          comments={s.comments}
          env={commentEnv}
          onChange={(comments) => update({ comments })}
          savePartial={form.savePartial}
          dirty={form.changedIn('comments')}
        />
      </div>
      <div className={col}>
        <NewsletterCard />
      </div>
    </div>
  )
}
