import { describe, expect, it } from 'bun:test'
import { isUntitled, postName, slugFromWords } from '@/content/untitled'

describe('slugFromWords', () => {
  it('takes the first six words, stripped of Markdown and accents', () => {
    expect(slugFromWords('Hôm nay **tôi** đọc lại [một bài](https://e.com) cũ.')).toBe('hom-nay-toi-doc-lai-mot')
  })

  it('gives nothing when the words slugify to nothing, so the caller falls back', () => {
    expect(slugFromWords('')).toBe('')
    expect(slugFromWords('日本語のメモ')).toBe('')
  })
})

describe('postName', () => {
  const p = (title: string, excerpt?: string | null) => ({ title, excerpt, slug: 'the-slug' })

  it('is the title when there is one', () => {
    expect(postName(p('  A title  ', 'Words.'))).toBe('A title')
  })

  it('is the start of the words when there is not, cut at a word with one ellipsis', () => {
    expect(postName(p('', 'A short thought.'))).toBe('A short thought.')
    const long = 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
    const name = postName(p('', long))
    expect(name.endsWith('…')).toBe(true)
    expect(name.length).toBeLessThanOrEqual(71)
    expect(name).not.toContain('...')
  })

  it('keeps the cut the excerpt already made, once', () => {
    expect(postName(p('', 'Stored excerpt that was cut...'))).toBe('Stored excerpt that was cut…')
  })

  it('falls back to the slug when there are no words at all', () => {
    expect(postName(p('', ''))).toBe('the-slug')
    expect(postName(p('', null))).toBe('the-slug')
  })

  it('says whether a post has a title', () => {
    expect(isUntitled({ title: ' ' })).toBe(true)
    expect(isUntitled({ title: 'x' })).toBe(false)
  })
})
