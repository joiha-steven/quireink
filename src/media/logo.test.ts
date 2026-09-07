// The header's logo, and the twin the newsletter sends.
//
// This exists because the derivation was silently dead. `logoUrl` comes out of the media
// library as `/uploads/media/…`, `safeFetch` calls `new URL()` on it, and a relative path
// throws there — so `renderLogo` caught, returned null, and every install that picked a logo
// stored an empty `logoRenderUrl`. Nothing failed, nothing logged: the header just served
// the untouched original and the newsletter masthead fell back to text.
import { describe, it, expect, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { uploadFile } from '@/media/blob'
import { renderLogo } from '@/media/files'

const DIR = './.tmp/test-logo'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const rectangle = async (w: number, h: number): Promise<Buffer> => {
  const { default: sharp } = await import('sharp')
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } })
    .png().toBuffer()
}

describe('renderLogo', () => {
  it('derives a display copy and an email twin from a logo on the store', async () => {
    const url = await uploadFile('media/brand.png', await rectangle(600, 200), 'image/png')
    expect(url.startsWith('/uploads/')).toBe(true) // relative: the shape that used to throw

    const made = await renderLogo(url, 120)
    expect(made).not.toBeNull()
    expect(made!.url).toMatch(/^\/uploads\/files\/logo-\d+\.webp$/)
    // Outlook on Windows cannot render WebP, so the newsletter gets a PNG or nothing.
    expect(made!.emailUrl).toMatch(/^\/uploads\/files\/logo-\d+-mail\.png$/)
    // The height is what reserves the space in the header, so it has to be the real ratio.
    expect(made!.height).toBe(40)
  })

  it('leaves a vector alone, because there is nothing to downscale', async () => {
    const url = await uploadFile('media/mark.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')
    expect(await renderLogo(url, 120)).toBeNull()
  })

  it('answers null rather than throwing when the file is not on the store', async () => {
    expect(await renderLogo('/uploads/media/not-here.png', 120)).toBeNull()
    expect(await renderLogo('', 120)).toBeNull()
  })
})
