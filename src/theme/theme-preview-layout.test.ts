// `theme:preview`'s layout checks (scripts/theme-preview-layout.ts), fed measurements written by
// hand: what is a finding, and what the page does on purpose and must not be reported.
import { describe, expect, it } from 'bun:test'
import { layoutFindings, type ClipBox, type EdgeBox, type Measurement } from '../../scripts/theme-preview-layout'
import { groupFindings, indexHtml, reportText, type ShotRecord } from '../../scripts/theme-preview-report'

const clean: Measurement = { viewport: 375, scrollWidth: 375, theme: 'broadsheet', edges: [], clips: [], brokenImages: [], failedFonts: [], brokenWords: [] }
const edge = (over: Partial<EdgeBox> = {}): EdgeBox => ({
  where: 'article > div#post-body.prose', left: 0, right: 420, width: 420, height: 300,
  insideClip: false, parentPast: false, clipped: false, ...over,
})
const clip = (over: Partial<ClipBox> = {}): ClipBox => ({
  where: 'main > div.post-list', overBy: 120, clientWidth: 343, clientHeight: 200,
  lineClamp: 'none', textOverflow: 'clip', clipped: false, text: 'March 11, 2026', ...over,
})
const kinds = (m: Partial<Measurement>) => layoutFindings({ ...clean, ...m }).map((f) => f.kind)

describe('layoutFindings', () => {
  it('finds nothing on a page that fits', () => {
    expect(layoutFindings(clean)).toEqual([])
  })

  it('reports a document wider than the viewport, with both widths', () => {
    const found = layoutFindings({ ...clean, scrollWidth: 747 })
    expect(found).toEqual([{ kind: 'overflow', detail: 'the page is 747px wide in a 375px viewport' }])
  })

  it('does not report sub-pixel rounding as overflow', () => {
    expect(kinds({ scrollWidth: 376 })).toEqual([])
  })

  it('reports a box past the right edge, and one past the left edge', () => {
    const found = layoutFindings({ ...clean, edges: [edge(), edge({ where: 'nav.menu', left: -40, right: 200 })] })
    expect(found).toEqual([
      { kind: 'past-edge', detail: 'article > div#post-body.prose reaches 45px past the right edge' },
      { kind: 'past-edge', detail: 'nav.menu reaches 40px past the left edge' },
    ])
  })

  it('leaves alone a box inside one that scrolls or clips, the children of a reported box, and the visually-hidden pattern', () => {
    expect(kinds({ edges: [
      edge({ insideClip: true }),
      edge({ parentPast: true }),
      edge({ clipped: true }),
      edge({ width: 1, height: 1 }),
    ] })).toEqual([])
  })

  it('reports text cut by a box that hides overflow, with what is cut', () => {
    expect(layoutFindings({ ...clean, clips: [clip()] })).toEqual([
      { kind: 'clipped-text', detail: 'main > div.post-list cuts 120px of "March 11, 2026"' },
    ])
  })

  it('leaves alone truncation the engine means: line-clamp, an ellipsis, a 1px hidden box, a pixel of rounding', () => {
    expect(kinds({ clips: [
      clip({ lineClamp: '3' }),
      clip({ textOverflow: 'ellipsis' }),
      clip({ clientWidth: 1, clientHeight: 1 }),
      clip({ clipped: true }),
      clip({ overBy: 1 }),
    ] })).toEqual([])
  })

  it('reports every broken image and every face that failed to load', () => {
    const found = layoutFindings({ ...clean, brokenImages: ['/themes/abc/images/a.png'], failedFonts: ['theme-broad-text 400 normal'] })
    expect(found).toEqual([
      { kind: 'broken-image', detail: '/themes/abc/images/a.png did not load' },
      { kind: 'font-failed', detail: 'theme-broad-text 400 normal failed to load' },
    ])
  })

  it('reports a word split across two lines, showing where it splits', () => {
    expect(layoutFindings({ ...clean, brokenWords: [{ where: 'div.card > p.card-exc', word: 'impressions', split: 10 }] })).toEqual([
      { kind: 'broken-word', detail: 'div.card > p.card-exc splits "impressions" as "impression / s"' },
    ])
  })

  it('does not report a split that leaves the whole word on one side', () => {
    expect(kinds({ brokenWords: [{ where: 'p', word: 'word', split: 0 }, { where: 'p', word: 'word', split: 4 }] })).toEqual([])
  })
})

describe('the report', () => {
  const page = { id: 'post-all-blocks', path: '/matrix-every-block', home: 'list' as const }
  const shot = (scheme: string, findings: ShotRecord['findings']): ShotRecord =>
    ({ file: `post-all-blocks__default__375__${scheme}.png`, page, palette: null, width: 375, scheme, status: 200, findings })
  const info = { themeId: 'broadsheet', version: '1.0.0', name: 'Broad <sheet>', seconds: 7, clock: '2026-07-30T17:00:00.000Z' }
  const wide = { kind: 'overflow' as const, detail: 'the page is 747px wide in a 375px viewport' }

  it('says a finding once for light and dark, naming both', () => {
    const grouped = groupFindings([shot('light', [wide]), shot('dark', [wide])])
    expect(grouped).toEqual([{ page: 'post-all-blocks', width: 375, kind: 'overflow', detail: wide.detail, where: ['light', 'dark'] }])
    expect(reportText(info, [shot('light', [wide]), shot('dark', [wide])])).toContain(
      'post-all-blocks @ 375px [light, dark] overflow · the page is 747px wide in a 375px viewport')
  })

  it('says once under the list what splits a word, however many were split', () => {
    const split = { kind: 'broken-word' as const, detail: 'p.card-exc splits "impressions" as "impression / s"' }
    const text = reportText(info, [shot('light', [split, { ...split, detail: 'h2 splits "matter" as "mat / ter"' }])])
    expect(text.split('broken-word: A word is split across two lines with no hyphen.')).toHaveLength(2)
    expect(reportText(info, [shot('light', [wide])])).not.toContain('broken-word:')
  })

  it('says so when there is nothing to report', () => {
    expect(reportText(info, [shot('light', [])])).toContain('no layout findings')
  })

  it('groups the contact sheet by page, links every shot, lists findings, and escapes what the author wrote', () => {
    const html = indexHtml(info, [shot('light', [wide]), shot('dark', [])])
    expect(html).toContain('<section id="post-all-blocks">')
    expect(html).toContain('href="post-all-blocks__default__375__light.png"')
    expect(html).toContain('href="post-all-blocks__default__375__dark.png"')
    expect(html).toContain('<b>overflow</b>')
    expect(html).toContain('Broad &lt;sheet&gt;')
    expect(html).not.toContain('Broad <sheet>')
  })
})
