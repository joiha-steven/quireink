// The library, as the server sends it (ADR 0054).
//
// Four things are guarded here, and the first is the one that had no test at all before:
//
//   1. ALL THREE KINDS ARRIVE DRAWN. The React face fetched `/api/files` the first time anybody
//      clicked Videos or Files, so two of the three tabs were a spinner on first open.
//   2. The kind is in the address, and an address naming a kind that does not exist opens
//      Images rather than an empty sheet.
//   3. Nothing on the screen is a form and every button says `type="button"` — two of them
//      delete in batches, and one spends money.
//   4. Nothing a filename carries becomes markup.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { run } from '@/store/query'
import { getSettings } from '@/content/settings'
import { mediaScreen } from './media'
import { MEDIA_PAGE } from '@/web/admin/views-media'

const DIR = './.tmp/test-screen-media'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => {
  db().run(`delete from media`)
  db().run(`delete from files`)
})

/** A row, written straight in: `addMediaBatch` would encode a thumbnail and ask a model to
 *  describe the picture, neither of which this file is about. */
function picture(name: string, size = 1024, alt?: string): void {
  run(
    `insert into media (path, filename, size, uploaded_at, width, height, thumb, variants, alt)
     values (?, ?, ?, ?, 1400, 900, ?, 2, ?)`,
    `media/${name}`, name, size, Date.now(), `media/${name}-thumb.webp`, alt ?? null,
  )
}

function attachment(name: string, type: string): void {
  run(
    `insert into files (url, filename, size, content_type, uploaded_at) values (?, ?, 2048, ?, ?)`,
    `files/${name}`, name, type, Date.now(),
  )
}

const draw = async (query = ''): Promise<string> =>
  mediaScreen(await getSettings(), new URLSearchParams(query))

describe('every kind arrives drawn', () => {
  it('draws the pictures, the players and the rows in one response', async () => {
    picture('plate-14.png')
    attachment('reading.mp4', 'video/mp4')
    attachment('press-kit.zip', 'application/zip')
    const html = await draw()
    expect(html).toContain('data-media="/uploads/media/plate-14.png"')
    expect(html).toContain('<video src="/uploads/files/reading.mp4"')
    expect(html).toContain('press-kit.zip')
    // Two of the three are hidden rather than absent: switching kinds fetches nothing.
    expect(html).toContain('data-media-panel="videos" class="px-4 pt-4 pb-2" hidden')
    expect(html).toContain('data-media-panel="files" class="px-4 pt-4 pb-2" hidden')
  })

  it('opens on the kind in the address', async () => {
    attachment('reading.mp4', 'video/mp4')
    const html = await draw('tab=videos')
    expect(html).toContain('data-media-tab="videos"')
    expect(html).toContain('data-media-panel="images" class="px-4 pt-4 pb-2" hidden')
    expect(html).toContain('data-media-panel="videos" class="px-4 pt-4 pb-2">')
  })

  it('opens on the pictures for a kind that does not exist', async () => {
    expect(await draw('tab=sculpture')).toContain('data-media-tab="images"')
  })

  it('sorts a video onto the videos tab and everything else onto files', async () => {
    attachment('reading.mp4', 'video/mp4')
    attachment('notes.pdf', 'application/pdf')
    const html = await draw()
    const videos = html.slice(html.indexOf('data-media-panel="videos"'), html.indexOf('data-media-panel="files"'))
    expect(videos).toContain('reading.mp4')
    expect(videos).not.toContain('notes.pdf')
  })

  it('says so, in the right words, when a kind is empty', async () => {
    const t = (await getSettings()).language
    expect(t).toBeTruthy()
    const html = await draw()
    // Both empty states are in the markup and an attribute picks: "no pictures at all" and
    // "nothing matched what you typed" are different sentences.
    expect(html).toContain('data-media-empty>')
    expect(html).toContain('data-media-none hidden')
    expect(html).toContain('data-media-grid hidden')
  })
})

describe('nothing on this screen can submit anything', () => {
  it('has no form, and every button is typed', async () => {
    picture('plate-14.png')
    attachment('reading.mp4', 'video/mp4')
    attachment('notes.pdf', 'application/pdf')
    const html = await draw()
    expect(html).not.toContain('<form')
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.filter((b) => !b.includes('type="button"'))).toEqual([])
  })

  it('keeps the file inputs out of anything that could post', async () => {
    const html = await draw()
    expect(html).not.toContain('<form')
    expect(html).toContain('type="file"')
  })
})

describe('a filename is a stranger\'s string', () => {
  it('escapes one that is trying to be markup, everywhere it is printed', async () => {
    const bomb = '<img src=x onerror="alert(1)">.png'
    picture(bomb)
    attachment(bomb, 'application/zip')
    const html = await draw()
    expect(html).not.toContain(bomb)
    expect(html).not.toContain('<img src=x')
  })

  it('escapes a description, which a model wrote and nobody read', async () => {
    picture('plate-14.png', 1024, '"><script>alert(1)</script>')
    const html = await draw()
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

describe('the count is over the whole library, not the view', () => {
  it('adds up every picture and its bytes', async () => {
    picture('one.png', 1000)
    picture('two.png', 2000)
    const html = await draw()
    expect(html).toContain('data-media-count>2<')
    expect(html).toContain('data-media-bytes>2.9 KB<')
  })

  it('hides the tools when there is nothing to search through', async () => {
    expect(await draw()).toContain('data-media-tools hidden')
  })
})

/**
 * ⚠️ ONE PAGE OF TILES, and the count above them still means the library.
 *
 * The screen turns every row into a tile with a picture in it, so a library of several
 * thousand was a page the browser thought about for seconds. It is paged at
 * `MEDIA_PAGE` now — but a pager is two promises, and both are easy to get wrong: the grid
 * holds ONE page, and the figure above it holds ALL of them. A count that followed the grid
 * would tell an owner with four thousand pictures that they have two hundred.
 */
describe('the library is paged', () => {
  const many = (n: number) => { for (let i = 0; i < n; i++) picture(`p${String(i).padStart(4, '0')}.jpg`) }
  const tiles = (html: string) => (html.match(/data-media="/g) ?? []).length

  it('draws one page of tiles and says how many there are altogether', async () => {
    many(MEDIA_PAGE + 25)
    const html = await mediaScreen(await getSettings(), new URLSearchParams())
    expect(tiles(html)).toBe(MEDIA_PAGE)
    // The count line, which reads the whole table rather than the grid under it.
    expect(html).toContain(`>${MEDIA_PAGE + 25}</span>`)
  })

  it('turns to the rest on page two, and offers no pager when there is one page', async () => {
    many(MEDIA_PAGE + 25)
    const two = await mediaScreen(await getSettings(), new URLSearchParams('tab=images&page=2'))
    expect(tiles(two)).toBe(25)
    db().run(`delete from media`)
    picture('alone.jpg')
    const one = await mediaScreen(await getSettings(), new URLSearchParams())
    expect(one).not.toContain('data-pager')
  })

  /**
   * ⚠️ THE LINK CARRIES ITS OWN TAB. Switching tabs here is an attribute rather than a
   * navigation, so the address can say `?tab=files` while somebody is looking at pictures — a
   * pager that wrote only `page=` would turn the page of the wrong kind.
   */
  it('names the kind in every pager link', async () => {
    many(MEDIA_PAGE + 1)
    const html = await mediaScreen(await getSettings(), new URLSearchParams())
    // `&amp;` because this is an attribute in HTML, not a URL in a string.
    expect(html).toContain('/admin/media?tab=images&amp;page=2')
    expect(html).not.toContain('href="/admin/media?page=2"')
  })

  it('pages videos and files by the same measure', async () => {
    for (let i = 0; i < MEDIA_PAGE + 3; i++) attachment(`clip${i}.mp4`, 'video/mp4')
    const html = await mediaScreen(await getSettings(), new URLSearchParams('tab=videos'))
    expect((html.match(/<video /g) ?? []).length).toBe(MEDIA_PAGE)
    expect(html).toContain('/admin/media?tab=videos&amp;page=2')
  })
})
