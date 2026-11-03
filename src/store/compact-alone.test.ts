// The compaction after an upgrade renames a fresh copy over `quire.db`, so it must not run while
// another process holds the file: the old one in an overlapping deploy kept writing to the file
// renamed away and shared its `-wal` with the new one, and the reopened database read as
// "malformed" or was short the rows written meanwhile (2026-11-04). Here the other process is real.
import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { wrap } from '@/runtime/bun/db'
import { compactIfMostlyFree } from './upgrade'

const DIR = './.tmp/test-compact-alone'
afterEach(() => rmSync(DIR, { recursive: true, force: true }))

/** A file nearly all holes, which the compaction would rewrite. */
function mostlyFree(): string {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
  const path = join(DIR, 'quire.db')
  const db = new Database(path, { create: true })
  db.run(`pragma journal_mode = WAL`)
  db.run(`create table t (id integer primary key, blob text)`)
  const insert = db.prepare(`insert into t (blob) values (?)`)
  db.transaction(() => { for (let i = 0; i < 4000; i++) insert.run('x'.repeat(900)) })()
  db.run(`delete from t where id > 10`)
  insert.finalize() // or the close leaves the connection open, and the compaction rightly refuses
  db.close()
  return path
}

/** Another process with the database open: it writes once, waits for a line, then writes again. */
const OTHER = `
  const { Database } = require('bun:sqlite')
  const db = new Database(process.argv[1])
  db.run('pragma journal_mode = WAL'); db.run('pragma busy_timeout = 5000')
  db.run("insert into t (blob) values ('before')")
  console.log('ready')
  for await (const _ of console) break
  db.run("insert into t (blob) values ('after')")
  console.log('done')
  db.close()
`

test('is not done while another process has the file open, which keeps every row it writes', async () => {
  const path = mostlyFree()
  const other = Bun.spawn([process.execPath, '-e', OTHER, path], { stdin: 'pipe', stdout: 'pipe' })
  const lines = other.stdout.pipeThrough(new TextDecoderStream()).getReader()
  expect((await lines.read()).value).toContain('ready')

  const db = new Database(path)
  expect(compactIfMostlyFree(wrap(db), path, { minShare: 0.25, minBytes: 1 })).toBe(false)
  // The connection goes on serving, and lets the lock go: the other process can still write.
  expect(db.query(`select count(*) as n from t`).get()).toEqual({ n: 11 })
  other.stdin.write('go\n')
  await other.stdin.end()
  expect((await lines.read()).value).toContain('done')
  expect(await other.exited).toBe(0)
  db.close()

  const after = new Database(path, { readonly: true })
  expect(after.query(`select count(*) as n from t`).get()).toEqual({ n: 12 })
  expect(after.query(`pragma integrity_check`).get()).toEqual({ integrity_check: 'ok' })
  after.close()
})

test('is done when nothing else has the file open, and leaves no -wal beside the copy', () => {
  const path = mostlyFree()
  const db = new Database(path)
  db.run(`pragma journal_mode = WAL`)
  expect(compactIfMostlyFree(wrap(db), path, { minShare: 0.25, minBytes: 1 })).toBe(true)
  expect(Bun.file(`${path}-wal`).size).toBe(0)
  const after = new Database(path, { readonly: true })
  expect(after.query(`select count(*) as n from t`).get()).toEqual({ n: 10 })
  expect(after.query(`pragma integrity_check`).get()).toEqual({ integrity_check: 'ok' })
  after.close()
})
