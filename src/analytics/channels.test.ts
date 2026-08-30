// How a reader FOUND the site, which is the one panel where the arithmetic has been wrong
// twice for the same reason: a visitor is a person, and a person can produce many rows.
//
// The classification itself is a pure function and pinned at the bottom. Everything above it
// is about the fold from rows to people, where both bugs lived.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb, db } from '@/store/db'
import { getAnalytics } from '@/analytics/summary'
import { channelOf } from '@/analytics/channel'

const DIR = './.tmp/test-channels'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  analyticsDb().run(`delete from analytics_events`)
  db().run(`delete from posts`)
  for (const slug of ['a', 'b', 'c']) {
    db().run(
      `insert into posts (slug, title, date, status, created_at, updated_at)
       values (?, ?, 1, 'published', 1, 1)`, [slug, slug],
    )
  }
})

const view = (v: { visitor: string; host?: string | null; path?: string }) =>
  analyticsDb().run(
    `insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
     values (?, ?, ?, null, 'desktop', 'Chrome', 'macOS', ?)`,
    [v.path ?? '/a', v.visitor, v.host ?? null, Date.now() - 3_600_000],
  )

const sorted = (rows: { channel: string; visitors: number }[]) =>
  [...rows].sort((a, b) => a.channel.localeCompare(b.channel))

describe('a person is counted once, however many rows they left', () => {
  it('counts a visitor ONCE per channel however many hosts they arrived from', async () => {
    // The first bug: summing per-host visitor counts would report 2 here.
    view({ visitor: 'v1', host: 'google.com' })
    view({ visitor: 'v1', host: 'bing.com' })
    view({ visitor: 'v2', host: null })
    expect(sorted((await getAnalytics(7)).channels!)).toEqual([
      { channel: 'direct', visitors: 1 }, { channel: 'search', visitors: 1 },
    ])
  })

  /**
   * The second bug, found 2026-08-30 and measured on a live blog: 36 of 380 visitors were
   * being counted twice, 11% of a Direct bar of 316.
   *
   * The referrer rides on the LANDING page only — `externalReferrer` in `assets/js/track.ts`
   * returns '' for a same-origin referrer — so every page a reader opens after the first
   * writes `referrer_host = NULL`, and `channelOf(null)` is 'direct'. Anyone who arrived
   * from somewhere and then clicked one more post appeared in that channel AND in Direct.
   */
  it('does not read a second page view as a direct visit', async () => {
    view({ visitor: 'v1', host: 'google.com', path: '/a' })
    view({ visitor: 'v1', host: null, path: '/b' }) // the same reader, one click later
    expect((await getAnalytics(7)).channels).toEqual([{ channel: 'search', visitors: 1 }])
  })

  // The property that says it in one line: the bars are a partition of the readers, so they
  // cannot add up to more people than the site had.
  it('keeps the bars summing to the visitor count', async () => {
    view({ visitor: 'fromSearch', host: 'google.com', path: '/a' })
    view({ visitor: 'fromSearch', host: null, path: '/b' })
    view({ visitor: 'fromSocial', host: 'reddit.com', path: '/a' })
    view({ visitor: 'fromSocial', host: null, path: '/c' })
    view({ visitor: 'typedItIn', host: null, path: '/a' })
    const s = await getAnalytics(7)
    expect(s.channels!.reduce((n, c) => n + c.visitors, 0)).toBe(s.uniqueVisitors)
    expect(s.channels!.find((c) => c.channel === 'direct')?.visitors).toBe(1)
  })

  // Arriving from two DIFFERENT places is a fact about the reader, not an artefact of how
  // many pages they read, so that one is still allowed to be in two channels.
  it('still lets a reader who genuinely arrived twice count in both', async () => {
    view({ visitor: 'v1', host: 'google.com', path: '/a' })
    view({ visitor: 'v1', host: 'reddit.com', path: '/b' })
    expect(sorted((await getAnalytics(7)).channels!)).toEqual([
      { channel: 'search', visitors: 1 }, { channel: 'social', visitors: 1 },
    ])
  })
})

describe('channelOf', () => {
  it('classifies the four channels', () => {
    expect(channelOf(null)).toBe('direct')
    expect(channelOf('')).toBe('direct')
    expect(channelOf('www.google.com')).toBe('search')
    expect(channelOf('duckduckgo.com')).toBe('search')
    expect(channelOf('t.co')).toBe('social')
    expect(channelOf('x.com')).toBe('social')
    expect(channelOf('news.ycombinator.com')).toBe('referral')
  })
})
