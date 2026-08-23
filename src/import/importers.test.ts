// The three new front doors, each fed a small but truthful copy of what its platform
// actually exports — shapes lifted from real Ghost 5.x, Substack and Medium archives.

import { describe, it, expect } from 'bun:test'
import { parseGhost, looksLikeGhost } from './ghost'
import { parseSubstack, parseMedium, parseCsv, isSubstack, isMedium, type Entry } from './archive'
import { cleanImportHtml, cleanImportMarkdown } from './convert'

const NOW = '2026-08-23T00:00:00.000Z'

describe('cleanImportHtml / cleanImportMarkdown', () => {
  it('unwraps caption and embed shortcodes, drops dead plugin codes, keeps prose about shortcodes', () => {
    const html = '[caption id="a"]<img src="/x.jpg">[/caption] [gallery ids="1,2"] '
      + '[embed]https://youtu.be/x[/embed] <p>Use [shortcode] syntax carefully.</p>'
    const out = cleanImportHtml(html)
    expect(out).toContain('<img src="/x.jpg">')
    expect(out).not.toContain('[caption')
    expect(out).not.toContain('[gallery')
    expect(out).toContain('https://youtu.be/x')
    expect(out).toContain('[shortcode] syntax') // an unknown code is prose until proven otherwise
  })
  it('collapses blank-line pileups and trailing spaces', () => {
    expect(cleanImportMarkdown('a  \n\n\n\n\nb')).toBe('a\n\nb')
  })
})

describe('Ghost', () => {
  const doc = {
    db: [{ data: {
      posts: [
        { id: 'p1', title: 'Hello Ghost', slug: 'hello-ghost', status: 'published', type: 'post',
          html: '<p>Body <b>bold</b>.</p>', custom_excerpt: 'A greeting.',
          published_at: '2024-05-01T08:00:00.000Z' },
        { id: 'p2', title: 'Waiting', slug: 'waiting', status: 'scheduled', type: 'post',
          html: '<p>Later.</p>', published_at: '2030-01-01T00:00:00.000Z' },
        { id: 'p3', title: 'About', slug: 'about', status: 'published', type: 'page', html: '<p>Me.</p>' },
        { id: 'p4', title: 'Sent letter', slug: 'sent-letter', status: 'sent', type: 'post', html: '<p>Mail.</p>' },
      ],
      tags: [{ id: 't1', name: 'Letters' }, { id: 't2', name: 'craft' }],
      posts_tags: [
        { post_id: 'p1', tag_id: 't2', sort_order: 1 },
        { post_id: 'p1', tag_id: 't1', sort_order: 0 },
      ],
    } }],
  }

  it('recognises both export shapes', () => {
    expect(looksLikeGhost(doc)).toBe(true)
    expect(looksLikeGhost({ data: (doc.db[0] as any).data })).toBe(true)
    expect(looksLikeGhost({ rss: {} })).toBe(false)
  })

  it('imports posts, pages, statuses and the primary-tag-as-category rule', () => {
    const { posts, pages, skipped } = parseGhost(doc, NOW)
    expect(skipped).toBe(0)
    expect(pages).toEqual([{ title: 'About', slug: 'about', status: 'published', content: 'Me.' }])
    const hello = posts.find((p) => p.slug === 'hello-ghost')!
    expect(hello.content).toBe('Body **bold**.')
    expect(hello.categories).toEqual(['Letters']) // sort_order 0 wins, not array order
    expect(hello.tags).toEqual(['craft'])
    expect(hello.excerpt).toBe('A greeting.')
    expect(hello.date).toBe('2024-05-01T08:00:00.000Z')
    expect(posts.find((p) => p.slug === 'waiting')!.status).toBe('draft') // scheduled → draft
    expect(posts.find((p) => p.slug === 'sent-letter')!.status).toBe('published') // sent = delivered
  })
})

describe('Substack', () => {
  const entries: Entry[] = [
    { name: 'posts.csv', text:
      'post_id,post_date,is_published,email_sent_at,type,audience,title,subtitle\n'
      + '"140001.first-letter","2024-03-10T12:00:00.000Z","true","","newsletter","everyone","First, a letter","On beginnings"\n'
      + '"140002.rough-idea","2024-04-01T09:00:00.000Z","false","","newsletter","everyone","Rough idea",""\n'
      + '"140003.audio-episode","2024-05-01T00:00:00.000Z","true","","podcast","everyone","An episode",""\n' },
    { name: 'posts/140001.first-letter.html', text: '<h2>Part one</h2><p>It begins.</p>' },
    { name: 'posts/140002.rough-idea.html', text: '<p>Half a thought.</p>' },
  ]

  it('reads quoted CSV the way RFC 4180 means it', () => {
    expect(parseCsv('a,"b,c",""""\n')[0]).toEqual(['a', 'b,c', '"'])
  })

  it('is recognised by posts.csv, imports by the csv, skips a row with no file', () => {
    expect(isSubstack(entries)).toBe(true)
    const { posts, skipped } = parseSubstack(entries, NOW)
    expect(skipped).toBe(1) // the podcast row has no html file
    expect(posts).toHaveLength(2)
    const first = posts.find((p) => p.slug === 'first-letter')!
    expect(first.title).toBe('First, a letter') // the comma survived the CSV
    expect(first.excerpt).toBe('On beginnings')
    expect(first.status).toBe('published')
    expect(first.content).toContain('## Part one')
    expect(posts.find((p) => p.slug === 'rough-idea')!.status).toBe('draft')
  })
})

describe('Medium', () => {
  const article = (title: string, published: string | null, body: string) => `<!DOCTYPE html>
<html><head><title>${title}</title></head>
<body><article class="h-entry">
<h1 class="p-name">${title}</h1>
${published ? `<time class="dt-published" datetime="${published}">x</time>` : ''}
<section data-field="body" class="e-content"><h3 class="graf--title">${title}</h3><p>${body}</p></section>
</article></body></html>`

  const entries: Entry[] = [
    { name: 'posts/2024-06-01_A-walk-home-abc123def456.html', text: article('A walk home', '2024-06-01T10:00:00.000Z', 'Streets at dusk.') },
    { name: 'posts/draft_Unfinished-thing-fedcba987654.html', text: article('Unfinished thing', null, 'Not yet.') },
    { name: 'profile/about.html', text: '<html><body>me</body></html>' },
  ]

  it('is recognised by the h-entry markup, imports posts and drafts, deduplicates the title heading', () => {
    expect(isMedium(entries)).toBe(true)
    expect(isSubstack(entries)).toBe(false)
    const { posts } = parseMedium(entries, NOW)
    expect(posts).toHaveLength(2)
    const walk = posts.find((p) => p.status === 'published')!
    expect(walk.title).toBe('A walk home')
    expect(walk.date).toBe('2024-06-01T10:00:00.000Z')
    expect(walk.content).toBe('Streets at dusk.') // the repeated title heading is gone
    expect(walk.slug).toBe('2024-06-01-a-walk-home') // the trailing hash is trimmed
    const draft = posts.find((p) => p.status === 'draft')!
    expect(draft.title).toBe('Unfinished thing')
  })
})
