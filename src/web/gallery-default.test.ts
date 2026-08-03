// The site-wide gallery default reaching the page.
//
// It is emitted as CSS rather than baked into the rendered HTML, and that is the whole
// reason this file exists: rendered Markdown is cached under a hash of its input, so a
// default that changed the MARKUP would leave every already-rendered body serving the old
// shape until something unrelated evicted it. These tests pin the seam that keeps the two
// apart, and the override order that makes a per-gallery choice win.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { sanitizeGallery, DEFAULT_GALLERY } from '@/content/settings-sanitize'
import type { GallerySettings } from '@/types'

const DIR = './.tmp/test-gallery'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const styles = (gallery: GallerySettings) => pageStyles({ ...DEFAULT_SETTINGS, gallery })

describe('the site-wide gallery default', () => {
  it('emits nothing at all when it matches what a gallery always did', () => {
    const css = styles(DEFAULT_GALLERY)
    expect(css).not.toContain('--gallery-ratio')
    expect(css).not.toContain('--gallery-cap')
  })

  it('emits the ratio AND the width together', () => {
    // A cropped tile has to fill its cell. Emitting the ratio alone leaves the photo at its
    // natural width inside a box of the right shape, which looks like a bug in the crop.
    const css = styles({ ratio: '4x3', captions: true })
    expect(css).toContain('--gallery-ratio:4/3')
    expect(css).toContain('--gallery-w:100%')
  })

  it('hides captions without touching the ratio', () => {
    const css = styles({ ratio: '', captions: false })
    expect(css).toContain('--gallery-cap:none')
    expect(css).not.toContain('--gallery-ratio')
  })

  it('reads the variables in the sheet, with the old behaviour as the fallback', () => {
    // The fallbacks are what makes an untouched site render byte-identically: `auto` for
    // both shape and width, captions shown.
    expect(PUBLIC_CSS).toContain('aspect-ratio:var(--gallery-ratio,auto)')
    expect(PUBLIC_CSS).toContain('width:var(--gallery-w,auto)')
    expect(PUBLIC_CSS).toContain('display:var(--gallery-cap,block)')
  })

  it('lets a gallery overrule the site default', () => {
    // Specificity, not source order: the site default lands on :root and the override on the
    // tile, so the tile wins wherever the two disagree. If this ever inverts, a site default
    // would quietly overrule every gallery that had been set by hand.
    for (const cls of ['.gallery .g-asis', '.gallery .g-1x1', '.gallery .g-cap', '.gallery .g-nocap']) {
      expect(PUBLIC_CSS).toContain(cls)
    }
  })
})

describe('sanitizeGallery', () => {
  it('keeps the four shapes and rejects anything else', () => {
    for (const ratio of ['', '1x1', '3x2', '4x3'] as const) {
      expect(sanitizeGallery({ ratio, captions: true }, DEFAULT_GALLERY).ratio).toBe(ratio)
    }
    expect(sanitizeGallery({ ratio: '16x9' }, DEFAULT_GALLERY).ratio).toBe('')
    expect(sanitizeGallery({ ratio: 3 }, DEFAULT_GALLERY).ratio).toBe('')
  })

  it('falls back rather than throwing on junk', () => {
    expect(sanitizeGallery(null, DEFAULT_GALLERY)).toEqual(DEFAULT_GALLERY)
    expect(sanitizeGallery('nope', DEFAULT_GALLERY)).toEqual(DEFAULT_GALLERY)
    expect(sanitizeGallery({ captions: 'yes' }, DEFAULT_GALLERY).captions).toBe(true)
  })
})
