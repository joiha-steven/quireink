// Shared preview data. Not a preview itself — the converter only looks for
// `previews/<ComponentName>.tsx`, so this file is invisible to it and exists purely to stop
// twenty previews each inventing their own posts.
//
// `SETTINGS` is the product's real `DEFAULT_SETTINGS`, serialised at build time by
// `gen-styles.ts` (a preview cannot import `@/content/settings` directly — that module
// reaches sharp, which requires child_process, and previews are browser code).
//
// Everything else is composed fixture data. Realistic on purpose: these cards are browsed by
// humans and imitated by the design agent, so "foo / bar" would teach it the wrong thing
// about how a Quire Ink screen reads.
import SETTINGS_JSON from '../generated/settings.json'
import PRESETS_JSON from '../generated/presets.json'

export const SETTINGS: any = SETTINGS_JSON
/** The six palettes the theme editor offers, from `THEME_PRESETS`. */
export const PRESETS: any[] = PRESETS_JSON as any[]

/** `{ slug, title }` pairs — what the pickers (featured, menu, front page) take. */
export const POST_REFS = [
  { slug: 'ban-phim-co-va-go-tieng-viet', title: 'Bàn phím cơ và chuyện gõ tiếng Việt' },
  { slug: 'what-a-static-blog-gives-up', title: 'What a static blog gives up, and what it buys' },
  { slug: 'measuring-a-page', title: 'Notes on measuring a page instead of guessing' },
]

export const PAGE_REFS = [
  { slug: 'about', title: 'About' },
  { slug: 'colophon', title: 'Colophon' },
  { slug: 'now', title: 'Now' },
]

export const CATEGORIES = ['Bàn phím', 'Engineering', 'Reading']

/** `CommentEnv` — which comment integrations the server found configured. */
export const COMMENT_ENV = {
  turnstileConfigured: true,
  googleConfigured: false,
  turnstileSiteKey: '0x4AAAAAAA_example_site_key',
}

/** `SendablePost[]` for the newsletter composer. */
export const SENDABLE = [
  { slug: 'ban-phim-co-va-go-tieng-viet', title: 'Bàn phím cơ và chuyện gõ tiếng Việt', date: '2026-07-28T09:00:00.000Z', stats: { sent: 214, opened: 131 } },
  { slug: 'what-a-static-blog-gives-up', title: 'What a static blog gives up, and what it buys', date: '2026-07-14T11:30:00.000Z', stats: null },
]

/** Daily points for the analytics chart. */
export const DAILY: any[] = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-07-${String(i + 1).padStart(2, '0')}`,
  views: [82, 96, 130, 118, 240, 410, 386, 210, 175, 168, 190, 205, 260, 330, 298,
    245, 220, 208, 196, 188, 240, 285, 340, 402, 368, 300, 265, 248, 232, 220][i],
  visitors: [51, 60, 78, 71, 142, 238, 221, 130, 110, 104, 118, 127, 158, 196, 179,
    148, 136, 128, 121, 116, 148, 172, 203, 238, 219, 181, 160, 151, 142, 136][i],
}))

export const POSTS: any[] = [
  {
    title: 'Bàn phím cơ và chuyện gõ tiếng Việt',
    slug: 'ban-phim-co-va-go-tieng-viet',
    date: '2026-07-28T09:00:00.000Z',
    status: 'published',
    categories: ['Bàn phím'],
    tags: ['telex', 'firmware'],
    excerpt: 'Bộ gõ nào cũng phải chọn giữa tốc độ và độ chính xác. Đây là chỗ tôi dừng lại.',
    readingMinutes: 8,
  },
  {
    title: 'What a static blog gives up, and what it buys',
    slug: 'what-a-static-blog-gives-up',
    date: '2026-07-14T11:30:00.000Z',
    status: 'published',
    categories: ['Engineering'],
    tags: ['bun', 'sqlite'],
    excerpt: 'Dropping the database was the easy part. Keeping the writing experience was not.',
    readingMinutes: 12,
  },
  {
    title: 'Notes on measuring a page instead of guessing',
    slug: 'measuring-a-page',
    date: '2026-08-04T08:00:00.000Z',
    status: 'draft',
    categories: ['Engineering'],
    tags: ['performance'],
    excerpt: 'Every performance argument I have lost was lost to someone with numbers.',
    readingMinutes: 5,
  },
]

export const PAGES: any[] = [
  { title: 'About', slug: 'about', status: 'published' },
  { title: 'Colophon', slug: 'colophon', status: 'published' },
  { title: 'Now', slug: 'now', status: 'draft' },
]

// Views are keyed by PATH; comment counts by bare slug. The two really do differ.
export const VIEWS: Record<string, number> = {
  '/ban-phim-co-va-go-tieng-viet': 4218,
  '/what-a-static-blog-gives-up': 1907,
  '/measuring-a-page': 0,
  '/about': 612,
  '/colophon': 88,
}

export const COMMENT_COUNTS: Record<string, number> = {
  'ban-phim-co-va-go-tieng-viet': 12,
  'what-a-static-blog-gives-up': 3,
  'measuring-a-page': 0,
}

export const COMMENTS: any[] = [
  {
    id: 1,
    postSlug: 'ban-phim-co-va-go-tieng-viet',
    author: 'Ngọc Anh',
    email: 'ngocanh@example.com',
    body: 'Mình dùng Telex nhiều năm rồi, chưa bao giờ nghĩ tới chuyện đo tốc độ thật. Bài này thuyết phục.',
    createdAt: '2026-07-29T03:12:00.000Z',
    status: 'approved',
  },
  {
    id: 2,
    postSlug: 'what-a-static-blog-gives-up',
    author: 'Marcus',
    email: 'marcus@example.com',
    body: 'Curious how this holds up once you have a few thousand posts. Any numbers?',
    createdAt: '2026-07-16T18:44:00.000Z',
    status: 'pending',
  },
  {
    id: 3,
    postSlug: 'what-a-static-blog-gives-up',
    author: 'buy-cheap-now',
    email: 'spam@example.com',
    body: 'CHECK OUT MY SITE!!! best deals guaranteed',
    createdAt: '2026-07-17T02:01:00.000Z',
    status: 'spam',
  },
]

export const ACTIVITY: any[] = [
  { id: 4, at: '2026-08-01T09:14:00.000Z', action: 'post.publish', detail: 'ban-phim-co-va-go-tieng-viet' },
  { id: 3, at: '2026-08-01T08:52:00.000Z', action: 'settings.save', detail: 'appearance' },
  { id: 2, at: '2026-07-31T21:30:00.000Z', action: 'media.upload', detail: 'keyboard-hero.jpg' },
  { id: 1, at: '2026-07-31T20:11:00.000Z', action: 'comment.approve', detail: '#1' },
]

// Bar rows for the analytics lists: `{ label, value }` with an optional href.
export const BAR_ROWS: any[] = [
  { key: '/ban-phim-co-va-go-tieng-viet', label: '/ban-phim-co-va-go-tieng-viet', value: 4218 },
  { key: '/what-a-static-blog-gives-up', label: '/what-a-static-blog-gives-up', value: 1907 },
  { key: '/about', label: '/about', value: 612 },
  { key: '/colophon', label: '/colophon', value: 88 },
]

export const REFERRERS: any[] = [
  { key: 'google.com', label: 'google.com', value: 2841 },
  { key: 'news.ycombinator.com', label: 'news.ycombinator.com', value: 1663 },
  { key: 'direct', label: '(direct)', value: 1319 },
  { key: 'x.com', label: 'x.com', value: 402 },
]
