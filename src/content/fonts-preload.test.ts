// WHICH faces go in the head, and the rule that decides.
//
// This file exists because the rule was read off the default instead of being written down.
// `fontPreloadHrefs` preloaded any chrome face that had a file, which was correct while the
// default chrome face was JetBrains Mono: a monospace has no metric-matched system twin, so
// the header, the meta line and both rails move when it lands. On 2026-09-13 the default
// became Inter, which DOES have twins, and nothing moved with it. From that day a fresh
// install preloaded 33,256 bytes it barely paints a glyph in, and the comment in
// `fontPreloadHrefs` had already priced that same mistake at 160ms of LCP.
//
// Nothing was red. The tests that touch chrome fonts assert the CSS stack, not the head.
import { describe, expect, test } from 'bun:test'
import { CHROME_FONTS, DEFAULT_CHROME_FONT, fontPreloadHrefs } from '@/content/fonts'

const READING = '/fonts/literata-latin.woff2'
const preloads = (chromeFont: string, lang = 'en', look = 'plain'): string[] =>
  fontPreloadHrefs('literata', lang, false, chromeFont, look)

describe('the head carries the faces whose absence would move the page', () => {
  test('a fresh install preloads the reading face and nothing else', () => {
    // The number this pins: 40,556 bytes, not the 73,812 a default install paid between
    // 2026-09-13 and 2026-09-16.
    expect(preloads(DEFAULT_CHROME_FONT)).toEqual([READING])
  })

  test('a monospace chrome face IS preloaded, which is what bought the exception', () => {
    expect(preloads('jetbrains-mono')).toEqual([READING, '/fonts/jetbrainsmono-latin.woff2'])
    expect(preloads('plex-mono')).toEqual([READING, '/fonts/plexmono-400-latin.woff2'])
  })

  test('a chrome face with a metric-matched fallback is not', () => {
    // Inter declares Arial at size-adjust 104.38% and Roboto at 105.4% in `font-faces.ts`,
    // so the swap moves nothing and the bytes buy nothing.
    expect(preloads('inter')).toEqual([READING])
  })

  test('the reading face as the chrome face is not preloaded twice', () => {
    expect(preloads('reading')).toEqual([READING])
  })

  test('an id nobody offers preloads nothing extra', () => {
    // `getChromeFont` falls back to Inter for an unknown id, which is right for the stack and
    // wrong for the head. This is the case the 160ms was measured on.
    expect(preloads('zzz')).toEqual([READING])
  })

  test('every face marked for preload has a file to preload', () => {
    // Two lists of the same filenames is how a preload ends up pointing at a 404. A face that
    // claims `preload` and carries no slug would silently preload nothing.
    for (const face of CHROME_FONTS) {
      if (face.preload) expect({ id: face.id, slug: face.slug }).toEqual({ id: face.id, slug: face.slug as string })
      if (face.preload) expect(typeof face.slug).toBe('string')
    }
  })

  test('the rule is a property of the face, not of which one is default', () => {
    // The regression this file is named for: moving the default must not move the head.
    // Every face answers the same way whether or not it happens to be the default today.
    for (const face of CHROME_FONTS) {
      const got = preloads(face.id)
      const expected = face.preload && face.slug
        ? [READING, `/fonts/${face.slug}-latin.woff2`]
        : [READING]
      expect({ id: face.id, got }).toEqual({ id: face.id, got: expected })
    }
  })
})
