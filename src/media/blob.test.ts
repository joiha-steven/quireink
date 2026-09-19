import { describe, it, expect } from '@/test/vitest'
import { blobUrl, collapseBlob, expandBlob } from '@/media/blob'

// Binaries are served same-origin under /uploads (the local filesystem store).
const BASE = '/uploads'

describe('blob store-relative refs (collapse <-> expand)', () => {
  it('expands a media pathname into a public /uploads URL', () => {
    expect(expandBlob('media/photo.jpg')).toBe(`${BASE}/media/photo.jpg`)
  })

  it('expands a files pathname (favicon / app icon) too', () => {
    expect(expandBlob('files/favicon-123.ico')).toBe(`${BASE}/files/favicon-123.ico`)
  })

  it('collapses a /uploads URL back to a store-relative pathname', () => {
    expect(collapseBlob(`${BASE}/media/photo.jpg`)).toBe('media/photo.jpg')
  })

  it('collapses a /uploads URL carrying an origin too', () => {
    expect(collapseBlob(`https://example.com${BASE}/media/photo.jpg`)).toBe('media/photo.jpg')
  })

  it('round-trips a bare pathname (collapse after expand is identity)', () => {
    const pathname = 'media/nested/dir/image-1600.avif'
    expect(collapseBlob(expandBlob(pathname))).toBe(pathname)
  })

  it('is idempotent: collapsing an already store-relative string changes nothing', () => {
    expect(collapseBlob('media/photo.jpg')).toBe('media/photo.jpg')
  })

  it('leaves external URLs untouched on expand/collapse', () => {
    const external = 'https://example.com/img/banner.jpg'
    expect(expandBlob(external)).toBe(external)
    expect(collapseBlob(external)).toBe(external)
  })

  it('stores a markdown body with NO origin/prefix after collapse', () => {
    const body = `Look: ![alt](${BASE}/media/a.jpg) and <img src="${BASE}/media/b.png">`
    const stored = collapseBlob(body)
    expect(stored).not.toContain('/uploads/')
    expect(stored).toContain('](media/a.jpg)')
    expect(stored).toContain('src="media/b.png"')
  })

  // Regression: `/uploads/` used to be stripped anywhere it appeared, so a foreign URL
  // with `/uploads/` mid-path lost the segment and pointed at a file that never existed.
  // Every WordPress site serves images from `/wp-content/uploads/`, so importing one
  // corrupted the body of every post that had a picture in it.
  it('leaves a foreign URL whose path merely contains /uploads/ alone', () => {
    const foreign = 'https://example.com/wp-content/uploads/photo.jpg'
    expect(collapseBlob(foreign)).toBe(foreign)
    expect(collapseBlob(`![alt](${foreign})`)).toBe(`![alt](${foreign})`)
    expect(collapseBlob(`<img src="${foreign}">`)).toBe(`<img src="${foreign}">`)
  })

  it('still collapses our own /uploads/ URL when a foreign one sits beside it', () => {
    const body = `![a](https://example.com/wp-content/uploads/x.jpg) ![b](${BASE}/media/b.jpg)`
    const stored = collapseBlob(body)
    expect(stored).toContain('](https://example.com/wp-content/uploads/x.jpg)')
    expect(stored).toContain('](media/b.jpg)')
  })

  it('expands media refs inside markdown link/src/href positions only', () => {
    const body = 'text media/loose.jpg ![x](media/a.jpg) <img src="media/b.png">'
    const out = expandBlob(body)
    // link + src positions are rewritten...
    expect(out).toContain(`](${BASE}/media/a.jpg)`)
    expect(out).toContain(`src="${BASE}/media/b.png"`)
    // ...but a loose mention mid-paragraph is NOT (only positional refs expand).
    expect(out).toContain('text media/loose.jpg ')
  })

  it('blobUrl builds the deterministic public URL', () => {
    expect(blobUrl('media/x.webp')).toBe(`${BASE}/media/x.webp`)
  })
})

describe('a link to an uploaded FILE survives the round trip', () => {
  // ⚠️ THE BUG THIS PINS SHIPPED, and it was silent. `collapseBlob` strips the `/uploads/`
  // prefix from any store path, so `[the sheet](/uploads/files/report.pdf)` was STORED as
  // `](files/report.pdf)` — and `expandBlob` only put `media/` back. What a reader got was a
  // relative href resolved against the post’s own address: `/an-essay/files/report.pdf`,
  // which is not a file. Every download link written into a post was broken on every install.
  //
  // The pair is tested as a ROUND TRIP rather than as two behaviours, because that is the
  // property Invariant 3 actually promises: what goes in comes back out, whatever the store
  // prefix is today.
  const trip = (s: string): string => expandBlob(collapseBlob(s))

  it('brings a markdown link back, for a file and for an image alike', () => {
    expect(trip('See [the sheet](/uploads/files/report.pdf) for more.'))
      .toBe('See [the sheet](/uploads/files/report.pdf) for more.')
    expect(trip('![alt](/uploads/media/photo.jpg)')).toBe('![alt](/uploads/media/photo.jpg)')
  })

  it('brings an href and a src back', () => {
    expect(trip('<a href="/uploads/files/report.pdf">x</a>'))
      .toBe('<a href="/uploads/files/report.pdf">x</a>')
    expect(trip('<img src="/uploads/media/photo.jpg">')).toBe('<img src="/uploads/media/photo.jpg">')
  })

  it('leaves somebody else\u2019s uploads path alone, which is what anchoring is for', () => {
    // The counter-test, and the reason the patterns are anchored at all: every WordPress site
    // serves its pictures from `/wp-content/uploads/…`, and an unanchored rule rewrote imported
    // posts to point at files that do not exist.
    const theirs = 'See [a photo](https://theirs.example/wp-content/uploads/2024/x.jpg).'
    expect(trip(theirs)).toBe(theirs)
  })
})

