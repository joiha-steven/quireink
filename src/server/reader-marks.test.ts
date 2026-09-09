// A reader's marks across devices (ADR 0047): a code that is a key, an address that never
// lands in a table, and rows that go when nobody has touched them for a year.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { resetSecretCache } from '@/auth/secret'
import {
  forgetReader, getMarks, mintCode, pagesOf, putMarks, readerOfCode, readerOfEmail, sweepReaderMarks,
  MAX_BODY_BYTES, MAX_PAGES, RETENTION_MS,
} from '@/server/reader-marks'

const DIR = './.tmp/test-reader-marks'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => {
  for (const t of ['reader_marks', 'reader_keys', 'server_secrets']) db().run(`delete from ${t}`)
  resetSecretCache()
})

const marks = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `m${i}`, exact: `words ${i}`, kind: 'hl' })))

describe('a notebook code', () => {
  it('is twenty letters in groups of four, from an alphabet with no look-alikes, and only its hash is kept', () => {
    const code = mintCode()
    expect(code).toMatch(/^([a-hj-kmnp-z2-9]{4}-){4}[a-hj-kmnp-z2-9]{4}$/)
    const rows = db().query<{ key_hash: string }, []>(`select key_hash from reader_keys`).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.key_hash).not.toContain(code.slice(0, 4))
  })

  it('names the same reader however it is typed, and refuses one that was never minted', () => {
    const code = mintCode()
    const a = readerOfCode(code)
    const b = readerOfCode(` ${code.toUpperCase().replace(/-/g, ' ')} `)
    expect(a).not.toBeNull()
    expect(b?.id).toBe(a!.id)
    expect(a!.via).toBe('code')
    expect(readerOfCode('abcd-efgh-jkmn-pqrs-tuvw')).toBeNull()
    expect(readerOfCode('')).toBeNull()
  })

  it('is stamped when used', () => {
    const code = mintCode()
    db().run(`update reader_keys set last_used_at = 1`)
    readerOfCode(code)
    expect(db().query<{ t: number }, []>(`select last_used_at as t from reader_keys`).get()!.t).toBeGreaterThan(1)
  })
})

describe('a commenter', () => {
  it('becomes an opaque id that is stable, case-blind, and not the address', () => {
    const a = readerOfEmail('Reader@Example.com')
    expect(a).toEqual(readerOfEmail(' reader@example.com '))
    expect(a.via).toBe('google')
    expect(a.id).toMatch(/^g:[0-9a-f]{64}$/)
    expect(a.id).not.toContain('example')
    expect(readerOfEmail('other@example.com').id).not.toBe(a.id)
  })
})

describe('keeping marks', () => {
  it('stores the list and hands it back verbatim, per page, per reader', () => {
    expect(putMarks('k:one', '/a', marks(2))).toBe(true)
    expect(putMarks('k:one', '/b', marks(1))).toBe(true)
    expect(putMarks('k:two', '/a', marks(3))).toBe(true)
    expect(getMarks('k:one', '/a')).toBe(marks(2))
    expect(getMarks('k:two', '/a')).toBe(marks(3))
    expect(getMarks('k:one', '/c')).toBeNull()
    expect(putMarks('k:one', '/a', '[]')).toBe(true)
    expect(getMarks('k:one', '/a')).toBe('[]')
  })

  it('refuses anything that is not a list of marks with their words, or that is too large', () => {
    expect(putMarks('k:one', '/a', 'null')).toBe(false)
    expect(putMarks('k:one', '/a', '{"exact":"x"}')).toBe(false)
    expect(putMarks('k:one', '/a', '[{"kind":"hl"}]')).toBe(false)
    expect(putMarks('k:one', '/a', 'not json')).toBe(false)
    const big = JSON.stringify([{ exact: 'x'.repeat(MAX_BODY_BYTES) }])
    expect(putMarks('k:one', '/a', big)).toBe(false)
    expect(getMarks('k:one', '/a')).toBeNull()
  })

  it('keeps the newest pages and drops the oldest past the cap', () => {
    for (let i = 0; i < MAX_PAGES + 3; i++) {
      putMarks('k:one', `/p${i}`, marks(1))
      db().run(`update reader_marks set updated_at = ? where reader = 'k:one' and path = ?`, [1000 + i, `/p${i}`])
    }
    putMarks('k:one', '/last', marks(1))
    const pages = pagesOf('k:one')
    expect(pages).toHaveLength(MAX_PAGES)
    expect(pages[0]).toBe('/last')
    expect(pages).not.toContain('/p0')
    expect(pages).toContain(`/p${MAX_PAGES + 2}`)
  })

  it('forgets a reader whole, code included', () => {
    const code = mintCode()
    const who = readerOfCode(code)!
    putMarks(who.id, '/a', marks(1))
    putMarks('k:other', '/a', marks(1))
    forgetReader(who)
    expect(getMarks(who.id, '/a')).toBeNull()
    expect(readerOfCode(code)).toBeNull()
    expect(getMarks('k:other', '/a')).not.toBeNull()
    forgetReader(readerOfEmail('r@example.com'))
    expect(db().query<{ n: number }, []>(`select count(*) as n from reader_keys`).get()!.n).toBe(0)
  })

  it('sweeps marks and codes untouched for a year, and nothing younger', () => {
    const now = Date.now()
    putMarks('k:old', '/a', marks(1))
    putMarks('k:new', '/a', marks(1))
    db().run(`update reader_marks set updated_at = ? where reader = 'k:old'`, [now - RETENTION_MS - 1])
    mintCode()
    mintCode()
    db().run(`update reader_keys set last_used_at = ? where rowid = 1`, [now - RETENTION_MS - 1])
    expect(sweepReaderMarks(now)).toBe(2)
    expect(getMarks('k:old', '/a')).toBeNull()
    expect(getMarks('k:new', '/a')).not.toBeNull()
    expect(db().query<{ n: number }, []>(`select count(*) as n from reader_keys`).get()!.n).toBe(1)
  })
})
