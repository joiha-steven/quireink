// The editor's half of the image-placement grammar, against the renderer's half.
//
// These two read the SAME fragment — `image-frag.ts` while you are writing, `render/figures.ts`
// when you publish — and nothing but agreement makes them one grammar. They have disagreed
// before: the editor used to test the fragment as a SUBSTRING, so `#bright` on some imported
// URL made the editor draw a right-aligned picture the page drew centred, and neither side
// threw. So the shape of this file is a round trip (what is written comes back) plus a set of
// cases where the two halves have to answer the same.
import { describe, expect, it } from 'bun:test'
import { buildSrc, framed, parseFrag } from './image-frag'
import { imgClasses } from '@/render/figures'

const round = (src: string): string => {
  const f = parseFrag(src)
  return buildSrc(f.clean, f)
}

describe('reading a fragment', () => {
  it('has silence as a third value, distinct from every explicit one', () => {
    // '' is not `asis`, not `cap`, not `none`: it means this picture follows Settings. It is
    // what an imported archive carries, and losing the way back to it pins a picture forever.
    const bare = parseFrag('/u/a.jpg#grid')
    expect(bare.ratio).toBe('')
    expect(bare.caption).toBe('')
    expect(bare.weight).toBe('')
    expect(bare.ink).toBe('')
    expect(parseFrag('/u/a.jpg#grid-asis').ratio).toBe('asis')
    expect(parseFrag('/u/a.jpg#grid-cap').caption).toBe('cap')
    expect(parseFrag('/u/a.jpg#noframe').weight).toBe('none')
  })

  it('matches whole tokens, never substrings', () => {
    // `#bright` contains "right" and must not align anything. This is the bug, pinned.
    expect(parseFrag('/u/a.jpg#bright').align).toBe('center')
    expect(parseFrag('/u/a.jpg#right').align).toBe('right')
    // ...and the same trap on the other three words.
    expect(parseFrag('/u/a.jpg#hybrid').grid).toBe(false)
    expect(parseFrag('/u/a.jpg#widescreen').size).toBe('')
    expect(parseFrag('/u/a.jpg#unframed').weight).toBe('')
  })

  it('widens last when a fragment asks for both sizes', () => {
    expect(parseFrag('/u/a.jpg#third-wide').size).toBe('wide')
    expect(parseFrag('/u/a.jpg#wide-third').size).toBe('wide')
  })

  it('ignores a thickness or an ink with no frame beside it', () => {
    // A stray `#thick` on an imported URL must not frame anything, and `#ink` alone must not
    // colour a mat that is not there.
    expect(parseFrag('/u/a.jpg#thick').weight).toBe('')
    expect(parseFrag('/u/a.jpg#ink').ink).toBe('')
    expect(parseFrag('/u/a.jpg#frame-thick').weight).toBe('thick')
    expect(parseFrag('/u/a.jpg#frame-ink').ink).toBe('ink')
  })

  it('keeps a plain url plain', () => {
    const f = parseFrag('/u/a.jpg')
    expect(f.clean).toBe('/u/a.jpg')
    expect(f.grid).toBe(false)
    expect(f.align).toBe('center')
    expect(buildSrc(f.clean, f)).toBe('/u/a.jpg')
  })
})

describe('writing a fragment back', () => {
  for (const src of [
    '/u/a.jpg',
    '/u/a.jpg#left',
    '/u/a.jpg#right-third',
    '/u/a.jpg#wide',
    '/u/a.jpg#noframe',
    '/u/a.jpg#frame-paper',
    '/u/a.jpg#frame-thin-ink',
    '/u/a.jpg#frame-thick-paper',
    '/u/a.jpg#grid',
    '/u/a.jpg#grid-1x1',
    '/u/a.jpg#grid-3x2-nocap',
    '/u/a.jpg#grid-4x3-cap-frame-ink',
  ]) {
    it(`comes back as it went in: ${src}`, () => {
      expect(round(src)).toBe(src)
    })
  }

  it('drops align and size when the picture joins a gallery', () => {
    // `grid` is exclusive: the grid lays the tile out, so carrying `right-third` along would
    // leave a token the renderer reads on a shape where it means nothing.
    const f = parseFrag('/u/a.jpg#right-third')
    expect(buildSrc(f.clean, { ...f, grid: true })).toBe('/u/a.jpg#grid')
  })

  it('carries the frame across both shapes', () => {
    // A gallery of framed tiles is a real thing to want; the grid still owns the layout.
    const f = parseFrag('/u/a.jpg#frame-thin-ink')
    expect(buildSrc(f.clean, { ...f, grid: true })).toBe('/u/a.jpg#grid-frame-thin-ink')
  })

  it('calls a mat a mat only when one is drawn', () => {
    expect(framed('')).toBe(false)
    expect(framed('none')).toBe(false)
    expect(framed('thin')).toBe(true)
    expect(framed('frame')).toBe(true)
    expect(framed('thick')).toBe(true)
  })
})

describe('the editor and the renderer read one grammar', () => {
  // `imgClasses` is what the published page puts on the figure. The editor does not use the
  // same string — it styles a writing surface, not a page — but the two must AGREE about what
  // the fragment said, and that is what this asserts.
  for (const [src, page] of [
    ['/u/a.jpg', 'img-center'],
    ['/u/a.jpg#left', 'img-left'],
    ['/u/a.jpg#right', 'img-right'],
    ['/u/a.jpg#third', 'img-center img-third'],
    ['/u/a.jpg#left-third', 'img-left img-third'],
    ['/u/a.jpg#wide', 'img-center img-wide'],
    ['/u/a.jpg#bright', 'img-center'],
  ] as const) {
    it(`agrees about ${src}`, () => {
      const f = parseFrag(src)
      const cls = imgClasses(src.split('#')[1] ?? '')
      expect(cls).toBe(page)
      expect(cls.includes('img-left')).toBe(f.align === 'left')
      expect(cls.includes('img-right')).toBe(f.align === 'right')
      expect(cls.includes('img-third')).toBe(f.size === 'third')
      expect(cls.includes('img-wide')).toBe(f.size === 'wide')
    })
  }
})
