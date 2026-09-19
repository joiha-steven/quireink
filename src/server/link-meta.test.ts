// WHAT A PAGE SAYS ABOUT ITSELF, read out of somebody else's HTML.
//
// The parsing half takes no network and is tested directly; the fetching half is tested with a
// fetcher handed in, which is the shape `webmention.ts` already uses for the same reason — a
// test suite that reaches the internet is a test suite that fails on an aeroplane.
import { describe, expect, it } from 'bun:test'
import { metaFromHtml, readPageMeta } from '@/server/link-meta'

const AT = 'https://elsewhere.test/a/piece'

const page = (head: string): string => `<!doctype html><html><head>${head}</head><body>x</body></html>`

const reply = (body: string, type = 'text/html; charset=utf-8', status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': type } })

describe('reading a page', () => {
  it('prefers what the page says about itself over its window title', () => {
    const meta = metaFromHtml(page(
      `<title>Site name — A piece</title>`
      + `<meta property="og:title" content="A piece">`
      + `<meta property="og:description" content="What it is about.">`
      + `<meta property="og:site_name" content="Site name">`,
    ), AT)
    expect(meta).toMatchObject({
      title: 'A piece', description: 'What it is about.', site: 'Site name',
    })
  })

  it('falls back to the title tag, and to the host without www', () => {
    const meta = metaFromHtml(page('<title>Just a title</title>'), 'https://www.elsewhere.test/x')
    expect(meta.title).toBe('Just a title')
    // A site that names itself says something a domain cannot; the domain is the fallback.
    expect(meta.site).toBe('elsewhere.test')
    expect(meta.description).toBe('')
  })

  it('reads `name` as well as `property`, because real pages spell it both ways', () => {
    const meta = metaFromHtml(page(
      `<meta name="og:title" content="Named">` + `<meta name="description" content="Plain">`,
    ), AT)
    expect(meta.title).toBe('Named')
    expect(meta.description).toBe('Plain')
  })

  it('takes the FIRST of a repeated tag', () => {
    // A page that names og:title twice meant the first; the rest are template leftovers, and
    // taking the last is how a card ends up titled after the site's footer.
    const meta = metaFromHtml(page(
      `<meta property="og:title" content="The piece">`
      + `<meta property="og:title" content="Site name">`,
    ), AT)
    expect(meta.title).toBe('The piece')
  })

  it('ignores a title inside an svg, which is that shape’s name and not the page’s', () => {
    const html = '<!doctype html><html><head></head><body>'
      + '<svg viewBox="0 0 8 8"><title>Logo</title></svg><p>x</p></body></html>'
    expect(metaFromHtml(html, AT).title).toBe('')
    // The counter-test: a real document title beside the same icon is still read.
    const withBoth = '<!doctype html><html><head><title>The piece</title></head><body>'
      + '<svg><title>Logo</title></svg></body></html>'
    expect(metaFromHtml(withBoth, AT).title).toBe('The piece')
  })

  it('makes a picture absolute against the page, and refuses a scheme it will not dial', () => {
    expect(metaFromHtml(page('<title>t</title><meta property="og:image" content="/og.png">'), AT).image)
      .toBe('https://elsewhere.test/og.png')
    expect(metaFromHtml(page('<title>t</title><meta property="og:image" content="https://cdn.test/a.jpg">'), AT).image)
      .toBe('https://cdn.test/a.jpg')
    // ⚠️ THE SCHEME IS THE GUARD, not the shape. `http(s)` or nothing: a `javascript:` or
    // `data:` value would be handed to `fetchImageCapped` and then written into an `src`.
    for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA']) {
      expect(metaFromHtml(page(`<title>t</title><meta property="og:image" content="${bad}">`), AT).image).toBe('')
    }
    // A value that is neither a URL nor a path resolves against the page's own host, which is
    // not a refusal and does not need to be: the fetch that follows finds nothing there, and a
    // picture that cannot be brought home is a card with words and no picture.
    expect(metaFromHtml(page('<title>t</title><meta property="og:image" content="://nonsense">'), AT).image)
      .toBe('https://elsewhere.test/a/://nonsense')
    // Whitespace is nothing at all.
    expect(metaFromHtml(page('<title>t</title><meta property="og:image" content="   ">'), AT).image).toBe('')
  })

  it('collapses the whitespace a template left in, and decodes the entities', () => {
    const meta = metaFromHtml(page('<title>\n  A &amp; B\n  </title>'), AT)
    expect(meta.title).toBe('A & B')
  })

  it('caps a title somebody made very long', () => {
    const meta = metaFromHtml(page(`<title>${'a'.repeat(400)}</title>`), AT)
    expect(meta.title.length).toBe(200)
  })
})

describe('fetching a page', () => {
  const ok = async (body: string, type?: string, status?: number): Promise<Response> =>
    reply(body, type, status)

  it('answers with what it found', async () => {
    const meta = await readPageMeta(AT, async () => await ok(page('<title>The piece</title>')))
    expect(meta?.title).toBe('The piece')
  })

  it('answers null for every kind of no, because a reader sees the same thing for all of them', async () => {
    // A refusal, a body that is not a page, and a page with nothing to put on a card. The caller
    // writes one row for all three and the paragraph stays the plain link it already was.
    expect(await readPageMeta(AT, async () => await ok('nope', 'text/html', 404))).toBeNull()
    expect(await readPageMeta(AT, async () => await ok('%PDF-1.4', 'application/pdf'))).toBeNull()
    expect(await readPageMeta(AT, async () => await ok(page('<meta name="x" content="y">')))).toBeNull()
    expect(await readPageMeta(AT, () => { throw new Error('refused') })).toBeNull()
  })

  it('accepts xhtml, which is still a page', async () => {
    const meta = await readPageMeta(AT, async () => await ok(page('<title>t</title>'), 'application/xhtml+xml'))
    expect(meta?.title).toBe('t')
  })
})
