// The two services the comment box talks to: Cloudflare Turnstile and Google sign-in.
//
// Toggle AND keys together, in Settings -> Connections. They used to be split — the
// switches under Reading, the credentials in a panel below them — which is how
// `googleAuth` ended up switched on for weeks with no keys behind it and nothing to say so.
//
// The keys are SECRETS, so they have their own API (`/api/comments/keys` → the server-only
// `integration_keys` table), NOT the settings form. Inputs are write-to-set: a blank field
// leaves the stored key untouched, because only non-empty fields are sent.
import type { CommentSettings } from '@/types'
import type { CommentEnv } from '@/comments/comment-env'
import { Button } from '@/admin/ui/Button'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { CONTROL, INSET, NOTE, NOTE_TEXT, PANEL_LIST } from './kit'
import { useSecretKeys } from './useSecretKeys'

const INPUT = `${CONTROL} w-full`

// External setup links (where the owner gets each integration's keys / settings).
const LINKS = {
  turnstile: 'https://dash.cloudflare.com/?to=/:account/turnstile',
  google: 'https://console.cloud.google.com/apis/credentials',
}

type Keys = {
  turnstileSiteKey: string
  turnstileSecretKey: string
  googleClientId: string
  googleClientSecret: string
}
const EMPTY: Keys = {
  turnstileSiteKey: '', turnstileSecretKey: '', googleClientId: '', googleClientSecret: '',
}

// One integration's title + help line with an "Open ↗" link to its setup page.
function Help({ title, text, href, open }: { title: string; text: string; href: string; open: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className={NOTE}>
        {text}{' '}
        <a href={href} target="_blank" rel="noopener" className="font-medium underline hover:text-neutral-900 dark:hover:text-white">
          {open}
        </a>
      </p>
    </div>
  )
}

export function CommentIntegrations(
  { comments, env, onChange }:
  { comments: CommentSettings; env: CommentEnv; onChange: (c: CommentSettings) => void },
) {
  const t = useAdminT()
  const { keys, busy, set, ph, save } = useSecretKeys('/api/comments/keys', EMPTY)
  // Shown whatever the master switch says. This tab is where the site's credentials live,
  // and hiding them behind a toggle two tabs away is how they get lost.
  const showTurnstile = comments.turnstile
  const showGoogle = comments.googleAuth
  // A toggle that is on with no key behind it does nothing, and says so here.
  const needsKey = (on: boolean, configured: boolean) => (on && !configured ? t.commentsNeedsKey : undefined)

  return (
    <div className="space-y-4">
      {/* Which gate is actually standing, said plainly. The owner's rule, 2026-08-27:
          whoever enters a Turnstile key gets Turnstile, everybody else gets the blog's own
          gate — and this line is where they find out which one that is. */}
      <p className={NOTE}>
        {comments.turnstile && env.turnstileConfigured ? t.commentsGateTurnstile : t.commentsGateStamp}
      </p>
      <div className={PANEL_LIST}>
        <ToggleRow
          label={t.commentsTurnstile}
          desc={t.commentsTurnstileDesc}
          badge={needsKey(comments.turnstile, env.turnstileConfigured)}
          checked={comments.turnstile}
          onChange={(turnstile) => onChange({ ...comments, turnstile })}
        />
        <ToggleRow
          label={t.commentsGoogleAuth}
          desc={t.commentsAuthDesc}
          badge={needsKey(comments.googleAuth, env.googleConfigured)}
          checked={comments.googleAuth}
          onChange={(googleAuth) => onChange({ ...comments, googleAuth })}
        />
      </div>
      {(showTurnstile || showGoogle) && (
      <div className={`space-y-3 ${INSET}`}>
      {showTurnstile && (
        <div className="space-y-2">
          <Help title={t.commentsTurnstile} text={t.commentsTurnstileHelp} href={LINKS.turnstile} open={t.commentsHelpOpen} />
          <input className={INPUT} placeholder={ph(!!env.turnstileSiteKey, t.commentsKeySite)} value={keys.turnstileSiteKey} onChange={(e) => set('turnstileSiteKey', e.target.value)} />
          <input className={INPUT} type="password" placeholder={ph(env.turnstileConfigured, t.commentsKeySecret)} value={keys.turnstileSecretKey} onChange={(e) => set('turnstileSecretKey', e.target.value)} />
        </div>
      )}
      {showGoogle && (
        <div className="space-y-2">
          <Help title={t.commentsGoogleAuth} text={t.commentsGoogleHelp} href={LINKS.google} open={t.commentsHelpOpen} />
          {/* The exact string Google demands, built from the browser's own origin rather
              than from a setting: a typo here fails the flow AFTER the reader has left,
              with an error page on Google's side that names no cause. */}
          <p className={NOTE_TEXT}>
            {t.commentsGoogleRedirect}
            <code className="ml-2 select-all rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              {`${location.origin}/comment-auth/google/callback`}
            </code>
          </p>
          <input className={INPUT} placeholder={ph(env.googleConfigured, t.commentsKeyGoogleId)} value={keys.googleClientId} onChange={(e) => set('googleClientId', e.target.value)} />
          <input className={INPUT} type="password" placeholder={ph(env.googleConfigured, t.commentsKeyGoogleSecret)} value={keys.googleClientSecret} onChange={(e) => set('googleClientSecret', e.target.value)} />
        </div>
      )}
      <Button type="button" onClick={save} disabled={busy}>
        {t.commentsKeySave}
      </Button>
      </div>
      )}
    </div>
  )
}