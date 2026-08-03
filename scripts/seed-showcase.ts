// A believable blog in a throwaway database: the fixture every screenshot is taken against.
//
// Replaces three narrower seeds that each built half a site. The README shots, the front
// page and the comment thread now come from ONE state, so a screenshot can be reproduced
// rather than recreated from memory by whoever took it last.
//
// The fonts are the ones the project is designed around — Literata for the reader's words,
// JetBrains Mono for everything that is the machine talking — with the IDE chrome on, which
// is what ties the two together. English content on purpose: these end up in a README.
//
//   bun scripts/seed-showcase.ts [dir] [text|image] [list|front]
//
// `seed-demo.ts` stays: it exists to exercise every island on one post, which is a different
// job from looking like a blog.

import { rmSync } from 'node:fs'
import { openDatabases } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { addComment } from '@/comments/comments'
import { saveSettings, getSettings } from '@/content/settings'
import { DEFAULT_HOME } from '@/content/settings-sanitize'
import { bufferEvent, bufferScroll, flushAnalytics } from '@/analytics/buffer'
import { createUser, setTotpSecret } from '@/auth/users'
import { generateSecret } from '@/auth/totp'
import { createSession } from '@/auth/sessions'
import { POSTS } from './seed-content'

const DIR = process.argv[2] ?? './.tmp/drive-data'
const KIND = (process.argv[3] ?? 'text') as 'image' | 'text'
const MODE = process.argv[4] === 'front' ? 'front' : 'list'

rmSync(DIR, { recursive: true, force: true })
openDatabases(DIR)

const DAY = 24 * 60 * 60 * 1000
const START = Date.UTC(2026, 6, 30, 9, 0, 0)

for (let i = 0; i < POSTS.length; i += 1) {
  const p = POSTS[i]!
  await savePost({
    title: p.title,
    slug: p.slug,
    status: 'published',
    date: new Date(START - p.ago * DAY).toISOString(),
    content: p.body,
    excerpt: p.excerpt,
    categories: [p.category],
    tags: p.tags,
    ...(p.series ? { series: p.series, seriesOrder: p.order } : {}),
    // A file the server already serves, so the image kind is photographable without an
    // upload. It has no responsive variants, which is the path a fresh install takes anyway.
    ...(KIND === 'image' && i % 3 !== 2 ? { featuredImage: '/app-icon.png' } : {}),
  })
}

await savePage({
  title: 'Colophon', slug: 'colophon', status: 'published',
  content: 'Notes on letterforms and the making of pages: calligraphy, type, layout and print.\n\n'
    + 'Set in Literata for reading and JetBrains Mono for everything the machine says.',
})

const top = await addComment({
  postSlug: 'the-measure-is-the-design', parentId: null,
  name: 'Marta Vogel', email: 'marta@example.com', website: '', provider: 'manual',
  content: 'The leading point is the one nobody plans for. I set a beautiful 66-character '
    + 'measure and then wondered for a week why German copy still felt cramped. It was the '
    + 'umlauts, every time.',
  ip: '', country: 'DE',
})
await addComment({
  postSlug: 'the-measure-is-the-design', parentId: top.id,
  name: 'The author', email: 'author@example.com', website: '', provider: 'manual',
  content: 'Vietnamese is the same lesson at twice the volume: two marks stacked on one '
    + 'vowel, so the ascender space a Latin face reserves is simply not enough.',
  ip: '', country: 'VN',
})

const s = await getSettings()
await saveSettings({
  ...s,
  title: 'Quire Ink',
  description: 'Letterforms, and the making of pages',
  showDescription: true,
  fontPreset: 'literata',
  chromeFont: 'jetbrains-mono',
  ideChrome: true,
  menu: [
    { label: 'Typography', href: '/category/typography' },
    { label: 'Calligraphy', href: '/category/calligraphy' },
    { label: 'Printing', href: '/category/printing' },
    { label: 'Colophon', href: '/colophon' },
  ],
  // The timeline in the listing's right gutter is part of infinite scroll, and it is what
  // the spread-out dates above are for: a month marker per group, a sticky year.
  features: { ...s.features, infiniteScroll: true },
  featured: ['the-broad-edged-pen', 'a-type-scale-you-can-defend', 'imposition-why-page-one-sits-beside-page-eight'],
  mostViewedCount: 3,
  comments: { ...s.comments, enabled: true },
  home: {
    ...DEFAULT_HOME,
    // `list` unless MODE says otherwise. The demo's front door is the blog list, the same
    // shape a fresh install gets; the composed front page is a second instance seeded with
    // MODE=front, because `/` serves exactly one of the two and there is no other route to
    // the front page.
    mode: MODE,
    front: {
      ...DEFAULT_HOME.front,
      kind: KIND,
      strips: [
        { category: 'Typography', count: 3, columns: 3 },
        { category: 'Calligraphy', count: 2, columns: 2 },
        { category: 'Printing', count: 3, columns: 3 },
      ],
    },
  },
})

/**
 * A month of traffic, so the parts of the product that COUNT things have something to count.
 *
 * Without it the dashboard reads 0 views / no activity / "No views yet", the analytics page
 * is five empty charts, and the front page's most-viewed row does not render at all — none
 * of which is a screenshot of the software, it is a screenshot of an empty database. The
 * numbers are deterministic (no RNG) so two runs produce the same plate.
 */
const VISITS_TOP = 260 // the best-performing post over the window
const DEVICES = ['mobile', 'desktop', 'mobile', 'tablet']
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Safari']
const SYSTEMS = ['Android', 'macOS', 'iOS', 'Windows']
const COUNTRIES = ['VN', 'US', 'DE', 'GB', 'JP', 'SG']
const SOURCES = [null, null, 'news.ycombinator.com', 'google.com', 'lobste.rs', 'bsky.app']
const WINDOW_DAYS = 30

for (const [rank, p] of POSTS.entries()) {
  // A long tail rather than a flat line: the fourth post gets a quarter of the first, which
  // is the shape real traffic has and the shape a "most viewed" list needs to be worth
  // drawing at all.
  const total = Math.round(VISITS_TOP / (rank * 0.55 + 1))
  for (let i = 0; i < total; i += 1) {
    const day = i % WINDOW_DAYS
    bufferEvent({
      path: `/${p.slug}`,
      // One visitor id per (post, day, slot) so visitors track views without equalling them.
      visitor: `v${(rank * 7 + i) % 90}`,
      referrerHost: SOURCES[(rank + i) % SOURCES.length] ?? null,
      country: COUNTRIES[(rank * 3 + i) % COUNTRIES.length] ?? null,
      device: DEVICES[i % DEVICES.length] ?? null,
      browser: BROWSERS[i % BROWSERS.length] ?? null,
      os: SYSTEMS[i % SYSTEMS.length] ?? null,
      createdAt: START - day * DAY + (i % 20) * 3600_000,
    })
    // Read depth on every third view: enough samples for the engagement panel, and it keeps
    // the scroll table from being the same size as the event table.
    if (i % 3 === 0) {
      bufferScroll({
        path: `/${p.slug}`,
        depth: [28, 55, 74, 96][i % 4] ?? 50,
        dwellMs: 40_000 + (i % 9) * 25_000,
        visitor: `v${(rank * 7 + i) % 90}`,
        createdAt: START - day * DAY,
      })
    }
  }
  flushAnalytics()
}

/**
 * An owner, already signed in.
 *
 * The admin is the half of the product a screenshot could never reach: sign-in needs a
 * password AND a TOTP code, and the session cookie is `__Host-` prefixed so it cannot be
 * forged from the page's own JavaScript. Minting the session here — in the throwaway
 * database this script just created — photographs the admin without putting any bypass in
 * the SERVER, which is the part that would matter. Anyone who can run this already has the
 * database file, and having the database file is the whole game.
 */
const owner = await createUser({
  username: 'demo',
  email: 'demo@example.com',
  // Throwaway, for a database that is deleted at the top of the next run.
  password: 'quartz-lantern-47-thicket',
})
setTotpSecret(owner.id, generateSecret())
const { token } = createSession(owner.id, { userAgent: 'showcase' })

console.log(`seeded ${DIR}: ${POSTS.length} posts, home=${MODE}, front kind=${KIND}`)
console.log(`QUIRE_SESSION=${token}`)
