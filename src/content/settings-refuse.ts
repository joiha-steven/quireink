// THE SETTINGS A SAVE REFUSES, rather than quietly rewrites.
//
// The merge in `settings-save.ts` is forgiving on purpose: a value that does not read falls back,
// so one mistyped key cannot break the blog. For three free-text fields that forgiveness was a
// silent loss. `sanitizeUrl("not a url")` is `''`, so typing a broken Site address WIPED the one
// already stored, and the screen still said "Settings saved"; the Log said "nothing changed" when
// the address had been empty before, which is the case that was reported. The author link did the
// same through `link()`, and a repository name that does not read kept the old one with the same
// success toast.
//
// Refusing is the honest answer for these, because each has exactly one meaning and a fallback
// either erases what was there or keeps what the owner just tried to replace. The route answers
// 400 and names the key, and the screen puts the sentence under that field. Pure, so the rule is
// tested without a request; `web/admin/site.ts` is the one caller.
import type { SiteSettings } from '@/types'
import { sanitizeUrl } from '@/content/settings-scrub'
import { readRepo } from '@/admin-shared/source-repo'

/** Which field, and which of the screen's sentences says why. Both are closed sets. */
export type Refusal = { k: 'siteUrl' | 'author.url' | 'sourceRepo'; why: 'url' | 'invalid' }

/**
 * An http(s) address, or nothing at all. Empty is a real answer — "no address", "no link" — and
 * stays allowed; only a non-empty string that is not a web address is refused. `sanitizeUrl` is
 * the test because it is the same reading the save stores through: a string it turns into `''`
 * is exactly a string the save would have thrown away.
 */
const notAddress = (v: unknown): boolean =>
  v !== undefined && (typeof v !== 'string' || (v.trim() !== '' && sanitizeUrl(v) === ''))

export function refusedSetting(input: Partial<SiteSettings>): Refusal | null {
  if (notAddress(input.siteUrl)) return { k: 'siteUrl', why: 'url' }
  const author = input.author as unknown
  if (author !== null && typeof author === 'object' && notAddress((author as { url?: unknown }).url)) {
    return { k: 'author.url', why: 'url' }
  }
  const repo = input.sourceRepo as unknown
  if (repo !== undefined && (typeof repo !== 'string' || (repo.trim() !== '' && readRepo(repo) === null))) {
    return { k: 'sourceRepo', why: 'invalid' }
  }
  return null
}

/**
 * The refusal in words, for a caller with no screen to point at: the MCP tool. English, like
 * every other answer that door gives, because its reader is an agent and not the owner.
 */
export const refusalText = (r: Refusal): string => r.why === 'url'
  ? `${r.k} must be a full http:// or https:// address, or empty. Nothing was saved.`
  : `${r.k} must be a GitHub repository as owner/name, or empty. Nothing was saved.`
