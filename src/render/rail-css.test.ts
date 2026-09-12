// The rail's three states are three media ranges, and the middle one is the newest: a band
// under the title from 60rem to the rail breakpoint, where before there was only a drawer.
import { describe, expect, it } from 'bun:test'
import { singleRailCss } from '@/render/rail-css'

describe('singleRailCss', () => {
  it('emits the band between 60rem and the gutter breakpoint, computed from the column', () => {
    const css = singleRailCss(672)
    // 672 + 2 * (250 + 40 + 10)
    expect(css).toContain('@media (min-width:1272px){')
    expect(css).toContain('@media (min-width:60rem) and (max-width:1271px){')
    expect(css.indexOf('max-width:1271px')).toBeLessThan(css.indexOf('min-width:1272px'))
  })

  it('lets the index fold only in the band, and puts the drawer button away there', () => {
    const band = singleRailCss(672).split('@media (min-width:1272px)')[0]!
    expect(band).toContain('.toc summary{pointer-events:auto;cursor:pointer')
    expect(band).toContain('.rail-toggle,.rail-scrim{display:none}')
    expect(band).toContain('.rail{position:static')
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
    expect(band).toContain('html[data-ide-chrome=on] .rail-inner > nav:not(.toc)::before{content:"// " attr(aria-label)}')
  })

  it('sets the index as a column and the menu as a row, which is what each of them is', () => {
    // Both were a wrapped row of words. That is right for five one-word menu links and wrong
    // for an index, whose entries are sentences: measured at 1180 on 2026-09-12, two of them
    // shared a line with 24px between, and the IDE chrome's number sat in that gap so the
    // only thing dividing one entry from the next was a digit. `max-content` keeps each entry
    // hugging its own words, which is what keeps the current-row underline off the empty half
    // of the line and the number beside the entry it counts.
    const band = singleRailCss(672).split('@media (min-width:1272px)')[0]!
    expect(band).toContain('.rail ul{display:flex;flex-wrap:wrap')
    expect(band).toContain('.toc ul{display:block}')
    expect(band).toContain('.toc li{width:max-content;max-width:100%')
    // And no line numbers wedged between two menu words, where there is no gutter to hold them.
    expect(band).toContain('html[data-ide-chrome=on] .rail-inner > nav:not(.toc) li::before{content:none}')
  })
})
