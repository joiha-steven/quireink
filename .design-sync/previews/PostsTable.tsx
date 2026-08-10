import { PostsTable } from 'quireink'

// Shapes match `Post` in src/types.ts. Realistic content on purpose: these cards are browsed
// by humans and imitated by the design agent, and a table of "foo / bar" teaches it nothing
// about how a Quire Ink listing actually reads.
const POSTS = [
  {
    title: 'Bàn phím cơ và chuyện gõ tiếng Việt',
    slug: 'ban-phim-co-va-go-tieng-viet',
    date: '2026-07-28T09:00:00.000Z',
    status: 'published' as const,
    categories: ['Bàn phím'],
    tags: ['telex', 'firmware'],
    readingMinutes: 8,
  },
  {
    title: 'What a static blog gives up, and what it buys',
    slug: 'what-a-static-blog-gives-up',
    date: '2026-07-14T11:30:00.000Z',
    status: 'published' as const,
    categories: ['Engineering'],
    tags: ['bun', 'sqlite'],
    readingMinutes: 12,
  },
  {
    title: 'Notes on measuring a page instead of guessing',
    slug: 'measuring-a-page',
    date: '2026-08-04T08:00:00.000Z',
    status: 'draft' as const,
    categories: ['Engineering'],
    tags: ['performance'],
    readingMinutes: 5,
  },
]

// Keyed by PATH, not by slug: the table reads `views[`/${p.slug}`]` because the analytics
// store counts page paths. `commentCounts` below is keyed by the bare slug — the two really
// do differ, and keying both the same way silently renders a column of zeroes.
const VIEWS = {
  '/ban-phim-co-va-go-tieng-viet': 4218,
  '/what-a-static-blog-gives-up': 1907,
  '/measuring-a-page': 0,
}

const COMMENTS = {
  'ban-phim-co-va-go-tieng-viet': 12,
  'what-a-static-blog-gives-up': 3,
  'measuring-a-page': 0,
}

export function Basic() {
  return (
    <PostsTable
      initialPosts={POSTS}
      views={VIEWS}
      commentCounts={COMMENTS}
      commentsEnabled
    />
  )
}

// With comments switched off site-wide the column disappears entirely.
export function CommentsDisabled() {
  return (
    <PostsTable
      initialPosts={POSTS}
      views={VIEWS}
      commentCounts={COMMENTS}
      commentsEnabled={false}
    />
  )
}

export function Empty() {
  return <PostsTable initialPosts={[]} views={{}} commentCounts={{}} commentsEnabled />
}
