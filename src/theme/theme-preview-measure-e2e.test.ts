// The in-page half of `theme:preview`'s layout checks (MEASURE in scripts/theme-preview-layout.ts),
// in a real browser on a planted page: each fault it exists to find is found, and each thing a
// page does on purpose is not. Needs a headless Chrome, so it runs only when asked:
//
//   THEME_PREVIEW_E2E=1 bun test src/theme/theme-preview-measure-e2e.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Browser } from '../../scripts/theme-matrix-browser'
import { CLOCK_ISO, defaultBrowser } from '../../scripts/theme-matrix-instance'
import { asMeasurement, layoutFindings, MEASURE, type LayoutFinding } from '../../scripts/theme-preview-layout'

const enabled = process.env.THEME_PREVIEW_E2E === '1'
const LONG = 'a long line of words that cannot fit in the narrow box it was given'

const PAGE = `<!doctype html><html lang="en" data-theme="planted"><head><meta charset="utf-8"><style>
@font-face{font-family:'planted-missing';src:url('/missing.woff2') format('woff2')}
@font-face{font-family:'planted-local';src:local('No Such Face Anywhere 7f3a')}
body{margin:0;font:16px/1.4 sans-serif}
.wide{width:600px;height:20px}
.cut{width:100px;height:22px;overflow:hidden;white-space:nowrap}
.skip{position:absolute;left:-9999px}
.scroller{width:200px;overflow-x:auto}.scroller div{width:900px}
.clamp{width:100px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.ellipsis{width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pages{width:200px;height:44px;overflow:hidden}.pages div{columns:1;column-fill:auto;height:44px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.chips{width:150px;overflow-x:auto;overflow-y:hidden;white-space:nowrap}
</style></head><body>
<a class="skip" href="#main">Skip to the content</a>
<div class="wide">wide</div>
<div class="cut">${LONG}</div>
<div class="scroller"><div>${LONG}</div></div>
<div class="clamp">${LONG} ${LONG}</div>
<div class="ellipsis">${LONG}</div>
<div class="pages"><div>${LONG} ${LONG} ${LONG} ${LONG} ${LONG} ${LONG}</div></div>
<span class="sr">${LONG}</span>
<nav class="chips">${LONG}</nav>
<img src="/missing.png" alt="missing" width="20" height="20">
<p style="font-family:planted-missing">missing face</p>
<p style="font-family:planted-local">local face</p>
</body></html>`

describe.skipIf(!enabled)('MEASURE in a real browser', () => {
  let server: ReturnType<typeof Bun.serve> | undefined
  let browser: Browser | undefined
  let found: LayoutFinding[] = []
  let theme = ''

  beforeAll(async () => {
    server = Bun.serve({
      port: 0, hostname: '127.0.0.1',
      fetch: (req) => new URL(req.url).pathname === '/'
        ? new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
        : new Response('not here', { status: 404 }),
    })
    defaultBrowser()
    browser = await Browser.open(CLOCK_ISO)
    await browser.setup(375, 'light')
    await browser.shoot(`http://127.0.0.1:${server.port}/`)
    const m = asMeasurement(await browser.evaluate(MEASURE))
    theme = m.theme
    found = layoutFindings(m)
  }, 60000)

  afterAll(async () => {
    await browser?.close()
    server?.stop(true)
  })

  const of = (kind: LayoutFinding['kind']) => found.filter((f) => f.kind === kind).map((f) => f.detail)

  it('reads the theme the page wears', () => {
    expect(theme).toBe('planted')
  })

  it('finds the page wider than the window and the box that makes it so', () => {
    expect(of('overflow')).toEqual(['the page is 600px wide in a 375px viewport'])
    expect(of('past-edge')).toEqual(['div.wide reaches 225px past the right edge'])
  })

  it('finds the text cut by overflow:hidden, and only that one', () => {
    const cut = of('clipped-text')
    expect(cut).toHaveLength(1)
    expect(cut[0]).toStartWith('div.cut cuts ')
  })

  it('finds the image and the font file that did not load, and not the local() face', () => {
    expect(of('broken-image')).toEqual([expect.stringContaining('/missing.png')])
    expect(of('font-failed')).toEqual(['planted-missing normal normal failed to load'])
  })

  it('reports nothing else: the parked skip link, the scroll boxes, clamp, ellipsis, columns and the hidden text are on purpose', () => {
    expect(found.map((f) => f.kind).sort()).toEqual(['broken-image', 'clipped-text', 'font-failed', 'overflow', 'past-edge'])
  })
})
