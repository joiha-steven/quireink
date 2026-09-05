import { describe, it, expect } from '@/test/vitest'
import {
  slugify,
  deriveExcerpt,
  clampExcerpt,
  readingMinutes,
  wordCount,
  isPublicallyVisible,
  isScheduled,
  extractImageUrls,
  untitledNumbers,
} from './utils'

describe('slugify', () => {
  it('strips Vietnamese diacritics and maps đ -> d', () => {
    expect(slugify('Suy nghĩ về Đời')).toBe('suy-nghi-ve-doi')
  })

  it('transliterates Cyrillic, so a Russian title is a readable URL', () => {
    expect(slugify('Почерк и время: зачем писать медленно')).toBe('pocherk-i-vremya-zachem-pisat-medlenno')
    expect(slugify('Щи да каша')).toBe('shchi-da-kasha')
  })

  it('still yields nothing for CJK — the timestamp fallback is deliberate there', () => {
    expect(slugify('中文标题')).toBe('')
  })

  it('collapses spaces/symbols and trims leading/trailing hyphens', () => {
    expect(slugify('  Hello, World!  ')).toBe('hello-world')
  })

  // A title with no sluggable characters yields '' — why savePost/savePage must
  // fall back to a timestamped slug so a post never persists an empty (unreachable) slug.
  it('returns empty for punctuation/emoji-only input', () => {
    expect(slugify('!!! --- ...')).toBe('')
    expect(slugify('🔦')).toBe('')
  })
})

describe('wordCount', () => {
  it('counts whitespace-split words with markup stripped', () => {
    expect(wordCount('# Title\n\nHello **bold** world')).toBe(4) // Title, Hello, bold, world
  })

  it('agrees with readingMinutes (~200 wpm)', () => {
    const words = Array(600).fill('word').join(' ')
    expect(wordCount(words)).toBe(600)
    expect(readingMinutes(words)).toBe(3)
  })
})

describe('readingMinutes', () => {
  it('is at least 1 minute for short content', () => {
    expect(readingMinutes('a few words here')).toBe(1)
  })

  it('approximates ~200 words per minute', () => {
    const words = Array(400).fill('word').join(' ')
    expect(readingMinutes(words)).toBe(2)
  })
})

describe('deriveExcerpt', () => {
  it('returns the whole text when under the word limit', () => {
    expect(deriveExcerpt('short body text', 50)).toBe('short body text')
  })

  it('cuts at maxWords and appends an ellipsis', () => {
    const body = Array(60).fill('w').join(' ')
    const out = deriveExcerpt(body, 50)
    expect(out.endsWith('...')).toBe(true)
    expect(out.split(' ')).toHaveLength(50) // 50 words; "..." sticks to the last one
  })

  it('strips markdown image/link syntax from the excerpt', () => {
    expect(deriveExcerpt('![alt](media/x.jpg) real [text](/l) here')).toBe('real text here')
  })
})

describe('clampExcerpt', () => {
  it('cuts on a word boundary with an ellipsis past the char limit', () => {
    const out = clampExcerpt('one two three four five', 11)
    expect(out).toBe('one two...')
  })
})

describe('isPublicallyVisible', () => {
  it('is false for a draft regardless of date', () => {
    expect(isPublicallyVisible('draft', '2000-01-01')).toBe(false)
  })

  it('is false for a published post dated in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(isPublicallyVisible('published', future)).toBe(false)
  })

  it('is true for a published post dated in the past', () => {
    expect(isPublicallyVisible('published', '2000-01-01')).toBe(true)
  })
})

describe('isScheduled', () => {
  it('is true for a published post dated in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(isScheduled('published', future)).toBe(true)
  })

  it('is false for a published post already live (past date)', () => {
    expect(isScheduled('published', '2000-01-01')).toBe(false)
  })

  it('is false for a draft even with a future date', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(isScheduled('draft', future)).toBe(false)
  })

  it('is false for a malformed date', () => {
    expect(isScheduled('published', '')).toBe(false)
  })

  // A post is either live now or scheduled — never both (the read-layer complement).
  it('is the exact complement of isPublicallyVisible for published posts', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(isScheduled('published', future)).toBe(!isPublicallyVisible('published', future))
    expect(isScheduled('published', '2000-01-01')).toBe(!isPublicallyVisible('published', '2000-01-01'))
  })
})

describe('extractImageUrls', () => {
  it('collects de-duped image URLs in order', () => {
    const content = '![a](https://h/x.jpg) <img src="https://h/y.png"> again https://h/x.jpg'
    expect(extractImageUrls(content)).toEqual(['https://h/x.jpg', 'https://h/y.png'])
  })

  // Self-hosted images are stored store-relative — these MUST be picked up too, else the
  // Lightbox (gated by this) never mounts for local images.
  it('also collects root-relative image URLs', () => {
    const content = '![a](/uploads/media/foo.png) and ![b](/uploads/media/bar.webp)'
    expect(extractImageUrls(content)).toEqual(['/uploads/media/foo.png', '/uploads/media/bar.webp'])
  })
})

// The untitled draft numbering shared by the writing sidebar and the dashboard band.
const uRow = (kind: 'post' | 'page', slug: string, title: string, created: number) => ({ kind, slug, title, created })

describe('untitledNumbers', () => {
  it('numbers only the untitled ones, oldest first, whitespace counting as untitled', () => {
    const n = untitledNumbers([
      uRow('post', 'has-title', 'A Real Title', 300),
      uRow('post', 'post-3', '', 300),
      uRow('post', 'post-1', '', 100),
      uRow('post', 'post-2', '  ', 200),
    ])
    expect(n.get('post:post-1')).toBe(1)
    expect(n.get('post:post-2')).toBe(2)
    expect(n.get('post:post-3')).toBe(3)
    expect(n.has('post:has-title')).toBe(false)
  })

  it('keeps a draft its number when a newer untitled draft appears above it', () => {
    const after = untitledNumbers([uRow('post', 'a', '', 100), uRow('post', 'b', '', 200), uRow('post', 'c', '', 300)])
    expect(after.get('post:a')).toBe(1)
    expect(after.get('post:b')).toBe(2)
    expect(after.get('post:c')).toBe(3)
  })

  it('is deterministic when two untitled drafts share a timestamp', () => {
    const a = untitledNumbers([uRow('post', 'y', '', 100), uRow('post', 'x', '', 100)])
    const b = untitledNumbers([uRow('post', 'x', '', 100), uRow('post', 'y', '', 100)])
    expect(a.get('post:x')).toBe(b.get('post:x'))
    expect(a.get('post:y')).toBe(b.get('post:y'))
  })

  it('numbers posts and pages in one sequence, so the two surfaces agree', () => {
    const n = untitledNumbers([uRow('page', 'page-1', '', 150), uRow('post', 'post-1', '', 100)])
    expect(n.get('post:post-1')).toBe(1)
    expect(n.get('page:page-1')).toBe(2)
  })
})
