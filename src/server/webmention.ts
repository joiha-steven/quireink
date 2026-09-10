// Webmention (W3C), both ways (ADR 0046).
//
// OUT: when a clip is published, its source is told — `source` is the note's own address,
// `target` the page the passage came from. The endpoint is discovered the way the spec
// says: a `Link` header, then a `<link>` or `<a>` with `rel="webmention"`, resolved against
// the page. Fire-and-forget from the write paths: a save never waits on somebody else's
// server, and a failure is a log line, not an error the owner sees.
//
// IN: `POST /webmention` takes a source and a target, answers 202 at once, and verifies in
// the background — the source is fetched through the SSRF guard and must actually link to
// the target. What is kept is small: the two URLs, when, and — when the source is a Quire
// Ink clip — the passage it kept, so the owner can ask which sentence readers keep most.
// Nothing is shown on the public page; a mention is the owner's to read.

import { safeFetch } from '@/server/safe-fetch'
import { all, one, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'
import type { Note } from '@/types'

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const isHttp = (v: string) => /^https?:\/\/\S+$/i.test(v)

/** The `rel="webmention"` endpoint a page advertises, or null. Header first, then markup. */
export function discoverEndpoint(html: string, linkHeader: string | null, base: string): string | null {
  const resolve = (href: string): string | null => {
    try { return new URL(href, base).toString() } catch { return null }
  }
  if (linkHeader) {
    for (const part of linkHeader.split(',')) {
      const m = /<([^>]+)>\s*;([^,]*)/.exec(part)
      if (m && /rel\s*=\s*"?[^",;]*\bwebmention\b/i.test(m[2]!)) return resolve(m[1]!.trim())
    }
  }
  const tags = html.match(/<(?:link|a)\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const rel = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
    const relValue = rel ? (rel[1] ?? rel[2] ?? rel[3] ?? '') : ''
    if (!/\bwebmention\b/i.test(relValue)) continue
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
    const hrefValue = href ? (href[1] ?? href[2] ?? href[3] ?? '') : ''
    if (hrefValue) return resolve(hrefValue)
  }
  return null
}

export async function sendWebmention(
  source: string, target: string, fetcher: Fetcher = safeFetch,
): Promise<'sent' | 'no-endpoint' | 'failed'> {
  try {
    const page = await fetcher(target, { headers: { accept: 'text/html' } })
    const html = page.ok ? (await page.text()).slice(0, 512_000) : ''
    const endpoint = discoverEndpoint(html, page.headers.get('link'), target)
    if (!endpoint) return 'no-endpoint'
    const res = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ source, target }).toString(),
    })
    return res.ok || res.status === 202 ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

/** After a note is saved: a published clip tells its source. Never awaited by a save. */
export function afterNoteSaved(meta: Note, site: string): void {
  if (!meta.sourceUrl || meta.status !== 'published' || !site) return
  void sendWebmention(`${site}/notes/${meta.slug}`, meta.sourceUrl).then((r) => {
    if (r === 'failed') console.error(`[ERROR] webmention: could not reach ${meta.sourceUrl}`)
  })
}

// ----- receiving ---------------------------------------------------------------------

export type Mention = {
  id: number
  source: string
  target: string
  quote: string
  status: 'pending' | 'verified' | 'failed'
  receivedAt: string
  verifiedAt?: string
}

type Row = { id: number; source: string; target: string; quote: string | null; status: Mention['status']; received_at: number; verified_at: number | null }

const rowToMention = (r: Row): Mention => ({
  id: r.id, source: r.source, target: r.target, quote: r.quote ?? '', status: r.status,
  receivedAt: toIso(r.received_at), verifiedAt: r.verified_at ? toIso(r.verified_at) : undefined,
})

/**
 * Take a mention in. Returns the row id to verify, or a reason it was refused. The target
 * must be on THIS site: a mention of some other site is not ours to hold.
 */
export function receiveWebmention(source: string, target: string, site: string): number | 'invalid' {
  if (!isHttp(source) || !isHttp(target) || source === target) return 'invalid'
  if (!site || !(target === site || target.startsWith(`${site}/`))) return 'invalid'
  const now = nowMs()
  run(
    `insert into webmentions (source, target, status, received_at) values (?, ?, 'pending', ?)
     on conflict(source) do update set target = excluded.target, status = 'pending', received_at = excluded.received_at, verified_at = null`,
    source, target, now,
  )
  return one<{ id: number }>(`select id from webmentions where source = ?`, source)!.id
}

/** The passage a Quire Ink clip kept, read off its page; '' for any other source. */
export function keptPassage(html: string): string {
  const m = /<blockquote class="note-quote[^"]*">\s*<p>([\s\S]*?)<\/p>/i.exec(html)
  if (!m) return ''
  // Entities first, `&amp;` last of all, so `&amp;lt;` comes out as the text `&lt;` and not as
  // a `<`. Then every tag, to a fixed point: the passage was escaped text on its page, so a
  // `<` that survives decoding is markup somebody wrote into the quote, not prose to keep.
  const text = m[1]!.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  return stripTags(text).replace(/\s+/g, ' ').trim().slice(0, 4000)
}

const stripTags = (s: string): string => {
  let prev: string
  do { prev = s; s = s.replace(/<[^>]*>/g, '') } while (s !== prev)
  return s
}

/** Fetch the source and confirm it links to the target; record what was found. */
export async function verifyMention(id: number, fetcher: Fetcher = safeFetch): Promise<Mention | null> {
  const row = one<Row>(`select * from webmentions where id = ?`, id)
  if (!row) return null
  let status: Mention['status'] = 'failed'
  let quote = ''
  try {
    const res = await fetcher(row.source, { headers: { accept: 'text/html' } })
    if (res.ok) {
      const html = (await res.text()).slice(0, 512_000)
      if (html.includes(row.target)) {
        status = 'verified'
        quote = keptPassage(html)
      }
    }
  } catch {
    status = 'failed'
  }
  run(`update webmentions set status = ?, quote = ?, verified_at = ? where id = ?`,
    status, quote || null, status === 'verified' ? nowMs() : null, id)
  return rowToMention(one<Row>(`select * from webmentions where id = ?`, id)!)
}

export function listMentions(limit = 200): Mention[] {
  return all<Row>(`select * from webmentions order by received_at desc limit ?`, limit).map(rowToMention)
}

/** Which passages on which pages readers keep most: verified mentions with a quote, counted. */
export function mostKept(limit = 20): { target: string; quote: string; count: number }[] {
  return all<{ target: string; quote: string; count: number }>(
    `select target, quote, count(*) as count from webmentions
      where status = 'verified' and quote is not null and quote != ''
      group by target, quote order by count desc, max(received_at) desc limit ?`, limit,
  )
}
