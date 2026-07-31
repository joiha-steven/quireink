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
//   bun scripts/seed-showcase.ts [dir] [text|image]
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

const DIR = process.argv[2] ?? './.tmp-drive-data'
const KIND = (process.argv[3] ?? 'text') as 'image' | 'text'

rmSync(DIR, { recursive: true, force: true })
openDatabases(DIR)

/**
 * Prose, not lorem: headings, a list, a pull quote and a fenced block, so a post looks real.
 *
 * The body deliberately does NOT open with the excerpt. It did at first, and the front page
 * printed the same sentence twice — which is how the duplicate-standfirst bug was found, so
 * the fixture keeps them distinct to show the real shape.
 */
const body = (_lead: string) => `Every few years a writing platform I liked announces that it has been acquired, or that it is sunsetting its export tool, or that an essay from 2014 now sits behind a counter asking my readers to sign up. None of it is malice. It is what happens when the place your words live is somebody else's business model.

## What owning it actually means

It is worth being precise, because the phrase gets used loosely. Owning your writing means four separate things, and most platforms give you one or two:

1. **The text is yours in a format you can read without the platform.** Markdown in a file
   beats a proprietary document that needs a running service to render.
2. **The URL is yours.** A domain you control means the machine underneath can change without
   breaking a single link anyone ever shared.
3. **The readers are yours.** An email list is portable; a follower count is not.
4. **The shape is yours.** If the type is too small you can change it, rather than file a
   request and wait.

> The alternative is not glamorous. You rent a small server, you point a domain at it, and
> you accept that uptime is now your problem.

## What it costs

Roughly five dollars a month and one afternoon. The afternoon is the real price, and it is paid once.

\`\`\`bash git clone https://github.com/joiha-steven/quire-blog bun install && bun run build \`\`\`

What you get back is that nothing between you and a reader is negotiable by a third party.
`

type Seed = {
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string[]
  series?: string
  order?: number
}

const POSTS: Seed[] = [
  { title: 'The quiet case for owning your own words', slug: 'owning-your-own-words',
    excerpt: 'Four things people mean by owning their writing, only two of which any platform actually gives you.',
    category: 'Essays', tags: ['ownership', 'the web', 'writing'] },
  { title: 'What a page weighs, and who pays for it', slug: 'what-a-page-weighs',
    excerpt: 'I was sure the page was 60 KB. It was 340. The gap is where every performance argument actually lives.',
    category: 'Engineering', tags: ['performance', 'the web'] },
  { title: 'Notes on reading, on paper and on glass', slug: 'reading-on-paper-and-glass',
    excerpt: 'A measure, a leading and a typeface walk into a column. Only one of them is usually blamed.',
    category: 'Typography', tags: ['reading', 'typography'] },
  { title: 'The database you already have', slug: 'the-database-you-already-have',
    excerpt: 'SQLite is not a toy you graduate from. For one writer and one server it is the whole answer.',
    category: 'Engineering', tags: ['sqlite', 'architecture'] },
  { title: 'Against the dashboard', slug: 'against-the-dashboard',
    excerpt: 'Analytics that tell you what to do next, rather than nine charts that tell you what happened.',
    category: 'Essays', tags: ['analytics', 'craft'] },
  { title: 'A type scale you can defend', slug: 'a-type-scale-you-can-defend',
    excerpt: 'Every size on the page comes from a role, so one setting changes the page rather than one heading.',
    category: 'Typography', tags: ['typography', 'craft'], series: 'Designing a reading page', order: 1 },
  { title: 'The measure is the design', slug: 'the-measure-is-the-design',
    excerpt: 'Sixty-six characters is not a superstition. It is the width at which the eye stops losing its place.',
    category: 'Typography', tags: ['typography', 'reading'], series: 'Designing a reading page', order: 2 },
  { title: 'Colour without a palette generator', slug: 'colour-without-a-generator',
    excerpt: 'Six palettes, each one an ink and a paper. What is left after the brand-colour ceremony is deleted.',
    category: 'Typography', tags: ['colour', 'craft'], series: 'Designing a reading page', order: 3 },
  { title: 'Caching is one Map and one rule', slug: 'caching-is-one-map',
    excerpt: 'A tagged cache, an ISR store and a path-superset function, replaced by throwing it all away on any write.',
    category: 'Engineering', tags: ['architecture', 'performance'] },
  { title: 'Letting an agent publish for you', slug: 'letting-an-agent-publish',
    excerpt: 'The blog speaks MCP, so an assistant can draft, tag and schedule without a browser in the loop.',
    category: 'Engineering', tags: ['ai', 'architecture'] },
  { title: 'Comments, and the small web that reads them', slug: 'comments-and-the-small-web',
    excerpt: 'Threads, replies by email, and a verification box that stays out of the way until it matters.',
    category: 'Essays', tags: ['the web', 'craft'] },
  { title: 'What a backup is actually for', slug: 'what-a-backup-is-for',
    excerpt: 'A copy you have never restored is a rumour. The only test that counts is the one that brings it back.',
    category: 'Engineering', tags: ['architecture', 'ops'] },
  { title: 'The book mode nobody asked for, and everybody used', slug: 'the-book-mode',
    excerpt: 'Two facing columns, a drop cap and a page count. People do want to finish a long piece after all.',
    category: 'Typography', tags: ['reading', 'typography'] },
  { title: 'Writing in the open, three years in', slug: 'writing-in-the-open',
    excerpt: 'What changed, what I would keep, and the one habit that did more than the other nine put together.',
    category: 'Essays', tags: ['writing', 'craft'] },
]

const DAY = 24 * 60 * 60 * 1000
const START = Date.UTC(2026, 6, 30, 9, 0, 0)

for (let i = 0; i < POSTS.length; i += 1) {
  const p = POSTS[i]!
  await savePost({
    title: p.title,
    slug: p.slug,
    status: 'published',
    date: new Date(START - i * 2 * DAY).toISOString(),
    content: body(p.excerpt),
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
  title: 'About', slug: 'about', status: 'published',
  content: 'A blog about software, typography, and building things that outlast the platform they were built on.',
})

const top = await addComment({
  postSlug: 'owning-your-own-words', parentId: null,
  name: 'Marta Vogel', email: 'marta@example.com', website: '', provider: 'manual',
  content: 'The third point is the one nobody plans for. I moved hosts twice and kept every '
    + 'link, and **still** lost the readers, because the list lived in the platform.',
  ip: '', country: 'DE',
})
await addComment({
  postSlug: 'owning-your-own-words', parentId: top.id,
  name: 'The author', email: 'author@example.com', website: '', provider: 'manual',
  content: 'That is the one I got wrong for years too. The list is the only part that is '
    + 'genuinely hard to rebuild.',
  ip: '', country: 'VN',
})

const s = await getSettings()
await saveSettings({
  ...s,
  title: 'Quire',
  description: 'Notes on software, typography, and building things that last',
  showDescription: true,
  fontPreset: 'literata',
  chromeFont: 'jetbrains-mono',
  ideChrome: true,
  menu: [
    { label: 'Essays', href: '/category/essays' },
    { label: 'Engineering', href: '/category/engineering' },
    { label: 'About', href: '/about' },
  ],
  featured: ['the-database-you-already-have', 'a-type-scale-you-can-defend', 'against-the-dashboard'],
  mostViewedCount: 3,
  comments: { ...s.comments, enabled: true },
  home: {
    ...DEFAULT_HOME,
    mode: 'front',
    front: {
      ...DEFAULT_HOME.front,
      kind: KIND,
      strips: [
        { category: 'Essays', count: 3, columns: 3 },
        { category: 'Typography', count: 2, columns: 2 },
      ],
    },
  },
})

console.log(`seeded ${DIR}: ${POSTS.length} posts, Literata + JetBrains Mono, IDE chrome, front kind=${KIND}`)
