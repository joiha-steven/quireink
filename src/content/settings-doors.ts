// WHAT ONE DOOR MAY BE SET TO: the sanitisers for the groups that face outwards.
//
// Split out of `settings-sanitize.ts` on 2026-09-20, when the backup envelope put that file over
// its 400-line ceiling for the second time. The seam is the SAME ONE `types-doors.ts` takes, and
// drawn twice on purpose: a line you have to learn once is cheaper than two lines that nearly
// agree. Everything left in `settings-sanitize.ts` shapes something a reader meets on a page;
// everything here shapes what this install says to, or hands to, something that is not a reader.
//
// ⚠️ EVERY ONE OF THESE SHIPS OFF, and each refuses to be switched on before the thing behind it
// exists: the fediverse needs a handle, the archive needs a recipient. A door with a green switch
// and nothing behind it is worse than a shut one, because the owner stops checking.
//
// Re-exported from `settings-sanitize.ts`, so no import site had to change.

import type {
  ActivityPubSettings, AiSettings, ApiSettings, BackupSettings, McpSettings,
} from '@/types'
import { bool, clampNumber, isRecipient } from '@/content/settings-scrub'

export function sanitizeMcp(input: unknown, fallback: McpSettings): McpSettings {
  const o = (input ?? {}) as Partial<McpSettings>
  return { enabled: bool(o.enabled, fallback.enabled) }
}

/**
 * The Content API switch (ADR 0057).
 *
 * Its own function rather than a second call to `sanitizeMcp`, which happens to take the same
 * shape today. Two switches that are equal by coincidence are a shared function waiting to be
 * given a second field for one of them — and then the other silently grows it too.
 */
export function sanitizeApi(input: unknown, fallback: ApiSettings): ApiSettings {
  const o = (input ?? {}) as Partial<ApiSettings>
  return { enabled: bool(o.enabled, fallback.enabled) }
}

/**
 * The ActivityPub switch and the handle (ADR 0059).
 *
 * ⚠️ THE HANDLE IS NARROWED HARD, and not out of tidiness. It goes into a WebFinger resource
 * (`acct:name@host`), into an actor id URL, and into `preferredUsername`, and the fediverse's
 * own convention for all three is the same small alphabet. A handle with a dot in it collides
 * with the domain half; one with a slash changes the URL's shape; one with a capital is matched
 * case-sensitively by some servers and not others, so the same blog answers two names.
 *
 * Anything outside the alphabet is DROPPED rather than refusing the whole save: the owner is
 * typing a name, not a regular expression, and a save that silently keeps the old handle would
 * be worse — it is the one field here that cannot be changed later without consequence.
 */
export function sanitizeActivityPub(
  input: unknown, fallback: ActivityPubSettings,
): ActivityPubSettings {
  const o = (input ?? {}) as Partial<ActivityPubSettings>
  const handle = typeof o.handle === 'string'
    ? o.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
    : fallback.handle
  return { enabled: bool(o.enabled, fallback.enabled), handle }
}

export function sanitizeAi(input: unknown, fallback: AiSettings): AiSettings {
  const o = (input ?? {}) as Partial<AiSettings>
  return {
    altText: bool(o.altText, fallback.altText),
    excerpt: bool(o.excerpt, fallback.excerpt),
    commentGuard: bool(o.commentGuard, fallback.commentGuard),
  }
}

/**
 * ⚠️ A RECIPIENT CAN BE REPLACED AND CANNOT BE ERASED, which is not the same rule as the rest
 * of this file. Every other field here takes what it is given; these three keep what they have
 * unless the new value is a real key. An empty string arriving from a half-built payload would
 * otherwise silently un-seal every future archive, and the owner would find out by opening one.
 *
 * The keys themselves are written by `POST /api/backup/keys`, which is the only code that has
 * seen the passphrase and the only moment the identity exists (ADR 0060).
 */
export function sanitizeBackups(input: unknown, fallback: BackupSettings): BackupSettings {
  const o = (input ?? {}) as Partial<BackupSettings>
  const pubKey = isRecipient(o.pubKey) ? o.pubKey : fallback.pubKey
  const passPub = isRecipient(o.passPub) ? o.passPub : fallback.passPub
  return {
    enabled: bool(o.enabled, fallback.enabled),
    intervalDays: clampNumber(o.intervalDays, 1, 30, fallback.intervalDays),
    keep: clampNumber(o.keep, 1, 30, fallback.keep),
    // ⚠️ AGAINST THE KEYS THIS SAVE LEAVES BEHIND, not the ones it arrived with. An owner who
    // flips this switch with no recipient would otherwise get a green control over plaintext
    // archives, which is worse than an off switch because they would stop thinking about it.
    encrypt: bool(o.encrypt, fallback.encrypt) && pubKey !== '' && passPub !== '',
    pubKey,
    passPub,
    passSalt: typeof o.passSalt === 'string' && o.passSalt !== '' ? o.passSalt : fallback.passSalt,
  }
}
