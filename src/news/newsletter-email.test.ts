import { describe, it, expect } from '@/test/vitest'
import en from '@/locales/en'
import { THEME_PRESETS } from '@/content/themes'
import { confirmEmail, broadcastEmail, replyEmail, type EmailBrand } from '@/news/newsletter-email'

const BRAND: EmailBrand = { title: 'My Blog', base: 'https://blog.test', theme: THEME_PRESETS[0].theme.light }
const brand = (over: Partial<EmailBrand> = {}): EmailBrand => ({ ...BRAND, ...over })

describe('confirmEmail', () => {
  it('links the opt-in URL and escapes the site title', () => {
    const { subject, html } = confirmEmail(
      en,
      brand({ title: 'My <b>Blog</b>' }),
      'https://blog.test/api/newsletter/confirm?token=TOK',
    )
    expect(subject).toContain('My <b>Blog</b>')
    expect(html).toContain('https://blog.test/api/newsletter/confirm?token=TOK')
    expect(html).toContain('My &lt;b&gt;Blog&lt;/b&gt;') // escaped in the body, not raw
    expect(html).not.toContain('<b>Blog</b>')
  })
})

describe('masthead', () => {
  // Images are blocked by default in many inboxes, so the logo must carry the site
  // title as alt text — otherwise the letterhead collapses to nothing.
  it('uses the logo when there is one, with the site title as alt', () => {
    const html = confirmEmail(en, brand({ logo: { url: 'https://blog.test/uploads/logo.png', width: 180, height: 40 } }), 'https://x.test').html
    expect(html).toContain('src="https://blog.test/uploads/logo.png"')
    expect(html).toContain('alt="My Blog"')
    expect(html).toContain('width="180"')
    expect(html).toContain('height="40"')
  })

  it('falls back to the site name as text with no logo', () => {
    const html = confirmEmail(en, brand({ logo: null }), 'https://x.test').html
    expect(html).not.toContain('<img src="https://blog.test/uploads')
    expect(html).toContain('My Blog')
  })

  it('omits the height attribute when the display height is unknown', () => {
    const html = confirmEmail(en, brand({ logo: { url: 'https://blog.test/l.png', width: 180 } }), 'https://x.test').html
    expect(html).toContain('width="180"')
    expect(html).not.toContain('height="0"')
  })
})

describe('broadcastEmail', () => {
  const post = { slug: 'hello', title: 'A <b>Title</b>', excerpt: 'teaser' }

  it('links the post + a per-recipient unsubscribe, escapes the title', () => {
    const { subject, html } = broadcastEmail(en, BRAND, [post], 'TOK123')
    expect(subject).toBe('A <b>Title</b> — My Blog')
    expect(html).toContain('https://blog.test/hello')
    expect(html).toContain('/api/newsletter/unsubscribe?token=TOK123')
    expect(html).toContain('A &lt;b&gt;Title&lt;/b&gt;') // escaped, not raw
    expect(html).toContain('teaser')
  })

  it('omits the excerpt block when there is none', () => {
    const { html } = broadcastEmail(en, BRAND, [{ slug: 's', title: 'T', excerpt: null }], 'k')
    expect(html).not.toContain('<p></p>')
  })

  // The pixel is what makes the open rate real; the preview + test send must NOT carry
  // one, or reviewing an email would count as a subscriber opening it.
  it('embeds the open pixel only when given an open token', () => {
    const withPixel = broadcastEmail(en, BRAND, [post], 'k', 'OPEN1').html
    expect(withPixel).toContain('https://blog.test/api/newsletter/open?t=OPEN1')
    expect(withPixel).toContain('width="1" height="1"')

    const noPixel = broadcastEmail(en, BRAND, [post], 'k').html
    expect(noPixel).not.toContain('/api/newsletter/open')
  })

  // Several posts are ONE digest, not one email each — the subject has to say so, and
  // every post must actually be in the body.
  it('builds a digest from several posts under one subject', () => {
    const posts = [
      { slug: 'one', title: 'First', excerpt: 'a' },
      { slug: 'two', title: 'Second', excerpt: 'b' },
      { slug: 'three', title: 'Third', excerpt: 'c' },
    ]
    const { subject, html } = broadcastEmail(en, BRAND, posts, 'k')
    expect(subject).toBe('3 new posts — My Blog')
    for (const p of posts) expect(html).toContain(`https://blog.test/${p.slug}`)
    expect(html).toContain('First')
    expect(html).toContain('Third')
  })

  // Colours come from the owner's palette so the mail matches their blog; a hardcoded
  // palette would silently ignore a theme change.
  it('paints with the palette it is handed', () => {
    const custom = { ...THEME_PRESETS[0].theme.light, bg: '#123456', heading: '#abcdef' }
    const { html } = broadcastEmail(en, brand({ theme: custom }), [post], 'k')
    expect(html).toContain('#123456')
    expect(html).toContain('#abcdef')
  })

  // Cover refs are stored store-relative; an inbox has no origin to resolve them against.
  it('makes a store-relative cover image absolute', () => {
    const { html } = broadcastEmail(en, BRAND, [{ ...post, coverImage: '/uploads/cover.webp' }], 'k')
    expect(html).toContain('https://blog.test/uploads/cover.webp')
  })
})

describe('replyEmail', () => {
  it('interpolates name + title and points at the comments anchor', () => {
    const { subject, html } = replyEmail(en, BRAND, 'my-post', 'The Post', 'Alice', '<p>hi</p>')
    expect(subject).toContain('My Blog')
    expect(html).toContain('Alice')
    expect(html).toContain('The Post')
    expect(html).toContain('https://blog.test/my-post#comments')
    expect(html).toContain('<p>hi</p>')
  })
})
