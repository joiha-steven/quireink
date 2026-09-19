// THE RULES A STANDALONE LINK IS READ BY, and the one string on this surface a stranger writes.
//
// Everything here is pure: HTML in, HTML out, facts handed over. What a card SAYS is fetched
// elsewhere and stored in a column, which is exactly why the escaping cases below are the ones
// that matter — the title in that column was written by whoever runs the far server.
import { describe, expect, it } from 'bun:test'
import {
  bookmarkCard, fileCard, isRemote, ownPath, standalone, standaloneUrls,
  type BookmarkFacts,
} from '@/render/link-cards'
import { LINK_INK_CSS } from '@/pen/ink.css'
import { CARD_CSS } from '@/web/card.css'

const SITE = 'https://blog.example'
const facts = (over: Partial<BookmarkFacts> = {}): BookmarkFacts =>
  ({ title: 'A title', description: 'A description', site: 'elsewhere.test', image: '', ...over })

describe('a paragraph holding nothing but a link', () => {
  const found: string[] = []
  const scan = (html: string): string => {
    found.length = 0
    return standalone(html, (url, frag, whole) => {
      found.push(`${url}|${frag}`)
      return whole
    })
  }

  it('is found as a link, as a bare URL, and with a fragment held apart', () => {
    scan('<p><a href="https://a.test/x">https://a.test/x</a></p>')
    expect(found).toEqual(['https://a.test/x|'])
    scan('<p>https://b.test/y</p>')
    expect(found).toEqual(['https://b.test/y|'])
    // The fragment travels separately: the video pass reads `#wide` from it, and two links to
    // one page at different anchors are one page.
    scan('<p><a href="https://c.test/g#wide">x</a></p>')
    expect(found).toEqual(['https://c.test/g|wide'])
  })

  it('is NOT a paragraph with anything else in it', () => {
    // The counter-test, and the whole boundary of the feature: a citation in running prose is a
    // link in a sentence, and turning one of those into a card would rewrite people's writing.
    scan('<p>As in <a href="https://a.test/x">this piece</a>, the answer is no.</p>')
    expect(found).toEqual([])
    scan('<p><a href="https://a.test/x">one</a> <a href="https://b.test/y">two</a></p>')
    expect(found).toEqual([])
  })

  it('lists each URL once, however many times it appears', () => {
    const html = '<p>https://a.test/x</p><p>Something else.</p>'
      + '<p><a href="https://a.test/x">again</a></p><p>https://b.test/y</p>'
    expect(standaloneUrls(html)).toEqual(['https://a.test/x', 'https://b.test/y'])
  })
})

describe('whose address it is', () => {
  it('knows a remote URL from a path and from a scheme it will not dial', () => {
    expect(isRemote('https://a.test/x')).toBe(true)
    expect(isRemote('http://a.test/x')).toBe(true)
    expect(isRemote('/uploads/files/a.pdf')).toBe(false)
    expect(isRemote('mailto:someone@example.com')).toBe(false)
    expect(isRemote('javascript:alert(1)')).toBe(false)
  })

  it('recognises this blog written out in full as this blog', () => {
    // ⚠️ THE TWO SPELLINGS ARE ONE FILE. The Library's Copy URL key hands over the full address,
    // and an author typing by hand writes the short one. Without this the same upload is a
    // download card written one way and a fetch of this server's own page written the other.
    expect(ownPath('/uploads/files/a.pdf', SITE)).toBe('/uploads/files/a.pdf')
    expect(ownPath(`${SITE}/uploads/files/a.pdf`, SITE)).toBe('/uploads/files/a.pdf')
    expect(ownPath('https://elsewhere.test/a.pdf', SITE)).toBe('')
    // A different port or scheme is a different origin, and guessing otherwise is how a card
    // points at a machine the reader cannot reach.
    expect(ownPath('http://blog.example/x', SITE)).toBe('')
  })

  it('says nothing is its own when it does not know its own address', () => {
    expect(ownPath('https://blog.example/x', '')).toBe('')
  })
})

describe('what a card prints', () => {
  it('escapes every word that came from the far server', () => {
    // ⚠️ THE ONE CASE THAT MATTERS. The title, the description and the site name are chosen by
    // whoever runs the page being linked, travel through a database column, and land inside this
    // blog's own HTML. Nothing upstream escapes them: `link-meta.ts` says so, and this is why.
    const card = bookmarkCard('https://a.test/x', facts({
      title: '</span><script>alert(1)</script>',
      description: 'A & B "quoted"',
      site: '<img onerror=alert(1)>',
    }))
    expect(card).not.toContain('<script>')
    expect(card).not.toContain('<img onerror')
    expect(card).toContain('&lt;script&gt;')
    expect(card).toContain('A &amp; B')
  })

  it('does NOT escape the URL a second time', () => {
    // It was read back out of already-rendered HTML, so `&` is `&amp;` in it. Escaping again
    // publishes `&amp;amp;` in every link carrying a query string.
    const card = bookmarkCard('https://a.test/x?a=1&amp;b=2', facts())
    expect(card).toContain('href="https://a.test/x?a=1&amp;b=2"')
    expect(card).not.toContain('&amp;amp;')
  })

  it('is one link around everything, and the picture is decoration inside it', () => {
    // A card built as a box with a title link and a picture link is two keyboard stops and two
    // thumb targets pointing at one place, and a screen reader reads the destination twice.
    const card = bookmarkCard('https://a.test/x', facts({ image: '/uploads/cards/ab.webp' }))
    expect([...card.matchAll(/<a\b/g)].length).toBe(1)
    expect(card).toContain('alt=""')
    expect(card).toContain('loading="lazy"')
  })

  it('leaves out a picture, a description and a site nobody gave it', () => {
    const bare = bookmarkCard('https://a.test/x', facts({ description: '', site: '', image: '' }))
    expect(bare).not.toContain('<img')
    expect(bare).not.toContain('link-card-desc')
    expect(bare).not.toContain('link-card-site')
    // The counter-test: the title is never optional, because a card without one is a box with a
    // URL in it — which is worse than the link it replaced.
    expect(bare).toContain('A title')
  })

  it('gives a file card its kind and the size the caller formatted', () => {
    const card = fileCard('/uploads/files/a.pdf', { name: 'Báo cáo.pdf', size: 1234, kind: 'PDF' }, '1.2 KB')
    expect(card).toContain('>PDF<')
    expect(card).toContain('Báo cáo.pdf')
    expect(card).toContain('1.2 KB')
    // ⚠️ NO `download`. Whether a file opens or saves is `web/uploads.ts`'s answer in the
    // content-disposition it already sends; setting it here would overrule that from the other
    // end of the system, for one of the two ways to reach the same file.
    expect(card).not.toContain('download')
  })
})

describe('a card is not a prose link', () => {
  it('is named in the pen\u2019s exception list, beside the footnote marker', () => {
    // ⚠️ FOUND BY LOOKING, NOT BY A TEST, and it could not have been found any other way at the
    // time: `.prose a` draws the pen's hand-made underline and is (0,1,1), where `.link-card` is
    // (0,1,0) — so the hand drew its dashes straight across the card and through its title, and
    // added .42em under the bottom edge, while every assertion about the markup stayed green.
    //
    // The list is the RULE rather than a rendering, so that is what is asserted: a card belongs
    // in the same category as a footnote marker and a heading anchor — an anchor that is not a
    // few words inside a sentence.
    const rule = LINK_INK_CSS.slice(LINK_INK_CSS.indexOf('.prose a.fn-ref'))
    expect(rule).toContain('.prose a.link-card')
    expect(rule).toContain('.prose a.file-card')
    expect(rule.slice(0, rule.indexOf('}'))).toContain('background-image:none')
  })

  it('draws its own frame, which is what the pen would have painted over', () => {
    // The counter-test for the list above: the card HAS a border and a padding of its own, so
    // exempting it from the pen leaves something rather than nothing.
    expect(CARD_CSS).toContain('border:1px solid var(--c-rule)')
    expect(CARD_CSS).toContain('.link-card-text,.file-card-text')
  })
})
