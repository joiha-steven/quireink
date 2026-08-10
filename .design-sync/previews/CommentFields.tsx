import { CommentFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return <CommentFields comments={SETTINGS.comments} onChange={() => {}} />
}

export function Enabled() {
  return <CommentFields comments={{ ...SETTINGS.comments, enabled: true }} onChange={() => {}} />
}
