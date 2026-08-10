import { NewsletterSend } from 'quireink'
import { SENDABLE } from './_fixtures'

// One post already sent (it carries stats), one never sent.
export function Basic() {
  return <NewsletterSend posts={SENDABLE} />
}

export function NothingToSend() {
  return <NewsletterSend posts={[]} />
}
