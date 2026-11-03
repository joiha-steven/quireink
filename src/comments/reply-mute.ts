// "Stop emailing me about replies", for a commenter.
//
// The address on a comment written by hand is whatever was typed in the box, so a reply notice
// could be aimed at anybody, carrying a name and words a stranger chose, and nothing in it said
// how to make it stop (2026-11-03). Every notice now carries a link that does.
//
// THE LINK NAMES A COMMENT, NOT AN ADDRESS: `<parent id>.<signature>`, signed over the id and the
// address that comment carries. No address travels in a URL, a forged or stale link changes
// nothing, and only the person the notice was sent to holds a valid one. What is kept is the
// address keyed under the server's own secret (`reply_mutes.who`), so the list of "no" is not a
// list of addresses. It is asked of every later notice to that address, whichever comment.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverSecret } from '@/auth/secret'
import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'

const norm = (email: string): string => email.trim().toLowerCase()
const mac = (text: string): string =>
  createHmac('sha256', serverSecret('reply-mute')).update(text).digest('base64url')

/** The stored form of an address: keyed, so the table never holds the address itself. */
const who = (email: string): string => mac(`who|${norm(email)}`)
const signature = (commentId: number, email: string): string => mac(`link|${commentId}|${norm(email)}`)

/** The opt-out link for a notice about a reply to comment `commentId`, sent to `email`. */
export function muteLink(base: string, commentId: number, email: string): string {
  return `${base}/api/comments/mute?t=${encodeURIComponent(`${commentId}.${signature(commentId, email)}`)}`
}

/** Has this address asked not to be told about replies? */
export function isMuted(email: string): boolean {
  return one<{ who: string }>(`select who from reply_mutes where who = ?`, who(email)) !== null
}

/** Act on a link. True when it was genuine (and the address is now muted, or already was). */
export function muteFromToken(token: string): boolean {
  const [idText, sig] = token.split('.')
  const id = Number(idText)
  if (!Number.isSafeInteger(id) || id <= 0 || !sig) return false
  const row = one<{ author_email: string | null }>(`select author_email from comments where id = ?`, id)
  const email = row?.author_email?.trim()
  if (!email) return false
  const want = Buffer.from(signature(id, email))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false
  run(`insert or ignore into reply_mutes (who, created_at) values (?, ?)`, who(email), nowMs())
  return true
}
