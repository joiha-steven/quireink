// The rail's three states are three media ranges, and the middle one is the newest: a band
// under the title from 60rem to the rail breakpoint, where before there was only a drawer.
import { describe, expect, it } from 'bun:test'
import { articleBandCss, DEFAULT_RAIL_WIDTH, railLookCss, singleRailCss } from '@/render/rail-css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { PUBLIC_CSS } from '@/web/public.css'

describe('singleRailCss', () => {
  it('emits the band between 60rem and the gutter breakpoint, computed from the column', () => {
    const css = singleRailCss(672)
    // 672 + 2 * (250 + 40 + 10)
    expect(css).toContain('@media (min-width:1272px){')
    expect(css).toContain('@media (min-width:60rem) and (max-width:1271px){')
    expect(css.indexOf('max-width:1271px')).toBeLessThan(css.indexOf('min-width:1272px'))
  })

  it('lays out the ARTICLE rail in flow there, and leaves every other rail alone', () => {
    const band = singleRailCss(672).split('@media (min-width:1272px)')[0]!
    expect(band).toContain('.toc summary{pointer-events:auto;cursor:pointer')
    expect(band).toContain('.rail-toc{position:static')
    // `.rail` bare would take the listing's rail with it, and a listing writes its rail LAST
    // inside <main>: in flow that puts the menu, the categories and the tags at the foot of
    // the page. Measured at 1180px on 2026-09-16: the rail began at y=2729 of 3601.
    expect(band).not.toMatch(/`\.rail\{|\.rail \w/)
    // The button is NOT hidden here any more: the listing still opens a drawer with it up to
    // the breakpoint. The article shell hides it on its own pages.
    expect(band).not.toContain('.rail-toggle')
    expect(articleBandCss(672)).toBe(
      '@media (min-width:60rem) and (max-width:1271px){.rail-toggle,.rail-scrim{display:none}}')
  })

  it('marks the heading it INVENTS, so the band has one register and not two', () => {
    // The menu has no heading in the markup and takes one here from its own aria-label. The
    // IDE chrome marks chrome headings with a comment slash, and it does that in `ide.css.ts`
    // against `.rail h2::before` — which this heading is not, and whose ::before is already
    // carrying the label. So the marker has to be restated here or it is simply absent:
    // measured at 1180 on 2026-09-12, the menu's title stood bare directly above a marked
    // "// Contents".
    const band = singleRailCss(672).split('@media (min-width:1272px)')[0]!
    expect(band).toContain('.rail-inner > nav:not(.toc)::before{content:attr(aria-label)')
    // The dialect's own version of the same marker moved out of the geometry on 2026-09-16,
    // because the geometry is cached for every blog and this rule belongs to one look.
    expect(band).not.toContain('data-look=code')
    expect(railLookCss(672, 'code'))
      .toContain('html[data-look=code] .rail-inner > nav:not(.toc)::before{content:"// " attr(aria-label)}')
  })

  it('sets the index as a column and the menu as a row, which is what each of them is', () => {
    // Both were a wrapped row of words. That is right for five one-word menu links and wrong
    // for an index, whose entries are sentences: measured at 1180 on 2026-09-12, two of them
    // shared a line with 24px between, and the IDE chrome's number sat in that gap so the
    // only thing dividing one entry from the next was a digit. `max-content` keeps each entry
    // hugging its own words, which is what keeps the current-row underline off the empty half
    // of the line and the number beside the entry it counts.
    const band = singleRailCss(672).split('@media (min-width:1272px)')[0]!
    expect(band).toContain('.rail-toc ul{display:flex;flex-wrap:wrap')
    expect(band).toContain('.toc ul{display:block}')
    expect(band).toContain('.toc li{width:max-content;max-width:100%')
    // And no line numbers wedged between two menu words, where there is no gutter to hold them.
    expect(railLookCss(672, 'code'))
      .toContain('html[data-look=code] .rail-inner > nav:not(.toc) li::before{content:none}')
  })

  it('hands the dialect nothing to the three looks that did not ask', () => {
    // These two rules shipped to every blog on every page view until 2026-09-16, inline,
    // whatever it was wearing. `looks.test.ts` holds the same rule for the cached sheet.
    for (const look of ['plain', 'paper', 'notes']) expect(railLookCss(672, look)).toBe('')
  })

  it("keeps the band's own bound, so the dialect stops where the band stops", () => {
    // A moved column moves the breakpoint, and a look correction outside its band would sit
    // over the gutter layout instead of the row.
    expect(railLookCss(672, 'code')).toContain('max-width:1271px')
    expect(railLookCss(900, 'code')).toContain('max-width:1499px')
  })
})

describe('the default geometry lives in the cached sheet', () => {
  it('names the same width the settings default does', () => {
    // Two copies of one number. `public.css.ts` precomputes the rail for DEFAULT_RAIL_WIDTH
    // and `layout.ts` skips the inline copy when the owner has not moved the column; if the
    // settings default moved and this did not, every install would pay BOTH copies and the
    // cached one would be wrong.
    expect(DEFAULT_RAIL_WIDTH).toBe(DEFAULT_SETTINGS.contentWidth)
  })

  it('the sheet carries it, so a default page does not have to', () => {
    expect(PUBLIC_CSS).toContain(singleRailCss(DEFAULT_RAIL_WIDTH))
  })

  it('sits after the rule that sizes the same button, because the two are a tie', () => {
    // `.rail-toggle{display:none}` above the breakpoint and `.icon-btn{display:flex}` in
    // `book.css.ts` are one class each, so the only thing that puts the drawer button away
    // on a desktop is that the geometry comes LATER in the sheet. Inline in the page it
    // always did. Moved into the sheet on 2026-09-16 it landed right after `RAIL_CSS`, 130
    // rules ahead of the sizing, and lost the tie: measured at 1440px on a blog running the
    // default column, the button computed `display:flex` beside a rail already in the gutter,
    // and the source-code look draws a word next to every control, so it read `[menu]`.
    const geometry = PUBLIC_CSS.indexOf(singleRailCss(DEFAULT_RAIL_WIDTH))
    const sizing = PUBLIC_CSS.indexOf('.icon-btn{display:flex')
    expect(sizing).toBeGreaterThan(-1)
    expect(geometry).toBeGreaterThan(sizing)
  })

  it('a moved column still gets its own, and it differs', () => {
    const moved = singleRailCss(900)
    expect(moved).not.toBe(singleRailCss(DEFAULT_RAIL_WIDTH))
    expect(PUBLIC_CSS).not.toContain(moved)
  })
})
