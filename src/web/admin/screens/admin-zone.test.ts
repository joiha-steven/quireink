// EVERY ADMIN SCREEN THAT PRINTS AN INSTANT PRINTS IT ON THE SITE'S CLOCK (`settings.timezone`).
//
// These screens printed through the server PROCESS's zone, so a host on one zone under a blog set
// to another showed the owner a time that matched neither the header nor the public site. The
// process runs on Los Angeles and the site on Hanoi, and each fixed screen is read for the
// Hanoi stamp. The same ordering as `content-pane-zone.test.ts`: the zone is set before any test
// reads a date, the first test proves it took, and it is put back after.
// Captured by NAME before the test changes it: when TZ was unset, the zone the process was
// really running on. `delete process.env.TZ` would freeze the zone for every later file in the run.
const WAS = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone
process.env.TZ = 'America/Los_Angeles'

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { run } from '@/store/query'
import { savePost } from '@/content/posts'
import { deletePost } from '@/content/posts-trash'
import { addComment, softDeleteComment } from '@/comments/comments'
import { logActivity } from '@/server/activity'
import { DEFAULT_SETTINGS } from '@/content/settings'
import type { SiteSettings } from '@/types'
import { logScreen } from '@/web/admin/screens/log'
import { trashScreen } from '@/web/admin/screens/trash'
import { commentsScreen } from '@/web/admin/screens/comments'
import { dashboardScreen } from '@/web/admin/screens/dashboard'
import { peoplePanel } from '@/web/admin/screens/newsletter-people'
import { filesPanel } from '@/web/admin/screens/media-files'
import { formatDateShort } from '@/admin-shared/when'
import { tileTitle } from '@/admin-shared/media-marks'
import { recentPieces } from '@/web/admin/screens/recent-pieces'
import { adminT } from '@/i18n/admin-i18n'
import { formatDateTimeShort } from '@/admin-shared/when'

const DIR = './.tmp/test-admin-zone'
const SITE = 'Asia/Ho_Chi_Minh'
// 02:00 UTC is 09:00 in Hanoi and 19:00 THE DAY BEFORE in Los Angeles: the day differs too.
const AT = Date.UTC(2026, 9, 19, 2, 0, 0)
const HANOI = formatDateTimeShort('2026-10-19T09:00', 'en')
const LOS_ANGELES = formatDateTimeShort('2026-10-18T19:00', 'en')

const settings: SiteSettings = {
  ...DEFAULT_SETTINGS, timezone: SITE, features: { ...DEFAULT_SETTINGS.features, activityLog: true },
}

beforeAll(async () => {
  freshDatabase(DIR)
  await savePost({ title: 'Gone', slug: 'gone', status: 'published', content: 'Body.', date: '2026-01-01T00:00:00.000Z' })
  await deletePost('gone')
  run(`update posts set deleted_at = ? where slug = 'gone'`, AT)
  await savePost({ title: 'Draft', slug: 'draft', status: 'draft', content: 'Body.', date: '2026-01-01T00:00:00.000Z' })
  run(`update posts set updated_at = ? where slug = 'draft'`, AT)
  await savePost({ title: 'Talked', slug: 'talked', status: 'published', content: 'Body.', date: '2026-01-01T00:00:00.000Z' })
  const c = await addComment({ postSlug: 'talked', parentId: null, name: 'Reader', email: 'r@example.com', provider: 'manual', content: 'Hello.' })
  run(`update comments set created_at = ?`, AT)
  const gone = await addComment({ postSlug: 'talked', parentId: null, name: 'Binned', email: 'b@example.com', provider: 'manual', content: 'Bye.' })
  await softDeleteComment(gone.id)
  run(`update comments set deleted_at = ? where id = ?`, AT, gone.id)
  expect(c.id).toBeGreaterThan(0)
  await logActivity('post.delete', 'gone')
  run(`update activity_log set at = ?`, AT)
})
afterAll(() => {
  dropDatabase(DIR)
  process.env.TZ = WAS
})

describe('admin screens on a site in another zone than the server', () => {
  it('runs this process on a zone that is not the site’s', () => {
    expect(new Date(AT).getHours()).toBe(19)
    expect(HANOI).not.toBe(LOS_ANGELES)
  })

  it('the log stamps a row with the site’s clock', async () => {
    const html = await logScreen(settings)
    expect(html).toContain(HANOI)
    expect(html).not.toContain(LOS_ANGELES)
  })

  it('the trash dates a deletion with the site’s clock', async () => {
    const html = await trashScreen(settings, new URLSearchParams())
    expect(html).toContain(HANOI)
    expect(html).not.toContain(LOS_ANGELES)
  })

  it('the comments screen dates a comment with the site’s clock', async () => {
    const html = await commentsScreen(settings)
    expect(html).toContain(HANOI)
    expect(html).not.toContain(LOS_ANGELES)
  })

  it('the dashboard dates the activity feed and the unfinished chips with the site’s clock', async () => {
    const html = await dashboardScreen(settings)
    expect(html).toContain(HANOI)
    expect(html).not.toContain(LOS_ANGELES)
  })

  it('the recent pieces list dates a piece with the site’s clock', () => {
    const html = recentPieces([{ title: 'Draft', touched: AT, editHref: '/admin/editor/draft' } as never], adminT('en'), 'en', SITE)
    expect(html).toContain(HANOI)
    expect(html).not.toContain(LOS_ANGELES)
  })

  it('the subscriber list files a sign-up under the site’s day, not UTC’s', () => {
    // 20:00 UTC on the 18th is 03:00 on the 19th in Hanoi.
    const sub = { id: 1, email: 'a@example.com', status: 'confirmed', createdAt: '2026-10-18T20:00:00.000Z' }
    const html = peoplePanel(adminT('en'), 'en', { subscribers: [sub], counts: { confirmed: 1, pending: 0, unsubscribed: 0 } } as never, true, '', SITE)
    expect(html).toContain(formatDateShort('2026-10-19', 'en'))
    expect(html).toContain('data-joined="2026-10-19"')
  })

  it('the media library dates an upload by the site’s day, not UTC’s', () => {
    const file = { url: '/uploads/a.pdf', filename: 'a.pdf', size: 10, uploadedAt: '2026-10-18T20:00:00.000Z' }
    const html = filesPanel(adminT('en'), 'en', SITE, [file] as never, [], true)
    expect(html).toContain('October 19, 2026')
  })
})

describe('a media tile, server-drawn or island-added', () => {
  it('names the upload day on the same zone, whatever the process runs on', () => {
    const m = { filename: 'a.png', size: 10, uploadedAt: '2026-10-18T20:00:00.000Z' }
    // `pageZone()` is what the island passes: the same string the server was given.
    expect(tileTitle(m as never, 'en', SITE)).toContain('October 19, 2026')
    expect(tileTitle(m as never, 'en', 'America/Los_Angeles')).toContain('October 18, 2026')
  })
})
