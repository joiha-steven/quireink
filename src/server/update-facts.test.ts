// The four buckets, and the only thing worth testing about them: that each one stays a STEP.
//
// A bucket that quietly became precise would not fail anything — the call would still go out,
// the page would still draw — and it would undo the reason the daily token exists, because a
// blog reporting an exact count is a blog that can be recognised tomorrow. So these assert
// the boundaries rather than the happy path, including the two that are easy to get backwards:
// an unclaimed blog says nothing about its age instead of claiming to be new, and a trashed
// post stops counting the way every other live read treats one.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { ageBucket, installKind, sizeBucket } from '@/server/update-facts'

const DIR = './.tmp/test-update-facts'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const NOON = Date.parse('2026-08-22T12:00:00Z')

describe('the buckets say roughly, and never exactly', () => {
  const DAY = 86_400_000
  // The shared `beforeEach` clears the check's own tables and nothing else, because no test
  // before these had any reason to write a post or an owner. These do, so they clean up
  // after themselves — a bucket read against another test's leftovers is a bucket that
  // passes for the wrong reason.
  beforeEach(() => {
    db().run(`delete from posts`)
    db().run(`delete from users`)
  })

  it('age is taken from when the blog was claimed, in five steps', () => {
    expect(ageBucket(NOON)).toBe('') // unclaimed: silent, not "0"
    db().run(`insert into users (username,email,password_hash,created_at,updated_at)
              values ('o','o@e.test','x',?,?)`, [NOON - 40 * DAY, NOON])
    expect(ageBucket(NOON)).toBe('3')             // 40 days: within the quarter
    expect(ageBucket(NOON + 60 * DAY)).toBe('4')  // 100 days later: older
    expect(ageBucket(NOON - 40 * DAY)).toBe('0')  // the day it was made
    expect(ageBucket(NOON - 39 * DAY)).toBe('1')  // one day later: within the week
  })

  it('size counts published posts only, so a drafts folder is not a blog', () => {
    const t = NOON
    const add = (slug: string, status: string) => db().run(
      `insert into posts (slug,title,content,status,date,created_at,updated_at)
       values (?,?,'',?,?,?,?)`, [slug, slug, status, t, t, t])
    expect(sizeBucket()).toBe('0')
    add('d1', 'draft')
    expect(sizeBucket()).toBe('0')
    for (let i = 0; i < 5; i++) add(`p${i}`, 'published')
    expect(sizeBucket()).toBe('1')
    add('p5', 'published')
    expect(sizeBucket()).toBe('2')
  })

  it('a trashed post stops counting, like every other live read (Invariant 6)', () => {
    const t = NOON
    db().run(`insert into posts (slug,title,content,status,date,created_at,updated_at)
              values ('gone','gone','','published',?,?,?)`, [t, t, t])
    expect(sizeBucket()).toBe('1')
    db().run(`update posts set deleted_at = ? where slug = 'gone'`, [t])
    expect(sizeBucket()).toBe('0')
  })

  it('the install names itself when the template says so, and is bounded', () => {
    const keep = process.env.QUIRE_INSTALL
    process.env.QUIRE_INSTALL = 'unraid'
    expect(installKind()).toBe('unraid')
    // It arrives from the environment and ends up in a URL, so anything not plainly a name
    // is ignored rather than passed on.
    process.env.QUIRE_INSTALL = 'droplet; rm -rf /'
    expect(installKind()).toBe('source')
    process.env.QUIRE_INSTALL = ''
    expect(installKind()).toBe('source')
    if (keep === undefined) delete process.env.QUIRE_INSTALL
    else process.env.QUIRE_INSTALL = keep
  })
})
