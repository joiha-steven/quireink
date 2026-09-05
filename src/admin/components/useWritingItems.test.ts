// The untitled draft numbering: stable per draft, so the sidebar can tell several apart.
import { describe, it, expect } from 'bun:test'
import { untitledNumbers } from './useWritingItems'

const row = (kind: 'post' | 'page', slug: string, title: string, created: number) => ({ kind, slug, title, created })

describe('untitledNumbers', () => {
  it('numbers only the untitled ones, oldest first', () => {
    const n = untitledNumbers([
      row('post', 'has-title', 'A Real Title', 300),
      row('post', 'post-3', '', 300),
      row('post', 'post-1', '', 100),
      row('post', 'post-2', '  ', 200), // whitespace-only counts as untitled
    ])
    expect(n.get('post:post-1')).toBe(1)
    expect(n.get('post:post-2')).toBe(2)
    expect(n.get('post:post-3')).toBe(3)
    expect(n.has('post:has-title')).toBe(false)
  })

  it('keeps a draft its number when a newer untitled draft appears above it', () => {
    const before = untitledNumbers([row('post', 'a', '', 100), row('post', 'b', '', 200)])
    const after = untitledNumbers([row('post', 'a', '', 100), row('post', 'b', '', 200), row('post', 'c', '', 300)])
    expect(before.get('post:a')).toBe(1)
    expect(after.get('post:a')).toBe(1) // unchanged
    expect(after.get('post:b')).toBe(2)
    expect(after.get('post:c')).toBe(3)
  })

  it('is deterministic when two untitled drafts share a timestamp', () => {
    const a = untitledNumbers([row('post', 'y', '', 100), row('post', 'x', '', 100)])
    const b = untitledNumbers([row('post', 'x', '', 100), row('post', 'y', '', 100)])
    expect(a.get('post:x')).toBe(b.get('post:x'))
    expect(a.get('post:y')).toBe(b.get('post:y'))
  })

  it('numbers posts and pages in one sequence', () => {
    const n = untitledNumbers([row('page', 'page-1', '', 150), row('post', 'post-1', '', 100)])
    expect(n.get('post:post-1')).toBe(1)
    expect(n.get('page:page-1')).toBe(2)
  })
})
