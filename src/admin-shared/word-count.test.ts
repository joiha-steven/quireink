// The number in the sheet's small print. It counts Markdown, and Markdown is not prose.
import { describe, expect, it } from 'bun:test'
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

  it('counts a link by what a reader reads', () => {
    expect(countWords('[the docs](https://example.com)')).toBe(3)
  })
})

describe('how long it takes to read', () => {
  it('never says nothing', () => {
    expect(readMinutes(0)).toBe(1)
    expect(readMinutes(3)).toBe(1)
  })

  it('rounds to the nearest minute', () => {
    expect(readMinutes(220)).toBe(1)
    expect(readMinutes(330)).toBe(2)
    expect(readMinutes(2200)).toBe(10)
  })
})
