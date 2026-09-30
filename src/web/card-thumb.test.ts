// A 96px card picture downloaded the 1200px original when the widths had not been made yet,
// while the upload's own 20 KB `-thumb.webp` sat unused (2026-09-30).
import { describe, expect, it } from 'bun:test'
import { postImage, readyFrom } from '@/web/front-card'
import type { Post } from '@/types'

const post = { title: 'The reed pen', slug: 'the-reed-pen', date: '2020-01-01T00:00:00.000Z', status: 'published',
  categories: [], tags: [], featuredImage: '/uploads/media/van-gogh.jpg' } as unknown as Post

describe('a card picture with no widths yet', () => {
  const ready = readyFrom([{ url: '/uploads/media/van-gogh.jpg', variants: 0, thumb: '/uploads/media/van-gogh-thumb.webp' }])

  it('shows the small copy in a small box', () => {
    expect(postImage(post, ready, '96px')).toContain('src="/uploads/media/van-gogh-thumb.webp"')
  })

  it('keeps the original in a box larger than the small copy', () => {
    expect(postImage(post, ready, '(max-width: 700px) 100vw, 680px')).toContain('src="/uploads/media/van-gogh.jpg"')
  })

  it('offers the widths, not the small copy, once they exist', () => {
    const done = readyFrom([{ url: '/uploads/media/van-gogh.jpg', variants: 2, thumb: '/uploads/media/van-gogh-thumb.webp' }])
    const html = postImage(post, done, '96px')!
    expect(html).toContain('van-gogh-512.webp')
    expect(html).toContain('src="/uploads/media/van-gogh.jpg"')
  })
})
