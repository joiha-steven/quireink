// Slug uniqueness across the shared public URL namespace.
// Posts and pages both live at /{slug}, so a slug may belong to at most one of
// them. Queries the tables directly (not via content/posts|pages) to avoid a
// circular import.
import { one } from '@/store/query'
import { getSettings } from '@/content/settings'

/**
 * Slugs the router answers before `/{slug}` ever runs, so a post or page saved at one of
 * them is stored, listed, put in the sitemap, and unreachable forever with nothing saying
 * why. "Search" and "Login" are ordinary page titles, and `slugify` turns both into exactly
 * these strings.
 *
 * MEASURED, not guessed, and `slugs.test.ts` keeps it measured: a fixed route only shadows
 * a slug when it is one bare segment (`/search`) or a segment with a wildcard under it
 * (`/uploads/*`, which Hono matches with the wildcard empty). A parameter does not, so
 * `/assets/:file` leaves `assets` free and `/api/track` leaves `api` free. That is why this
 * list is six names and not the twenty a reading of `app.ts` would suggest.
 *
 * `archive` is deliberately NOT here. `/archive` asks for the owner's own document first
 * and only draws the year index when there is none, which is the opposite trade and is set
 * out where that route is registered.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'login', 'notes', 'og', 'search', 'setup', 'uploads',
])

// Thrown by save* when a slug is already taken by a different post/page.
// Route handlers map this to a 409 with the `slug_taken` error code.
export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`slug_taken: ${slug}`)
    this.name = 'SlugConflictError'
  }
}

// Throw SlugConflictError if `slug` is used by any post/page other than the item
// being saved (identified by `selfKind` + `selfSlug`).
//
// The check deliberately ignores `deleted_at`: a trashed row keeps its slug reserved so
// that restoring it always works. That was true of the frozen tree too, because this
// never went through `liveOnly`.
export async function ensureSlugFree(
  slug: string,
  selfKind: 'post' | 'page',
  selfSlug?: string,
): Promise<void> {
  // The post list is a THIRD occupant of this namespace once it leaves `/` (ADR 0014), and
  // it has no row to be found by the two queries below. Without this, saving a post at the
  // list's path succeeds and one of the two silently stops being reachable — the router
  // answers the list first, so it is the post that vanishes, with no error anywhere.
  if (RESERVED_SLUGS.has(slug)) throw new SlugConflictError(slug)
  const { home } = await getSettings()
  if (home.mode !== 'list' && slug === home.listPath.slice(1)) throw new SlugConflictError(slug)
  const post = one<{ slug: string }>(`select slug from posts where slug = ?`, slug)
  const page = one<{ slug: string }>(`select slug from pages where slug = ?`, slug)
  const postHit = !!post && !(selfKind === 'post' && post.slug === selfSlug)
  const pageHit = !!page && !(selfKind === 'page' && page.slug === selfSlug)
  if (postHit || pageHit) throw new SlugConflictError(slug)
}

/**
 * The mirror question: does any post or page already hold `slug`? Asked when the LIST is
 * being pointed at a path (Settings → home.listPath) — the other half of the guard above,
 * which cannot run there because there is no row being saved.
 *
 * Lives HERE and not in the route, because docs/invariants.md names this file as the ONE
 * place Invariant 2 is enforced — and until 2026-08-29 the settings route carried its own
 * two raw queries, a second answer to a question that must have one. Same deliberate
 * ignore of `deleted_at` as `ensureSlugFree`: a trashed row keeps its slug reserved.
 */
export function slugTaken(slug: string): boolean {
  return !!one<{ slug: string }>(`select slug from posts where slug = ?`, slug)
    || !!one<{ slug: string }>(`select slug from pages where slug = ?`, slug)
}

/**
 * The same question asked of LIVE content only, for the one caller that has to answer it
 * differently: a redirect.
 *
 * A trashed row keeps its slug reserved against a SAVE, because restoring it has to work.
 * A redirect is the opposite case: sending `/old` somewhere else after trashing the post
 * that lived there is an ordinary thing to want, and refusing it because a row sits in the
 * Trash would be refusing the common workflow. What must never happen is a redirect
 * shadowing content a reader can actually reach, and `restorePost`/`restorePage` close the
 * other half by clearing the redirect when the row comes back.
 */
export function liveSlugTaken(slug: string): boolean {
  return !!one<{ slug: string }>(`select slug from posts where slug = ? and deleted_at is null`, slug)
    || !!one<{ slug: string }>(`select slug from pages where slug = ? and deleted_at is null`, slug)
}
