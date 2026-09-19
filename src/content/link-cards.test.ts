// A LINK, FROM THE PARAGRAPH THAT MENTIONED IT TO THE CARD A READER SEES.
//
// `render/link-cards.test.ts` holds the drawing rules and takes no database; this one holds the
// three steps between them — noting a URL, reading the page once, and handing the facts to a
// render — and the ONE property the whole feature turns on: nothing appears until it is known,
// and the switch being off is the same thing as not knowing.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { getSettings, saveSettings } from '@/content/settings'
import { addFilesBatch } from '@/media/files'
import { renderPostContent } from '@/render/post-content'
import { standaloneUrls } from '@/render/link-cards'
import { cardFacts, noteLinks, pendingLinks } from '@/content/link-cards'
import { sweepLinkCards } from '@/server/link-fetch'
import { run } from '@/store/query'

const DIR = './.tmp/test-link-cards'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const SITE = 'https://blog.example'
const AT = 'https://elsewhere.test/a/piece'

const html = (title: string, extra = ''): string =>
  `<!doctype html><html><head><title>${title}</title>${extra}</head><body>x</body></html>`

const serves = (body: string) => async (): Promise<Response> =>
  new Response(body, { headers: { 'content-type': 'text/html' } })

beforeAll(async () => { await saveSettings({ siteUrl: SITE, title: 'A Blog' }) })
beforeEach(() => { run(`delete from link_cards`) })

const render = async (markdown: string): Promise<string> =>
  renderPostContent({ markdown, cards: await cardFacts(await getSettings()) })

describe('noting a link', () => {
  it('writes down a remote URL once, and skips what it would be silly to fetch', () => {
    noteLinks([
      AT, AT,
      '/uploads/files/a.pdf',            // this blog's own upload
      `${SITE}/an-essay`,                // this blog's own page, written out in full
      'mailto:someone@example.com',      // not a scheme to dial
    ], SITE)
    expect(pendingLinks(10)).toEqual([AT])
  })

  it('never overwrites a row that has already been read', async () => {
    noteLinks([AT], SITE)
    await sweepLinkCards(5, serves(html('The piece')))
    expect(pendingLinks(10)).toEqual([])
    // A second post mentioning the same URL must not put it back in the queue: one row per URL,
    // shared by every post that ever links there.
    noteLinks([AT], SITE)
    expect(pendingLinks(10)).toEqual([])
  })
})

describe('reading the page once', () => {
  it('makes a card, and the paragraph becomes one', async () => {
    await saveSettings({ features: { ...(await getSettings()).features, bookmarkCards: true } })
    // Before: nothing is known, so the paragraph is the plain link it always was.
    expect(await render(AT)).not.toContain('link-card')
    noteLinks([AT], SITE)
    expect(await sweepLinkCards(5, serves(html('The piece',
      '<meta property="og:description" content="What it is about.">')))).toBe(1)
    const after = await render(AT)
    expect(after).toContain('class="link-card"')
    expect(after).toContain('The piece')
    expect(after).toContain('What it is about.')
    // No og:image in that page, so no picture and no fetch was attempted for one.
    expect(after).not.toContain('<img')
  })

  it('remembers a page that said nothing, so it is never asked twice', async () => {
    noteLinks([AT], SITE)
    // A document with no title at all: tried, and yielded nothing worth a card.
    expect(await sweepLinkCards(5, serves('<!doctype html><html><body>x</body></html>'))).toBe(0)
    expect(pendingLinks(10)).toEqual([])
    // ⚠️ AND IT RENDERS EXACTLY AS AN UNREAD ROW DOES. One fallback, not two: the link stays a
    // link whether nobody has looked yet, the look found nothing, or the feature is switched off.
    expect(await render(AT)).not.toContain('link-card')
  })

  it('keeps a card whose picture could not be brought home', async () => {
    // The og:image points at an address the SSRF guard refuses outright, so no request leaves
    // this machine. A card with words and no picture is a good card; a broken image is not.
    noteLinks([AT], SITE)
    await sweepLinkCards(5, serves(html('The piece',
      '<meta property="og:image" content="http://127.0.0.1:9/og.png">')))
    const after = await render(AT)
    expect(after).toContain('The piece')
    expect(after).not.toContain('<img')
  })
})

describe('the switches', () => {
  it('stops the tick reaching out at all while the bookmark card is off', async () => {
    // ⚠️ THE POINT OF THAT SWITCH IS THE OUTBOUND REQUEST, not the drawing. A blog with it off
    // that went on reading other people's pages on a timer would be doing the one thing the
    // owner declined, while showing nothing for it.
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, bookmarkCards: false } })
    noteLinks([AT], SITE)
    let asked = 0
    expect(await sweepLinkCards(5, async () => { asked += 1; return new Response('') })).toBe(0)
    expect(asked).toBe(0)
    // ⚠️ AND THE ROW IS STILL PENDING. Noting stays unconditional so a blog that switches the
    // feature ON later fills in its backlog without anybody re-saving a post.
    expect(pendingLinks(10)).toEqual([AT])
    await saveSettings({ features: { ...s.features, bookmarkCards: true } })
    expect(await sweepLinkCards(5, serves(html('The piece')))).toBe(1)
  })

  it('hands over nothing at all while they are off', async () => {
    noteLinks([AT], SITE)
    await sweepLinkCards(5, serves(html('The piece')))
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, bookmarkCards: false, fileCards: false } })
    const off = await cardFacts(await getSettings())
    expect(off.bookmarks.size).toBe(0)
    expect(off.files.size).toBe(0)
    expect(await render(AT)).not.toContain('link-card')
    // The counter-test: the row is still there, and turning the switch back on shows it without
    // reading the page again.
    await saveSettings({ features: { ...s.features, bookmarkCards: true, fileCards: true } })
    expect(await render(AT)).toContain('link-card')
    expect(pendingLinks(10)).toEqual([])
  })
})

describe('a link to one of this blog’s own files', () => {
  it('becomes a download card, by either spelling of the address', async () => {
    const [file] = await addFilesBatch([{
      filename: 'Báo cáo.pdf', body: new TextEncoder().encode('%PDF-1.4 x').buffer as ArrayBuffer,
      contentType: 'application/pdf',
    }])
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, fileCards: true } })
    // Three spellings, one card: the bare path, the full address, and the markdown link an
    // author writing a download actually types.
    for (const written of [file!.url, `${SITE}${file!.url}`, `[The sheet](${file!.url})`]) {
      const out = await render(written)
      expect(out).toContain('class="file-card"')
      expect(out).toContain('>PDF<')
      expect(out).toContain('Báo cáo.pdf')
    }
  })

  it('is a real link again the moment the card is switched off', async () => {
    // ⚠️ THE PROMISE THE SWITCH MAKES. Turning a card off has to leave what the author wrote,
    // and for the markdown spelling that is a link. This went the other way once: a stored body
    // kept `](files/…)` and `expandBlob` only put `media/` back, so switching the card off left
    // a RELATIVE href resolved against the post's own address (`media/blob.ts` carries it).
    const [file] = await addFilesBatch([{
      filename: 'notes.pdf', body: new TextEncoder().encode('%PDF-1.4 y').buffer as ArrayBuffer,
      contentType: 'application/pdf',
    }])
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, fileCards: false } })
    const out = await render(`[The notes](${file!.url})`)
    expect(out).not.toContain('file-card')
    expect(out).toContain(`href="${file!.url}"`)
    await saveSettings({ features: { ...s.features, fileCards: true } })
  })

  it('leaves a link to another POST alone, because a card is for leaving', async () => {
    const out = await render(`${SITE}/an-essay`)
    expect(out).not.toContain('file-card')
    expect(out).not.toContain('link-card')
  })
})

describe('a video URL is still a player', () => {
  it('wins over a bookmark card, whatever is known about it', async () => {
    // ⚠️ THE ORDER IS THE RULE. A YouTube URL has been an embed since the port; reaching it with
    // a preview card first would replace a player with a thumbnail on every existing blog that
    // had one, which is not a feature anybody switched on.
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    noteLinks([url], SITE)
    await sweepLinkCards(5, serves(html('A video')))
    const out = await render(url)
    expect(out).toContain('video-embed')
    expect(out).not.toContain('link-card')
  })
})

describe('what the render notices', () => {
  it('reports back only the links that did NOT become cards', async () => {
    noteLinks([AT], SITE)
    await sweepLinkCards(5, serves(html('The piece')))
    const body = await render(`${AT}\n\nSome words.\n\nhttps://other.test/thing`)
    // The one that became a card is gone from the finished HTML; the one nothing is known about
    // is still a plain link, which is what makes this list self-selecting.
    expect(standaloneUrls(body)).toEqual(['https://other.test/thing'])
  })
})
