// What a post, page or note body must look like before a saver sees it (2026-09-30).
//
// The routes cast the JSON straight to the piece's type, so `{"title":123}`, `{"slug":{}}`, a
// `tags` that is a string, a date that is not one, or a body of `null` reached the savers and
// came back as 500 (`input.slug?.trim is not a function`). CLAUDE.md asks every handler for a
// typed error; this is where the shape is told apart from a fault.
import type { Context } from 'hono'

const TEXT = ['title', 'slug', 'content', 'excerpt', 'status', 'date', 'series', 'metaTitle',
  'metaDescription', 'coverImage', 'featuredImage', 'lang', 'translationGroup', 'sourceUrl',
  'sourceTitle', 'quote'] as const
const LISTS = ['categories', 'tags'] as const

/** Why this body cannot be a piece, or null when it can. */
export function pieceInputProblem(input: unknown): string | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return 'body must be a JSON object'
  const o = input as Record<string, unknown>
  for (const k of TEXT) {
    if (o[k] != null && typeof o[k] !== 'string') return `${k} must be a string`
  }
  for (const k of LISTS) {
    const v = o[k]
    if (v != null && !(Array.isArray(v) && v.every((x) => typeof x === 'string'))) return `${k} must be a list of strings`
  }
  if (o.seriesOrder != null && typeof o.seriesOrder !== 'number') return 'seriesOrder must be a number'
  if (typeof o.date === 'string' && o.date.trim() !== '' && Number.isNaN(Date.parse(o.date))) return 'date is not a date'
  return null
}

/**
 * The JSON body, or a reason it is not one. A malformed body used to be read as `{}`, which a
 * settings save took for "change nothing", answered 200 and logged as a change.
 */
export async function readJson(c: Context): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await c.req.json() }
  } catch {
    return { ok: false }
  }
}

/** A piece body, typed, or the reason it cannot be one (for a 400). */
export async function readPiece<T>(c: Context): Promise<Partial<T> | string> {
  const body = await readJson(c)
  if (!body.ok) return 'body is not JSON'
  return pieceInputProblem(body.value) ?? (body.value as Partial<T>)
}
