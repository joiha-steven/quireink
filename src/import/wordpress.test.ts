import { describe, it, expect } from 'bun:test'
import { parseWxr } from '@/import/wordpress'

const NOW = '2026-07-31T00:00:00.000Z'

/** Minimal WXR envelope — the parser only ever looks at channel > item. */
function wxr(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>${items}</channel></rss>`
}

function item(fields: {
  type?: string
  status?: string
  title?: string
  name?: string
  dateGmt?: string
  date?: string
  content?: string
  terms?: string
  link?: string
}): string {
  const f = fields
  return `<item>
    <title><![CDATA[${f.title ?? 'A title'}]]></title>
    ${f.link ? `<link>${f.link}</link>` : ''}
    <content:encoded><![CDATA[${f.content ?? '<p>Body</p>'}]]></content:encoded>
    <wp:post_name><![CDATA[${f.name ?? ''}]]></wp:post_name>
    <wp:post_type>${f.type ?? 'post'}</wp:post_type>
    <wp:status>${f.status ?? 'publish'}</wp:status>
    <wp:post_date_gmt>${f.dateGmt ?? '2025-03-04 09:30:00'}</wp:post_date_gmt>
    <wp:post_date>${f.date ?? '2025-03-04 16:30:00'}</wp:post_date>
    ${f.terms ?? ''}
  </item>`
}

describe('parseWxr selection', () => {
  it('keeps posts and pages, skips attachments and theme records', () => {
    const xml = wxr(
      item({ name: 'a-post' }) +
        item({ type: 'page', name: 'a-page' }) +
        item({ type: 'attachment', status: 'inherit', name: 'a-photo' }) +
        item({ type: 'wp_template', name: 'single' }) +
        item({ type: 'wp_global_styles', name: 'styles' }),
    )
    const out = parseWxr(xml, NOW)
    expect(out.posts.map((p) => p.slug)).toEqual(['a-post'])
    expect(out.pages.map((p) => p.slug)).toEqual(['a-page'])
    expect(out.skipped).toBe(3)
  })

  it('imports drafts as drafts and published as published', () => {
    const xml = wxr(item({ name: 'live' }) + item({ name: 'wip', status: 'draft' }))
    const out = parseWxr(xml, NOW)
    expect(out.posts.find((p) => p.slug === 'live')?.status).toBe('published')
    expect(out.posts.find((p) => p.slug === 'wip')?.status).toBe('draft')
  })

  it('keeps the path a published item lived at, and only that', () => {
    const xml = wxr(
      item({ name: 'dated', link: 'https://old.example/2020/05/dated/' }) +
        // A draft's <link> is WordPress's ?p=123 guess — nothing ever linked to it.
        item({ name: 'wip', status: 'draft', link: 'https://old.example/?p=123' }) +
        item({ name: 'bare' }),
    )
    const out = parseWxr(xml, NOW)
    expect(out.posts.find((p) => p.slug === 'dated')?.path).toBe('/2020/05/dated/')
    expect(out.posts.find((p) => p.slug === 'wip')?.path).toBeUndefined()
    expect(out.posts.find((p) => p.slug === 'bare')?.path).toBeUndefined()
  })
})

describe('parseWxr dates', () => {
  it('uses the GMT date when WordPress recorded one', () => {
    const out = parseWxr(wxr(item({ name: 'p', dateGmt: '2025-03-04 09:30:00' })), NOW)
    expect(out.posts[0]?.date).toBe('2025-03-04T09:30:00.000Z')
  })

  // Regression: WordPress writes a zero GMT date on anything never published, so a
  // `??` chain would take the zero and stamp every draft with the import date.
  it('falls back to the local date when the GMT date is the zero date', () => {
    const xml = wxr(
      item({ name: 'wip', status: 'draft', dateGmt: '0000-00-00 00:00:00', date: '2025-09-04 13:19:50' }),
    )
    const out = parseWxr(xml, NOW)
    expect(out.posts[0]?.date).toBe('2025-09-04T13:19:50.000Z')
  })

  it('falls back to now only when both dates are unusable', () => {
    const xml = wxr(
      item({ name: 'wip', status: 'draft', dateGmt: '0000-00-00 00:00:00', date: '0000-00-00 00:00:00' }),
    )
    expect(parseWxr(xml, NOW).posts[0]?.date).toBe(NOW)
  })
})

describe('parseWxr slugs', () => {
  // The whole point of a migration: the URL a reader has bookmarked keeps working.
  it('preserves an existing WordPress slug verbatim', () => {
    const xml = wxr(item({ name: 'den-pin-fenix-e35', title: 'Đèn pin Fenix E35' }))
    expect(parseWxr(xml, NOW).posts[0]?.slug).toBe('den-pin-fenix-e35')
  })

  it('derives a slug from the title when WordPress has none', () => {
    const xml = wxr(item({ name: '', title: 'Thương hiệu đèn pin Surefire', status: 'draft' }))
    expect(parseWxr(xml, NOW).posts[0]?.slug).toBe('thuong-hieu-den-pin-surefire')
  })

  it('disambiguates colliding slugs rather than dropping a post', () => {
    const xml = wxr(item({ name: 'same' }) + item({ name: 'same' }) + item({ name: 'same' }))
    expect(parseWxr(xml, NOW).posts.map((p) => p.slug)).toEqual(['same', 'same-2', 'same-3'])
  })
})

describe('parseWxr taxonomy', () => {
  const terms = `
    <category domain="category" nicename="kien-thuc"><![CDATA[Kiến thức đèn pin]]></category>
    <category domain="post_tag" nicename="den-pin-custom"><![CDATA[Đèn pin custom]]></category>
    <category domain="post_tag" nicename="titanium"><![CDATA[Titanium]]></category>
    <category domain="category" nicename="uncategorized"><![CDATA[Uncategorized]]></category>`

  it('splits categories from tags and drops Uncategorized', () => {
    const out = parseWxr(wxr(item({ name: 'p', terms })), NOW)
    expect(out.posts[0]?.categories).toEqual(['Kiến thức đèn pin'])
    expect(out.posts[0]?.tags).toEqual(['Đèn pin custom', 'Titanium'])
  })
})

describe('parseWxr content', () => {
  it('converts the HTML body to Markdown', () => {
    const html = '<h2>Heading</h2><p>Some <strong>bold</strong> text.</p><ul><li>One</li></ul>'
    const out = parseWxr(wxr(item({ name: 'p', content: html })), NOW)
    const body = out.posts[0]?.content ?? ''
    expect(body).toContain('## Heading')
    expect(body).toContain('**bold**')
    expect(body).toMatch(/^- +One$/m)
  })

  it('folds a figure caption into the image alt', () => {
    const html = '<figure><img src="https://x.test/a.jpg" alt="alt"/><figcaption>The caption</figcaption></figure>'
    const out = parseWxr(wxr(item({ name: 'p', content: html })), NOW)
    expect(out.posts[0]?.content.trim()).toBe('![The caption](https://x.test/a.jpg)')
  })

  // Regression: a gallery is a <figure> of nested <figure><img>, and the figure rule read
  // querySelector('img') — the FIRST one — so importing a real site dropped 152 of its 407
  // photographs, one page losing 139 of 169, with nothing reported.
  it('keeps every image in a gallery, not just the first', () => {
    const gallery =
      '<figure class="wp-block-gallery has-nested-images columns-4">' +
      '<figure class="wp-block-image"><img src="https://x.test/a.jpg" alt="A"/></figure>' +
      '<figure class="wp-block-image"><img src="https://x.test/b.jpg" alt="B"/></figure>' +
      '<figure class="wp-block-image"><img src="https://x.test/c.jpg" alt="C"/></figure>' +
      '</figure>'
    const body = parseWxr(wxr(item({ name: 'p', content: gallery })), NOW).posts[0]?.content ?? ''
    expect(body).toContain('https://x.test/a.jpg')
    expect(body).toContain('https://x.test/b.jpg')
    expect(body).toContain('https://x.test/c.jpg')
  })

  it('marks gallery images #grid so Quire Ink regroups them into a grid', () => {
    const gallery =
      '<figure class="wp-block-gallery has-nested-images columns-2">' +
      '<figure class="wp-block-image"><img src="https://x.test/a.jpg" alt="A"/></figure>' +
      '<figure class="wp-block-image"><img src="https://x.test/b.jpg" alt="B"/></figure>' +
      '</figure>'
    const body = parseWxr(wxr(item({ name: 'p', content: gallery })), NOW).posts[0]?.content ?? ''
    expect(body).toContain('![A](https://x.test/a.jpg#grid)')
    expect(body).toContain('![B](https://x.test/b.jpg#grid)')
  })

  it('does not mark a standalone image #grid', () => {
    const single = '<figure class="wp-block-image"><img src="https://x.test/solo.jpg" alt="Solo"/></figure>'
    const body = parseWxr(wxr(item({ name: 'p', content: single })), NOW).posts[0]?.content ?? ''
    expect(body.trim()).toBe('![Solo](https://x.test/solo.jpg)')
  })

  it('derives an excerpt when the export has none', () => {
    const out = parseWxr(wxr(item({ name: 'p', content: '<p>First sentence here.</p>' })), NOW)
    expect(out.posts[0]?.excerpt.length).toBeGreaterThan(0)
  })
})
