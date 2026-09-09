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
})
