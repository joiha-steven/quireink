// What a picture promises the browser about its own size, and what a gallery is on a phone.
//
// Every failure pinned here was found by MEASURING a rendered page rather than by reading
// the markup — which is the point, because the markup was in each case exactly what the code
// meant to write. `sizes="100vw"` on a 167px tile is valid HTML, passes every assertion
// anybody had thought to make, and costs the reader six times the pixels they will see.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { renderPostContent } from '@/render/post-content'
import { galleryCols, editorTileWidth } from '@/render/gallery-cols'
import { MOBILE_CSS } from '@/web/mobile.css'
import { collapseBlob } from '@/media/blob'
import { readFileSync } from 'node:fs'

const DIR = './.tmp/test-figures'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PIC = '/uploads/media/plate.jpg'
const ready = (version: number) => new Map([[collapseBlob(PIC), version]])
const body = (md: string, version = 2) =>
  renderPostContent({ markdown: md, readyOriginals: ready(version) })
const sizesOf = (html: string): string[] =>
  [...html.matchAll(/sizes="([^"]*)"/g)].map((m) => m[1] as string)

describe('what a picture tells the browser about its width', () => {
  it('gives each shape its own answer, instead of one answer for all of them', async () => {
    // The bug: every picture claimed the full column. True of a picture that HOLDS the
    // column and false of the three shapes that do not, so the browser fetched a file sized
    // for a 672px slot to paint a 202px one.
    const column = sizesOf(await body(`![a](${PIC})`))[0]
    const third = sizesOf(await body(`![a](${PIC}#left-third)`))[0]
    const wide = sizesOf(await body(`![a](${PIC}#wide)`))[0]
    expect(column).toContain('672px')
    expect(third).toContain('202px') // 30% of the measure
    expect(wide).toContain('800px') // the measure plus both gutters
    expect(new Set([column, third, wide]).size).toBe(3)
  })

  it('sizes a gallery tile from the COLUMN COUNT, which only exists once the run is grouped', async () => {
    // `buildFigures` sees one image at a time and cannot know it is a tile among four. The
    // count is decided in `groupGalleries`, so that is where the promise is corrected — and
    // a tile that kept the placeholder would be claiming the whole measure again.
    const two = await body(`![a](${PIC}#grid)\n\n![b](${PIC}#grid)`)
    const ten = await body(Array.from({ length: 10 }, () => `![a](${PIC}#grid)`).join('\n\n'))
    expect(two).toContain('gallery-cols-2')
    expect(ten).toContain('gallery-cols-4')
    expect(sizesOf(two)[0]).toContain('332px') // (672 - one 8px gap) / 2
    expect(sizesOf(ten)[0]).toContain('162px') // (672 - three gaps) / 4
    // No tile anywhere still carries the lone-picture promise.
    expect(sizesOf(ten).some((s) => s.includes('672px'))).toBe(false)
    // And the phone half is the same for both, because the phone caps the grid at two.
    for (const s of [...sizesOf(two), ...sizesOf(ten)]) expect(s).toContain('(max-width: 639px) 47vw')
  })

  it('never names a width the original does not have', async () => {
    // A <picture> has NO fallback: if the candidate the browser picks 404s, the image fails
    // rather than dropping back to the <img>. So the day a third width was added, every
    // already-finalised image in every install had to keep being offered its own two.
    const upgraded = await body(`![a](${PIC})`, 2)
    const legacy = await body(`![a](${PIC})`, 1)
    expect(upgraded).toContain('-512.avif 512w')
    expect(legacy).not.toContain('-512')
    expect(legacy).toContain('-1024.avif 1024w')
    // Nothing at all for an original with no variants: a plain <img> always loads.
    const none = await renderPostContent({ markdown: `![a](${PIC})` })
    expect(none).not.toContain('<picture')
  })

  it('re-renders a body when an image gains a width, rather than serving the old srcset', async () => {
    // The body cache is keyed on its INPUT. Keyed on "has variants" alone, an image upgraded
    // from two widths to three would go on serving the two-width markup until something
    // unrelated evicted it.
    const md = `![a](${PIC})\n`
    expect(await body(md, 1)).not.toBe(await body(md, 2))
  })
})

describe('a gallery on a phone', () => {
  it('is capped at two columns, whatever the count chose', () => {
    // Measured at 390px before the cap: a run of five drew 109x72px tiles and a run of ten
    // drew 80x53px. The count rule is right for a desktop and wrong for a 350px measure.
    expect(MOBILE_CSS).toContain('.gallery-cols-3,.gallery-cols-4{grid-template-columns:repeat(2,1fr)}')
    // Inside the phone query, not loose in the sheet — or it would cap every screen.
    const phone = MOBILE_CSS.slice(MOBILE_CSS.indexOf('@media (max-width:639px)'))
    expect(phone.indexOf('.gallery-cols-3')).toBeGreaterThan(-1)
  })
})

describe('the column rule has one home', () => {
  it('answers the same for the renderer and for the editor', () => {
    // Two copies of five lines is how the editor came to lay every gallery out three across
    // while the page used two, three or four: a gallery of four read 3+1 while you wrote it
    // and 2x2 once you published it.
    expect([2, 3, 4, 5, 9, 10].map(galleryCols)).toEqual([2, 3, 2, 3, 3, 4])
    // The editor's tile is that share of the row, less the margin its own rule adds.
    expect(editorTileWidth(2)).toBe('48.5%')
    expect(editorTileWidth(3)).toBe('31.8%')
    expect(editorTileWidth(4)).toBe('23.5%')
  })

  it('holds the editor sheet to those numbers, since CSS cannot import them', () => {
    // The width belongs to the node view's PARENT, which React cannot style, so it is a
    // rule in `admin.css` keyed on the count the node view writes as an attribute. That
    // makes the numbers a copy — and a copy of a layout rule is exactly what let the editor
    // and the page disagree for a year. This is the seam that stops it happening twice.
    const css = readFileSync('src/admin/admin.css', 'utf8')
    for (const cols of [2, 3, 4]) {
      expect(css).toContain(`figure[data-cols="${cols}"]) { width: ${editorTileWidth(cols)}; }`)
    }
  })
})
