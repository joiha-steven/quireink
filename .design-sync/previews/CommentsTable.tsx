import { CommentsTable } from 'quireink'
import { COMMENTS } from './_fixtures'

// All three moderation states at once: approved, pending, and one obvious spam row.
export function Basic() {
  return <CommentsTable initial={COMMENTS} />
}

export function Empty() {
  return <CommentsTable initial={[]} />
}
