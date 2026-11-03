// The Medium reader finds its title, date and body in time that grows with the file, not with its
// square. Each of its regexes rescanned to the end from every place the tag could start, so a post
// file shaped for it held the one process for seconds: 100 KB of `<` in the title took 5.1 s, and
// 400 KB of unclosed `<title>` 10 s, while an entry may be 64 MiB (2026-11-04).
import { describe, expect, it } from 'bun:test'
import { parseMedium } from './archive'

const NOW = '2026-01-01T00:00:00.000Z'
const SIZE = 200_000
const read = (text: string) => parseMedium([{ name: 'posts/x.html', text }], NOW).posts[0]!

/** One shape per pattern the reader looks for, each the start of a tag that never ends or closes. */
const SHAPES: Record<string, string> = {
  'an h1 that never closes, again and again': '<div class="h-entry">' + '<h1 class="p-name">x'.repeat(SIZE / 21),
  'an h1 whose attributes never end': '<div class="h-entry"><h1 ' + 'class="p-name '.repeat(SIZE / 14),
  'a time tag whose attributes never end': '<div class="h-entry"><time ' + 'class="dt-published" '.repeat(SIZE / 21),
  'a body section that never closes, again and again': '<div class="h-entry">' + '<section data-field="body">x'.repeat(SIZE / 28),
  'a title of nothing but <': '<div class="h-entry"><h1 class="p-name">' + '<'.repeat(SIZE) + '</h1>',
  'a title tag that never closes, again and again': '<div class="h-entry">' + '<title>'.repeat(SIZE / 7),
}

describe('the Medium reader on a file shaped against it', () => {
  for (const [name, text] of Object.entries(SHAPES)) {
    it(`reads ${name} (200 KB) in well under a second`, () => {
      const started = performance.now()
      read(text)
      expect(performance.now() - started).toBeLessThan(250)
    })
  }
})

describe('the Medium reader on ordinary markup', () => {
  it('takes the p-name heading among other headings and classes, tags stripped', () => {
    const post = read(`<article class="h-entry"><h1 class="graf">Not it</h1>
<h1 data-x="1" class="graf graf--h3 p-name">A <em>quiet</em> walk</h1>
<time class="dt-published" datetime="2024-06-01T10:00:00.000Z">x</time>
<section class="e-content" data-field="body"><h3>A quiet walk</h3><p>Body.</p></section></article>`)
    expect(post.title).toBe('A quiet walk')
    expect(post.date).toBe('2024-06-01T10:00:00.000Z')
    expect(post.content).toBe('Body.')
  })

  it('falls back to the <title>, and takes the first p-name that closes', () => {
    expect(read('<div class="h-entry"><title>From the head</title><p>x</p>').title).toBe('From the head')
    expect(read('<div class="h-entry"><h1 class="p-name">One</h1><h1 class="p-name">Two</h1>').title).toBe('One')
  })

  it('takes a title too long to build a regex from, and still drops its repeated heading', () => {
    const long = 'a'.repeat(2_100_000)
    const post = read(`<div class="h-entry"><h1 class="p-name">${long}</h1><section data-field="body"><h3>${long}</h3><p>Body.</p></section>`)
    expect(post.title).toHaveLength(long.length)
    expect(post.content).toBe('Body.')
  })

  it('strips a tag split around another the way the old pass did', () => {
    expect(read('<div class="h-entry"><h1 class="p-name">a<scr<b>ipt>b</h1>').title).toBe('aipt>b')
  })

  it('reads a time whose datetime comes after other attributes, and none from another tag', () => {
    const t = (s: string) => read(`<div class="h-entry"><h1 class="p-name">T</h1>${s}`)
    expect(t('<time class="dt-published" title="x" datetime="2024-06-01T10:00:00.000Z">').date).toBe('2024-06-01T10:00:00.000Z')
    const draft = t('<time class="dt-published">x</time><span datetime="2024-06-01T10:00:00.000Z">')
    expect(draft.status).toBe('draft')
  })
})
