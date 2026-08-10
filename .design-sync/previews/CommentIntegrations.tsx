import { CommentIntegrations } from 'quireink'
import { SETTINGS, COMMENT_ENV } from './_fixtures'

// `env` is what the SERVER found. It only becomes visible once the matching option is switched
// ON in `comments`: the panel then badges the ones still missing a key, and swaps the input
// placeholders. Both flags are therefore on in these cells, or the two states look identical.
const ON = { ...SETTINGS.comments, enabled: true, turnstile: true, googleAuth: true }

export function KeysPresent() {
  return (
    <CommentIntegrations
      comments={ON}
      env={{ turnstileConfigured: true, googleConfigured: true, turnstileSiteKey: COMMENT_ENV.turnstileSiteKey }}
      onChange={() => {}}
    />
  )
}

export function KeysMissing() {
  return (
    <CommentIntegrations
      comments={ON}
      env={{ turnstileConfigured: false, googleConfigured: false, turnstileSiteKey: '' }}
      onChange={() => {}}
    />
  )
}

export function BothOff() {
  return <CommentIntegrations comments={SETTINGS.comments} env={COMMENT_ENV} onChange={() => {}} />
}
