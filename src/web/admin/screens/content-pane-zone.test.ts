// THE WRITE LIST AND THE SHEET'S HEADER PRINT ONE CLOCK, the site's.
//
// From 1640px the list and the editor sit side by side. The list printed its instants in the
// SERVER PROCESS's zone and the header in the site's (`settings.timezone`), so a host on one zone
// under a blog set to another showed two different times for the same scheduled post. This draws
// the real editor screen — list and sheet in one response — with the process on Los Angeles and
// the site on Hanoi, and reads both.
//
// ⚠️ THE ZONE IS SET BEFORE ANY TEST READS A DATE, and the first test proves it took: a process
// that ignored it would run on the machine's zone and pass for the wrong reason wherever that
// happens to be the site's. And it is PUT BACK after: every test file shares this process.
const WAS = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
process.env.TZ = 'America/Los_Angeles'

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { saveNote } from '@/content/notes'
import { getSettings, saveSettings } from '@/content/settings'
import { editorFrame } from '@/web/admin/screens/content'
import { formatDateTimeShort } from '@/admin-shared/when'

const DIR = './.tmp/test-content-pane-zone'
const SITE = 'Asia/Ho_Chi_Minh'
// 02:00 UTC is 09:00 in Hanoi and 19:00 THE DAY BEFORE in Los Angeles: the day differs too.
const OUT = '2099-10-19T02:00:00.000Z'
const HANOI = formatDateTimeShort('2099-10-19T09:00', 'en')

beforeAll(async () => {
  freshDatabase(DIR)
  await saveSettings({ timezone: SITE })
  await savePost({ title: 'Queued', slug: 'queued', status: 'published', content: 'Body.', date: OUT })
  await savePost({ title: 'Unsent', slug: 'unsent', status: 'draft', content: 'Body.', date: OUT })
  await saveNote({ title: 'Later', slug: 'later', status: 'published', content: 'Body.', date: OUT })
})
afterAll(() => {
  dropDatabase(DIR)
  process.env.TZ = WAS // by NAME: `delete` leaves Bun on Los Angeles for every file after this
})

/**
 * The editor screen for one piece: the list row's date line and the header's meta line. Read
 * from the markup as sent — this side has no DOM, and neither does the server that draws it.
 */
async function both(path: string, key: string): Promise<{ list: string; header: string }> {
  const html = await editorFrame(await getSettings(), path)
  const at = html.indexOf(`data-piece="${key}"`)
  const row = at < 0 ? '' : html.slice(at, html.indexOf('</a>', at))
  return {
    list: /class="mt-1 block[^"]*">([^<]*)/.exec(row)?.[1] ?? '',
    header: /<p data-sheet-meta[^>]*>([^<]*)</.exec(html)?.[1] ?? '',
  }
}

describe('the list and the header, on a site in another zone than the server', () => {
  it('runs this process on a zone that is not the site’s', () => {
    expect(new Date(OUT).getHours()).toBe(19)
    expect(new Date(OUT).getDate()).toBe(18)
  })

  it('dates a scheduled post by the site’s clock in both places', async () => {
    const { list, header } = await both('/admin/editor/queued', 'post:queued')
    expect(list).toContain(HANOI)
    expect(header).toContain(HANOI)
    expect(list).toContain('09:00')
  })

  it('dates a scheduled NOTE by its publish date in the list, as the header does', async () => {
    const { list, header } = await both('/admin/note-editor/later', 'note:later')
    expect(header).toContain(HANOI)
    expect(list).toContain(HANOI)
  })

  it('prints a draft’s last touch the same in both places', async () => {
    const { list, header } = await both('/admin/editor/unsent', 'post:unsent')
    const at = / · (\d[^·]*\d{2}:\d{2})/.exec(header)?.[1]
    expect(at).toBeTruthy()
    expect(list).toContain(at!)
  })
})
