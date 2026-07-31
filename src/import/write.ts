// The Quire Ink 2.0 side of the importer: turns v1 rows into SQLite rows.
//
// One INSERT literal per table, all of them run inside a single transaction owned by the
// caller, so the instance is either fully imported or the file is untouched.

import type { Database } from 'bun:sqlite'
import { bool, boolOrNull, json, termRows, text, ts, uriList } from '@/import/transform'
/** A v1 row as PostgREST hands it over: plain JSON, no types to trust. */
export type SourceRow = Record<string, unknown>

type Writer = (db: Database, row: SourceRow) => void

const put = (db: Database, sql: string, params: Record<string, unknown>) =>
  db.query(sql).run(params as never)

/**
 * Every table's writer. Ids are preserved rather than reassigned: `comments.parent_id`
 * depends on it, and `newsletter_sends.open_token` links live in already-sent emails.
 */
export const WRITERS: Record<string, Writer> = {
  settings: (db, r) => put(db,
    `insert into settings (id, data) values (1, $data)`,
    { data: json(r.data) }),

  integration_keys: (db, r) => put(db,
    `insert into integration_keys (id, turnstile_site_key, turnstile_secret_key,
       cloudflare_api_token, cloudflare_zone_id, smtp_host, smtp_port, smtp_user,
       smtp_pass, smtp_from, smtp_secure)
     values (1, $tsk, $tss, $cat, $czi, $host, $port, $user, $pass, $from, $secure)`,
    {
      tsk: text(r.turnstile_site_key), tss: text(r.turnstile_secret_key),
      cat: text(r.cloudflare_api_token), czi: text(r.cloudflare_zone_id),
      host: text(r.smtp_host), port: r.smtp_port ?? null, user: text(r.smtp_user),
      pass: text(r.smtp_pass), from: text(r.smtp_from), secure: boolOrNull(r.smtp_secure),
    }),

  // The Drive refresh token is DROPPED (parity exception 1) but the row is kept, so the
  // owner does not lose the record of when backups last ran.
  backup_state: (db, r) => put(db,
    `insert into backup_state (id, refresh_token, folder_id, last_run_at, last_status, last_error, last_size)
     values (1, null, $folder, $runAt, $status, $error, $size)`,
    {
      folder: text(r.folder_id), runAt: ts(r.last_run_at), status: text(r.last_status),
      error: text(r.last_error), size: r.last_size ?? null,
    }),

  pages: (db, r) => put(db,
    `insert into pages (slug, title, status, featured_image, content, created_at, updated_at, deleted_at)
     values ($slug, $title, $status, $img, $content, $created, $updated, $deleted)`,
    {
      slug: r.slug, title: text(r.title) ?? '', status: text(r.status) ?? 'draft',
      img: text(r.featured_image), content: text(r.content) ?? '',
      created: ts(r.created_at) ?? Date.now(), updated: ts(r.updated_at) ?? Date.now(),
      deleted: ts(r.deleted_at),
    }),

  posts: (db, r) => {
    put(db,
      `insert into posts (slug, title, date, status, featured_image, excerpt, reading_minutes,
         content, series, series_order, meta_title, meta_description, cover_image,
         broadcast_at, created_at, updated_at, deleted_at)
       values ($slug, $title, $date, $status, $img, $excerpt, $minutes, $content, $series,
         $order, $metaTitle, $metaDesc, $cover, $broadcast, $created, $updated, $deleted)`,
      {
        slug: r.slug, title: text(r.title) ?? '', date: ts(r.date) ?? Date.now(),
        status: text(r.status) ?? 'draft', img: text(r.featured_image),
        excerpt: text(r.excerpt), minutes: r.reading_minutes ?? null,
        content: text(r.content) ?? '', series: text(r.series),
        order: r.series_order ?? 0, metaTitle: text(r.meta_title),
        metaDesc: text(r.meta_description), cover: text(r.cover_image),
        broadcast: ts(r.broadcast_at),
        created: ts(r.created_at) ?? Date.now(), updated: ts(r.updated_at) ?? Date.now(),
        deleted: ts(r.deleted_at),
      })
    for (const t of termRows(String(r.slug), r.categories, r.tags)) {
      put(db, `insert into post_terms (post_slug, kind, term) values ($slug, $kind, $term)`,
        { slug: t.post_slug, kind: t.kind, term: t.term })
    }
  },

  post_revisions: (db, r) => put(db,
    `insert into post_revisions (id, slug, data, saved_at) values ($id, $slug, $data, $savedAt)`,
    { id: r.id, slug: r.slug, data: json(r.data), savedAt: ts(r.saved_at) ?? Date.now() }),

  media: (db, r) => put(db,
    `insert into media (path, filename, size, uploaded_at, width, height, thumb, variants, deleted_at)
     values ($path, $filename, $size, $uploadedAt, $width, $height, $thumb, $variants, $deleted)`,
    {
      path: r.path, filename: text(r.filename) ?? '', size: r.size ?? 0,
      uploadedAt: ts(r.uploaded_at) ?? Date.now(), width: r.width ?? null,
      height: r.height ?? null, thumb: text(r.thumb), variants: bool(r.variants),
      deleted: ts(r.deleted_at),
    }),

  files: (db, r) => put(db,
    `insert into files (url, filename, size, content_type, uploaded_at, deleted_at)
     values ($url, $filename, $size, $contentType, $uploadedAt, $deleted)`,
    {
      url: r.url, filename: text(r.filename) ?? '', size: r.size ?? 0,
      contentType: text(r.content_type) ?? '', uploadedAt: ts(r.uploaded_at) ?? Date.now(),
      deleted: ts(r.deleted_at),
    }),

  comments: (db, r) => put(db,
    `insert into comments (id, post_slug, parent_id, depth, author_name, author_email,
       author_website, author_ip, author_country, provider, content, created_at, deleted_at)
     values ($id, $slug, $parent, $depth, $name, $email, $website, $ip, $country,
       $provider, $content, $created, $deleted)`,
    {
      id: r.id, slug: r.post_slug, parent: r.parent_id ?? null, depth: r.depth ?? 0,
      name: text(r.author_name) ?? '', email: text(r.author_email) ?? '',
      website: text(r.author_website), ip: text(r.author_ip), country: text(r.author_country),
      provider: text(r.provider) ?? 'manual', content: text(r.content) ?? '',
      created: ts(r.created_at) ?? Date.now(), deleted: ts(r.deleted_at),
    }),

  subscribers: (db, r) => put(db,
    `insert into subscribers (id, email, status, token, created_at, confirmed_at)
     values ($id, $email, $status, $token, $created, $confirmed)`,
    {
      id: r.id, email: r.email, status: text(r.status) ?? 'pending', token: text(r.token) ?? '',
      created: ts(r.created_at) ?? Date.now(), confirmed: ts(r.confirmed_at),
    }),

  newsletter_sends: (db, r) => put(db,
    `insert into newsletter_sends (id, email, kind, post_slug, sent_at, ok, error, open_token, opened_at)
     values ($id, $email, $kind, $slug, $sentAt, $ok, $error, $openToken, $openedAt)`,
    {
      id: r.id, email: r.email, kind: text(r.kind) ?? 'confirm', slug: text(r.post_slug),
      sentAt: ts(r.sent_at) ?? Date.now(), ok: bool(r.ok), error: text(r.error),
      openToken: text(r.open_token), openedAt: ts(r.opened_at),
    }),

  redirects: (db, r) => put(db,
    `insert into redirects (id, source, destination, permanent, created_at)
     values ($id, $source, $destination, $permanent, $created)`,
    {
      id: r.id, source: r.source, destination: r.destination,
      permanent: bool(r.permanent), created: ts(r.created_at) ?? Date.now(),
    }),

  mcp_tokens: (db, r) => put(db,
    `insert into mcp_tokens (id, name, token_hash, prefix, created_at, expires_at, last_used_at)
     values ($id, $name, $hash, $prefix, $created, $expires, $lastUsed)`,
    {
      id: r.id, name: text(r.name) ?? '', hash: r.token_hash, prefix: text(r.prefix) ?? '',
      created: ts(r.created_at) ?? Date.now(), expires: ts(r.expires_at) ?? Date.now(),
      lastUsed: ts(r.last_used_at),
    }),

  mcp_clients: (db, r) => put(db,
    `insert into mcp_clients (client_id, redirect_uris, created_at) values ($id, $uris, $created)`,
    { id: r.client_id, uris: uriList(r.redirect_uris), created: ts(r.created_at) ?? Date.now() }),

  mcp_used_codes: (db, r) => put(db,
    `insert into mcp_used_codes (jti, expires_at) values ($jti, $expires)`,
    { jti: r.jti, expires: ts(r.expires_at) ?? Date.now() }),

  activity_log: (db, r) => put(db,
    `insert into activity_log (id, at, action, detail) values ($id, $at, $action, $detail)`,
    { id: r.id, at: ts(r.at) ?? Date.now(), action: text(r.action) ?? 'error', detail: text(r.detail) ?? '' }),

  analytics_events: (db, r) => put(db,
    `insert into analytics_events (id, path, visitor, referrer_host, country, device, browser, os, created_at)
     values ($id, $path, $visitor, $host, $country, $device, $browser, $os, $created)`,
    {
      id: r.id, path: r.path, visitor: r.visitor, host: text(r.referrer_host),
      country: text(r.country), device: text(r.device), browser: text(r.browser),
      os: text(r.os), created: ts(r.created_at) ?? Date.now(),
    }),

  analytics_scroll: (db, r) => put(db,
    `insert into analytics_scroll (id, path, depth, dwell_ms, visitor, created_at)
     values ($id, $path, $depth, $dwell, $visitor, $created)`,
    {
      id: r.id, path: r.path, depth: r.depth ?? 0, dwell: r.dwell_ms ?? null,
      visitor: r.visitor, created: ts(r.created_at) ?? Date.now(),
    }),
}

/**
 * Advance every AUTOINCREMENT counter past the ids just inserted.
 *
 * Without this the next comment created after cutover reuses an id that already exists,
 * which fails on the primary key at best and re-parents an orphaned reply at worst.
 * `sqlite_sequence` only gets a row once a table has been inserted into, so this both
 * inserts and updates.
 */
export function advanceSequences(db: Database, tables: string[]): void {
  for (const table of tables) {
    const max = db.query<{ m: number | null }, []>(`select max(id) as m from ${table}`).get()?.m
    if (max == null) continue
    const existing = db.query<{ n: number }, [string]>(
      `select count(*) as n from sqlite_sequence where name = ?`).get(table)!.n
    if (existing) db.query(`update sqlite_sequence set seq = ? where name = ?`).run(max, table)
    else db.query(`insert into sqlite_sequence (name, seq) values (?, ?)`).run(table, max)
  }
}

/** Tables whose ids come from AUTOINCREMENT and therefore need the counter advanced. */
export const SEQUENCE_TABLES = [
  'post_revisions', 'comments', 'subscribers', 'newsletter_sends',
  'redirects', 'mcp_tokens', 'activity_log',
]

/** FTS5 is external-content, so it is rebuilt from the imported rows rather than copied. */
export function rebuildSearchIndex(db: Database): void {
  db.run(`insert into posts_fts(posts_fts) values ('rebuild')`)
}
