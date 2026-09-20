// THE DOORS, and what lies behind each one.
//
// Split out of `src/types-settings.ts` on 2026-09-20, when `BackupSettings` grew an envelope and
// put that file over the 400-line ceiling. The seam is not the line count. Everything left
// behind describes something a READER meets on a page — a shape, a colour, a typeface, how the
// front page is laid out. Everything here describes what this install says to, or hands to,
// something that is not a reader: an assistant, a program asking for JSON, a server in the
// fediverse, a bucket in somebody else's data centre.
//
// ADR 0057 drew the same line in prose when the Content API was given its own group rather than
// a slot in `features`: "`features` is what a READER sees on a page and this is a door for a
// program." This file is that sentence, applied to the four doors and the archive.
//
// ⚠️ EVERY ONE OF THESE SHIPS OFF, and each says so where its default is written rather than
// here, because a list of defaults in a types file is a list that goes stale.
//
// Re-exported from `@/types-settings`, and through it from `@/types`, so no import site had to
// change — the same bargain that file made when it left `types.ts`.

// MCP server settings. Just an on/off switch — the access tokens live in their own
// `mcp_tokens` table (hashed), managed from Admin → Settings → Advanced.
/**
 * The automatic jobs, not the credentials: provider/key/model live in `integration_keys`
 * and never reach a client payload. Every switch here defaults ON — the master switch is
 * the key itself, and without one no job runs regardless of what these say.
 */
export type AiSettings = {
  altText: boolean // describe uploaded images in the site's language
  excerpt: boolean // write the excerpt when a post publishes with the field left blank
  commentGuard: boolean // hold spam comments in the Trash for review
}

export type McpSettings = {
  enabled: boolean // when false, /api/mcp + the OAuth flow are disabled
}

/**
 * The read-only Content API (ADR 0057): `/api/v1/*`, JSON, GET only.
 *
 * OFF at install and OFF on every upgrade, and that is the whole of the argument for it. The
 * API serves nothing a reader could not already fetch by browsing — no drafts, no future dates,
 * no trash — so switching it on publishes no new FACT. What it publishes is a SHAPE: the whole
 * blog, paginated, parseable, in as many requests as it has pages. That is the thing an owner
 * should decide rather than have decided for them, and a default of off is the only way the
 * decision reaches them.
 *
 * Beside `mcp` rather than in `features`, because `features` is what a READER sees on a page and
 * this is a door for a program. Same group shape as MCP, same 404 while it is shut.
 */
export type ApiSettings = {
  enabled: boolean
}

/**
 * ActivityPub (ADR 0059): the blog as somebody a Mastodon reader can follow.
 *
 * OFF at install and on every upgrade, like every other machine door here — and this one has a
 * second reason beyond the usual. Switching it on gives this blog an IDENTITY in a network of
 * other people's servers: a name, a keypair, and a list of strangers who asked to hear from it.
 * That is not a display option, and it is not something to acquire by updating.
 *
 * ⚠️ `handle` IS NOT THE LOGIN USERNAME, deliberately. The owner signs in as themselves; the
 * blog is followed as itself, and the two are different names for different audiences. Tying
 * them would also publish the username of the only account on this install to everyone who
 * looks up the actor — an invitation to guess the other half.
 *
 * ⚠️ AND IT CANNOT CHANGE WITHOUT LOSING EVERY FOLLOWER. The handle and the site address
 * together ARE the actor's id, which every server that follows this blog has cached. Change
 * either and the old actor simply stops existing for them; nothing anywhere tells them where it
 * went. The settings card says so before the switch, not after.
 */
export type ActivityPubSettings = {
  enabled: boolean
  /** The `@name` in `@name@host`. Lower-case letters, digits and underscore. */
  handle: string
}

/**
 * The snapshot schedule, and the envelope it travels in. Non-secret, in `settings.data`.
 *
 * ⚠️ NOTHING HERE IS A SECRET, INCLUDING THE TWO KEYS, and that is the feature rather than an
 * oversight. Both are X25519 PUBLIC halves: the server can seal an archive to them and cannot
 * open one, so a box somebody else is now root on does not hand over its own backups. The
 * private halves are an identity shown once and never stored, and a passphrase that is typed
 * once and never stored. ADR 0060.
 */
export type BackupSettings = {
  enabled: boolean // when true, the cron runs a full snapshot every intervalDays
  intervalDays: number // days between automatic full snapshots (default 4)
  keep: number // how many most-recent snapshots to retain (default 4)
  /** Seal every archive this blog writes. Off at install and off on upgrade. */
  encrypt: boolean
  /** The owner's identity, public half. `quire-backup-pub-1…`, empty until they make one. */
  pubKey: string
  /** The passphrase recipient's public half, derived at setup and kept instead of the words. */
  passPub: string
  /** scrypt's salt for that derivation, base64. Not a secret: every archive header carries it. */
  passSalt: string
}
