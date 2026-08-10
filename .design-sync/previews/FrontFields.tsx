import { FrontFields } from 'quireink'
import { SETTINGS, POST_REFS, CATEGORIES } from './_fixtures'

// `front` is the shape at SETTINGS.home.front — the lead/featured/strips layout of the
// front page, per ADR 0014.
export function Basic() {
  return (
    <FrontFields
      front={SETTINGS.home.front}
      onChange={() => {}}
      posts={POST_REFS}
      categories={CATEGORIES}
    />
  )
}

// The text kind drops the picture and prints more words instead.
export function TextKind() {
  return (
    <FrontFields
      front={{ ...SETTINGS.home.front, kind: 'text' }}
      onChange={() => {}}
      posts={POST_REFS}
      categories={CATEGORIES}
    />
  )
}
