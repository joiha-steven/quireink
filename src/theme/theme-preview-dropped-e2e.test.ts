// The browser's half of `theme:preview`'s dropped declarations (scripts/theme-preview-dropped.ts):
// the mistakes the checker passes, put to a real Chrome, each found with the fix the doc promises,
// and a sheet of valid CSS, another engine's prefixes and var() included, found clean. Needs a
// headless Chrome, so it runs only when asked:
//
//   THEME_PREVIEW_E2E=1 bun test src/theme/theme-preview-dropped-e2e.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Browser } from '../../scripts/theme-matrix-browser'
import { CLOCK_ISO, defaultBrowser } from '../../scripts/theme-matrix-instance'
import { droppedIn } from '../../scripts/theme-preview-dropped'

const enabled = process.env.THEME_PREVIEW_E2E === '1'

// The mistakes docs/themes-css-rules.md (X1) lists as passing the checker and doing nothing.
const MISTAKES = `.prose{colour:var(--c-text)}
.post-list{display:gird}
.fc-title{text-wrap:balanced}
.chip{border-radius:999}
.prose p{margin:1rem 2rem 3rem 4rem 5rem}
.deck{color:var(--c-text) font-weight:700}
.rail{width:}
.prose{color var(--c-text)}
.prose{hanging-punctuation:first}`

const VALID = `.prose{color:var(--c-text);font-weight:700;margin:0 auto;text-wrap:balance}
.card-kick{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.prose{-moz-osx-font-smoothing:grayscale;--t-gap:1rem 2rem;padding:calc(var(--sp) * 2) var(--t-gap)}
@media (min-width:40em){.post-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1rem}}
@keyframes t-in{from{opacity:0}to{opacity:1}}
.prose blockquote{border-inline-start:3px solid color-mix(in oklch,var(--c-accent) 60%,transparent)}`

describe.skipIf(!enabled)('dropped declarations in a real browser', () => {
  let browser: Browser | undefined

  beforeAll(async () => {
    defaultBrowser()
    browser = await Browser.open(CLOCK_ISO)
  }, 60000)

  afterAll(async () => {
    await browser?.close()
  })

  const ask = (css: string) => droppedIn(css, (expression) => browser!.evaluate(expression))

  it('finds each mistake the checker passes, with what to write instead', async () => {
    const found = (await ask(MISTAKES)).map((f) => [f.line, f.kind, f.fix ?? null])
    expect(found).toEqual([
      [1, 'property', 'color: var(--c-text)'],
      [2, 'value', 'display: grid'],
      [3, 'value', 'text-wrap: balance'],
      [4, 'value', 'border-radius: 999px'],
      [5, 'value', null],
      [6, 'semicolon', 'color: var(--c-text);'],
      [7, 'empty', null],
      [8, 'colon', 'color: var(--c-text)'],
      [9, 'unknown', null],
    ])
  }, 30000)

  it('finds nothing in valid CSS', async () => {
    expect(await ask(VALID)).toEqual([])
  }, 30000)
})
