// `import-v1`: one-way importer from Quire 1.x. See docs/spec/05-importer.md.
//
//   bun run import-v1 --postgrest URL --token TOKEN --uploads DIR --out FILE [flags]
//
// `analytics.db` is written beside `--out`, not separately: `openDatabases` owns both
// filenames so that the running server and the importer cannot disagree about where they
// are. 05-importer.md's separate `--analytics-out` flag is therefore not implemented.
//
// One direction only. There is no sync, no dual-write, and no path back. The whole content
// import runs in ONE transaction: either the instance is fully imported or the file is
// untouched.
//
// It reads a RUNNING 1.x over PostgREST, and the last one was shut down on 2026-07-31, so
// nothing it can point at exists any more. Kept for the same reason `v1/` is kept (ADR 0017):
// it is the readable record of how the two data models line up, and `@supabase/postgrest-js`
// stays a devDependency for it. Do not maintain it; do not delete it to save a dependency
// that never reaches a build.

import { existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabases, closeDatabases, db, analyticsDb } from '@/store/db'
import { CHECKSUM_COLUMNS, CHECKSUM_KEYS, type ChecksumTable } from '@/import/checksum'
import {
  formatFindings, isFatal, verifyChecksums, verifyCounts, verifySearch, verifySemantic,
  verifySpot, type Finding,
} from '@/import/verify'
import { ANALYTICS_TABLES, ORDER_KEY, SOURCE_TABLES, Source } from './import/source'
import { advanceSequences, rebuildSearchIndex, SEQUENCE_TABLES, WRITERS, type SourceRow } from '@/import/write'

type Options = {
  postgrest: string; token: string; uploads: string; out: string
  dryRun: boolean; skipAnalytics: boolean; verifyOnly: boolean
  force: boolean; seed: number
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string, fallback = '') => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback
  }
  const has = (name: string) => argv.includes(`--${name}`)
  return {
    postgrest: flag('postgrest', process.env.POSTGREST_URL ?? ''),
    token: flag('token', process.env.POSTGREST_TOKEN ?? ''),
    uploads: flag('uploads'),
    out: flag('out', './data/quire.db'),
    dryRun: has('dry-run'),
    skipAnalytics: has('skip-analytics'),
    verifyOnly: has('verify-only'),
    force: has('force'),
    // Printed on every run, so a Tier 3 failure is reproducible.
    seed: Number(flag('seed', String(Date.now() % 2_147_483_647))),
  }
}

const log = (msg: string) => console.log(msg)

// ----- binaries ---------------------------------------------------------------

/**
 * Stricter than the row checks, because a missing image is invisible until a reader hits
 * the page. A failure here aborts; an unreferenced file on disk is only reported.
 */
function verifyBinaries(uploads: string): Finding[] {
  const out: Finding[] = []
  const check = (path: string, size: number | null, table: string) => {
    const full = join(uploads, path)
    if (!existsSync(full)) {
      out.push({ tier: 4, table, fatal: true, detail: `${path} is in the database but not on disk` })
      return
    }
    if (size != null && size > 0 && statSync(full).size !== size) {
      out.push({
        tier: 4, table, fatal: true,
        detail: `${path} is ${statSync(full).size} bytes on disk, ${size} in the database`,
      })
    }
  }

  for (const r of db().query<{ path: string; size: number; thumb: string | null; variants: number }, []>(
    `select path, size, thumb, variants from media`).all()) {
    check(r.path, r.size, 'media')
    if (r.thumb && r.thumb !== r.path) check(r.thumb, null, 'media')
    // Derived variants are recorded by a flag, not by row, so their names are rebuilt.
    if (r.variants && /\.(jpe?g|png)$/i.test(r.path)) {
      const stem = r.path.replace(/\.[^.]+$/, '')
      for (const w of [1024, 1600]) for (const ext of ['webp', 'avif']) check(`${stem}-${w}.${ext}`, null, 'media')
    }
  }
  for (const r of db().query<{ url: string; size: number }, []>(`select url, size from files`).all()) {
    check(r.url, r.size, 'files')
  }

  // Every image reference inside post and page CONTENT. Refs are stored store-relative
  // (Invariant 3), so this is a string scan for the collapsed form plus a lookup.
  const known = new Set(db().query<{ p: string }, []>(`select path as p from media`).all().map((r) => r.p))
  for (const r of db().query<{ slug: string; content: string }, []>(
    `select slug, content from posts union all select slug, content from pages`).all()) {
    // `&` terminates the match: a link written `<…/file.pdf>` is escaped to `…pdf&gt;` in
    // the stored markdown, and without this the entity is captured as part of the path and
    // reported as a missing file that was never named.
    for (const ref of r.content.matchAll(/\bmedia\/[^\s")'#&]+/g)) {
      if (!known.has(ref[0]) && !existsSync(join(uploads, ref[0]))) {
        // NOT fatal. This says the SOURCE blog already had a broken image reference — the
        // file is in neither v1's media table nor its uploads tree, so there was nothing
        // for the import to lose and nothing it can repair. Refusing to migrate a blog
        // because one old post links a file deleted years ago is the wrong call; the
        // owner still gets told. The genuinely fatal binary check is the one above, where
        // a media ROW exists and its bytes do not.
        out.push({ tier: 4, table: 'content', fatal: false, detail: `/${r.slug} references missing ${ref[0]} (already broken in v1)` })
      }
    }
  }
  return out
}

// ----- verification -----------------------------------------------------------

async function verify(source: Source, opts: Options): Promise<Finding[]> {
  const findings: Finding[] = []

  log('\ntier 1: row counts')
  const sourceCounts: Record<string, number> = {}
  const targetCounts: Record<string, number> = {}
  for (const table of SOURCE_TABLES) {
    sourceCounts[table] = await source.count(table)
    targetCounts[table] = db().query<{ n: number }, []>(`select count(*) as n from ${table}`).get()!.n
  }
  findings.push(...verifyCounts(sourceCounts, targetCounts))

  log('tier 2 + 3: checksums and spot comparison')
  for (const table of Object.keys(CHECKSUM_COLUMNS) as ChecksumTable[]) {
    const src = await source.readAll(table, ORDER_KEY[table]!)
    const tgt = db().query<SourceRow, []>(
      `select ${CHECKSUM_COLUMNS[table].join(', ')} from ${table}`).all()
    findings.push(...verifyChecksums(table, src, tgt))
    findings.push(...verifySpot(table, src, tgt, opts.seed))
  }

  log('tier 4: semantics')
  const sourcePosts = (await source.readAll('posts', 'slug')).map((p) => ({
    slug: String(p.slug), categories: p.categories, tags: p.tags,
  }))
  const comments = db().query<{ id: number; parent_id: number | null }, []>(
    `select id, parent_id from comments`).all()
  const sourceCommentIds = new Set(
    (await source.readAll('comments', 'id')).map((c) => Number(c.id)))
  findings.push(...verifySemantic({
    sourcePosts,
    targetTerms: db().query<{ post_slug: string; kind: string; term: string }, []>(
      `select post_slug, kind, term from post_terms`).all(),
    postSlugs: db().query<{ slug: string }, []>(`select slug from posts`).all().map((r) => r.slug),
    pageSlugs: db().query<{ slug: string }, []>(`select slug from pages`).all().map((r) => r.slug),
    comments,
    // A v1 orphan (parent purged) must survive AS an orphan, not be repaired.
    sourceOrphanIds: comments
      .filter((c) => c.parent_id !== null && !sourceCommentIds.has(c.parent_id))
      .map((c) => c.id),
    softDeleted: await Promise.all(
      (['posts', 'pages', 'media', 'files', 'comments'] as const).map(async (table) => ({
        table,
        source: await source.softDeletedCount(table),
        target: db().query<{ n: number }, []>(
          `select count(*) as n from ${table} where deleted_at is not null`).get()!.n,
      })),
    ),
  }))

  // FTS5 sanity on 20 real titles: a word from a title must find that post again.
  const samples = db().query<{ slug: string; title: string }, []>(
    `select slug, title from posts where deleted_at is null and title != '' limit 20`).all()
    .map((p) => {
      const word = p.title.split(/\s+/).find((w) => w.length > 3) ?? p.title
      const hits = db().query<{ slug: string }, [string]>(
        `select p.slug from posts_fts f join posts p on p.rowid = f.rowid where posts_fts match ?`)
        .all(`"${word.replaceAll('"', '""')}"`).map((r) => r.slug)
      return { word, slug: p.slug, hits }
    })
  findings.push(...verifySearch(samples))

  if (opts.uploads) {
    log('binaries')
    findings.push(...verifyBinaries(opts.uploads))
  } else {
    log('binaries: SKIPPED (no --uploads given)')
  }

  return findings
}

// ----- import -----------------------------------------------------------------

async function importContent(source: Source): Promise<void> {
  const batches = new Map<string, SourceRow[]>()
  for (const table of SOURCE_TABLES) {
    batches.set(table, await source.readAll(table, ORDER_KEY[table]!))
    log(`  read ${table}: ${batches.get(table)!.length} rows`)
  }
  // ONE transaction: either the instance is fully imported or the file is untouched.
  db().transaction(() => {
    for (const table of SOURCE_TABLES) {
      const writer = WRITERS[table]!
      for (const row of batches.get(table)!) writer(db(), row)
    }
    advanceSequences(db(), SEQUENCE_TABLES)
    rebuildSearchIndex(db())
  })()
}

async function importAnalytics(source: Source): Promise<void> {
  for (const table of ANALYTICS_TABLES) {
    let total = 0
    for await (const rows of source.readBatched(table, 10_000)) {
      analyticsDb().transaction(() => {
        for (const row of rows) WRITERS[table]!(analyticsDb(), row)
      })()
      total += rows.length
    }
    log(`  ${table}: ${total} rows`)
  }
}

// ----- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.postgrest || !opts.token) {
    console.error('import-v1: --postgrest and --token are required (or POSTGREST_URL / POSTGREST_TOKEN)')
    process.exit(2)
  }
  log(`import-v1  seed=${opts.seed}`)

  const dir = opts.out.replace(/[\\/][^\\/]+$/, '') || '.'
  if (!opts.verifyOnly && existsSync(opts.out)) {
    // Deliberately not an upsert: an incremental importer would need conflict rules for
    // every table and would be used exactly twice. Re-running from scratch is minutes.
    if (!opts.force) {
      console.error(`import-v1: ${opts.out} already exists. Re-run with --force to replace it.`)
      process.exit(2)
    }
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${opts.out}${suffix}`, { force: true })
  }

  openDatabases(dir)
  const source = new Source(opts.postgrest, opts.token)

  try {
    if (!opts.verifyOnly) {
      log('\nreading v1')
      await importContent(source)
      log('content imported')
      if (opts.skipAnalytics) log('analytics: SKIPPED')
      else {
        log('analytics')
        await importAnalytics(source)
      }
    }

    const findings = await verify(source, opts)
    log('\nverification')
    log(formatFindings(findings))

    if (opts.dryRun) {
      log('\n--dry-run: rolling back by removing the file')
      closeDatabases()
      for (const suffix of ['', '-wal', '-shm']) rmSync(`${opts.out}${suffix}`, { force: true })
      return
    }
    if (isFatal(findings)) {
      console.error('\nimport-v1: FAILED verification. The database file is left in place for inspection.')
      process.exit(1)
    }
    log('\nimport-v1: complete')
  } finally {
    closeDatabases()
  }
}

await main()
