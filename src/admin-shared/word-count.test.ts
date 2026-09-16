// The number in the sheet's small print. It counts Markdown, and Markdown is not prose.
//
// Since 2026-09-16 it is the SAME arithmetic the published page prints, so these are also
// assertions about `utils.ts`. The two used to be separate, and the two disagreed: one body,
// 14 minutes under the title and 13 minutes over the editor.
import { describe, expect, it } from 'bun:test'
import { readingMinutes, wordCount } from '@/utils'
import { countWords, readMinutes } from './word-count'

describe('counting the words', () => {
  it('counts nothing in nothing', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n\n  ')).toBe(0)
  })

  it('counts plain prose', () => {
    expect(countWords('one two three')).toBe(3)
  })

  it('does not count the marks that make a heading a heading', () => {
    expect(countWords('# A title')).toBe(2)
    expect(countWords('> quoted words here')).toBe(3)
    expect(countWords('- one\n- two')).toBe(2)
  })

  it('does not let emphasis split a word in two', () => {
    // `**bold**` is one word. Stripping the asterisks leaves ` bold `, not `bo ld`.
    expect(countWords('**bold** *and* _more_')).toBe(3)
  })

  it('counts a fenced block as ONE thing, not as its tokens', () => {
    // ⚠️ Eight lines of TypeScript are not eighty words of prose. A piece that is half code
    // would otherwise report roughly double, on the one line a writer glances at to know how
    // long the piece has got.
    const md = 'before\n\n```ts\nconst a = 1\nfunction b() { return a + 1 }\n```\n\nafter'
    expect(countWords(md)).toBe(2)
  })

  it('counts an unclosed fence as text, because that is what it still is', () => {
    // A fence being typed has no closing pair yet, and the words under it are the writer's.
    expect(countWords('```\none two')).toBe(2)
  })

  it('counts a link by what a reader reads, WITHOUT its address', () => {
    // This asserted 3 until 2026-09-16, under the same name. A reader reads two words; the
    // third was `https://example.com`, which this side counted as prose and the published
    // page did not. The name was right and the number was the other implementation's.
    expect(countWords('[the docs](https://example.com)')).toBe(2)
  })

  it('does not count the address of a picture or an embed either', () => {
    expect(countWords('![a photograph](https://example.com/a/very/long/path/photo.jpg)')).toBe(0)
    expect(countWords('<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>')).toBe(0)
  })

  it('answers exactly what the published page answers', () => {
    // The point of the file. A disagreement here is two numbers in front of one person.
    for (const body of [
      'one two three',
      '- one\n- two',
      '# A title\n\nSome prose under it.',
      'before\n\n```ts\nconst a = 1\n```\n\nafter',
      '==marked words== and ++underlined ones++',
      '![x](https://example.com/p.jpg) beside some words',
    ]) {
      expect({ body, words: countWords(body) }).toEqual({ body, words: wordCount(body) })
      expect({ body, mins: readMinutes(countWords(body)) })
        .toEqual({ body, mins: readingMinutes(body) })
    }
  })
})

describe('how long it takes to read', () => {
  it('never says nothing', () => {
    expect(readMinutes(0)).toBe(1)
    expect(readMinutes(3)).toBe(1)
  })

  it('rounds to the nearest minute', () => {
    // 200 words a minute, which is `utils.ts`'s WORDS_PER_MINUTE. This file used to divide by
    // 220 and was the reason the sheet and the page printed different numbers.
    expect(readMinutes(200)).toBe(1)
    expect(readMinutes(300)).toBe(2)
    expect(readMinutes(2000)).toBe(10)
  })
})
