// THE TABLE BEHIND A LINK CARD: what this blog knows about a URL, and how it came to know it.
//
// ADR 0058. Three jobs, and they are deliberately three:
//
//   NOTING. A body that renders with a standalone link nobody has looked up writes the URL down
//   and returns. No network, no wait — which is why saving a post never hangs on somebody
//   else's server and why a test that saves a hundred posts touches nothing outside this box.
//
//   FETCHING. The minute tick takes the noted rows and reads each page once, exactly as media
//   variants are finalised off the upload path (`server/tick.ts`). A card therefore appears
//   within a minute of the writing, not during the save.
//
//   ANSWERING. The renderer asks for what is known and gets a map. A URL that is not in it —
//   never fetched, fetched and refused, or the whole feature switched off — renders as the
//   plain link it already was, which is ONE fallback rather than three.

import type { SiteSettings } from '@/types'
import { isRemote, ownPath, type BookmarkFacts, type CardFacts, type FileFacts } from '@/render/link-cards'
import { fileKind, getFiles } from '@/media/files'
import { all, run } from '@/store/query'
import { nowMs } from '@/store/db'

type CardRow = {
  url: string
  title: string
  description: string
  site: string
  image: string
  fetched_at: number | null
  ok: number
}

/**
 * Write down URLs worth looking up. Cheap, idempotent, and it never overwrites a fetched row.
 *
 * `insert or ignore` is the whole of the concurrency story: two posts rendering at once, both
 * mentioning one URL, race to the same primary key and the loser does nothing.
 */
export function noteLinks(urls: readonly string[], site: string): void {
  for (const url of urls) {
    // ⚠️ NOT THIS BLOG'S OWN ADDRESSES. A full-URL link to one's own post is remote by the
    // scheme test and is not remote in any sense that matters: looking it up means this server
    // fetching its own page over the network to find out what it already holds.
    if (!isRemote(url) || url.length > 2000 || ownPath(url, site)) continue
    // `fetched_at` stays NULL — that IS the pending flag, and the partial index over it is what
    // makes the tick's "anything to do?" free on a blog with nothing waiting.
    run(`insert or ignore into link_cards (url, fetched_at, ok) values (?, null, 0)`, url)
  }
}

/** Rows the tick has not reached yet, oldest first by insertion order. */
export const pendingLinks = (limit: number): string[] =>
  all<{ url: string }>(
    `select url from link_cards where fetched_at is null order by rowid limit ?`, limit,
  ).map((r) => r.url)

/** Record what a fetch found — or that it found nothing, which is a fact worth keeping. */
export function storeCard(url: string, facts: BookmarkFacts | null): void {
  run(
    `update link_cards set title = ?, description = ?, site = ?, image = ?, fetched_at = ?, ok = ?
     where url = ?`,
    facts?.title ?? '', facts?.description ?? '', facts?.site ?? '', facts?.image ?? '',
    nowMs(), facts ? 1 : 0, url,
  )
}

/**
 * Everything worth drawing a card from, for both kinds.
 *
 * ⚠️ EACH HALF IS EMPTY WHEN ITS SWITCH IS OFF, and that is the only place the settings are
 * read. The renderer never sees a setting: it draws what it is handed, so "off" and "nothing
 * known about this URL" are one code path in it and there is no second way for a card to fail
 * to appear.
 */
export async function cardFacts(settings: SiteSettings): Promise<CardFacts> {
  const bookmarks = new Map<string, BookmarkFacts>()
  const files = new Map<string, FileFacts>()
  if (settings.features.bookmarkCards) {
    for (const row of all<CardRow>(`select * from link_cards where ok = 1`)) {
      bookmarks.set(row.url, {
        title: row.title, description: row.description, site: row.site, image: row.image,
      })
    }
  }
  if (settings.features.fileCards) {
    // The whole list, once. `media/files.ts` reads it whole for the Library too — attachments
    // are the small half of it — and a query per card in a render pass is the shape this
    // avoids. The page cache means a body renders once per write, not once per reader.
    // ⚠️ KEYED BY THE UPLOAD'S OWN PATH, which is what makes the lookup the whole test. There
    // is no "is this under /uploads/files/" check anywhere: a path that is one of these is in
    // the map and a path that is not simply misses, so a link to another POST and a link to a
    // picture both stay links without a second rule saying which paths qualify.
    for (const item of await getFiles()) {
      files.set(item.url, { name: item.filename, size: item.size, kind: fileKind(item) })
    }
  }
  return { bookmarks, files, site: settings.siteUrl }
}
