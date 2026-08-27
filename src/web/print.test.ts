// The print sheet, and the one way a print sheet fails: quietly.
//
// Nobody prints a page to check a refactor. A class gets renamed on the screen side, the
// rule in `print.css.ts` goes on matching nothing, and the next reader to print an essay
// gets the reading-progress bar and thirty comments again — with every test green, because
// no test ever looked at paper. So the hide-list is checked against the site itself here:
// every selector it silences has to be a selector this site still uses.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { createApp } from '@/web/app'
import { PUBLIC_CSS } from '@/web/public.css'

const DIR = './.tmp/test-print'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

// The print block is LAST in the sheet (see `public.css.ts`), so it runs to the end.
const AT = PUBLIC_CSS.indexOf('@media print{')
const PRINT = PUBLIC_CSS.slice(AT)
const SCREEN = PUBLIC_CSS.slice(0, AT)

describe('the print sheet', () => {
  it('is there at all', () => {
    expect(AT).toBeGreaterThan(0)
    expect(PRINT).toContain('@page{')
  })

  it('silences only selectors this site actually uses', async () => {
    await savePost({
      title: 'On paper', content: 'A body, and [a link](https://example.com/x).',
      status: 'published', date: '2020-01-01T00:00:00.000Z',
    })
    const html = await (await app.request('/on-paper')).text()

    // Every selector in every `display:none` rule inside the print block.
    const hidden = [...PRINT.matchAll(/([^{}]+)\{display:none!important\}/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((s) => s.trim())
      .filter(Boolean)
    expect(hidden.length).toBeGreaterThan(10)

    const unused: string[] = []
    for (const selector of hidden) {
      // The bare name a rename would change: `.to-top`, `#comments`, `footer.site`.
      const name = selector.replace(/:has\([^)]*\)/g, '').match(/[.#][\w-]+/)?.[0]
      if (!name) continue
      const token = name.slice(1)
      // Either the screen half of this very sheet styles it, or the rendered page has it.
      // Both halves matter: a fixed button exists only in the island bundle's CSS, and a
      // section like `#comments` is markup the renderer writes.
      const styled = SCREEN.includes(name)
      const rendered = html.includes(`"${token}"`) || html.includes(`${token} `) || html.includes(`"${token}`)
      if (!styled && !rendered) unused.push(selector)
    }
    expect(unused).toEqual([])
  })

  it("prints on paper rather than in the reader's palette", () => {
    // The palette lands INLINE, after the linked sheet (`sheet.test.ts`), so `html.dark`
    // beats this on order and specificity alike. Without `!important` a reader printing at
    // night hands the printer a black page, or — since browsers drop backgrounds by
    // default — white text on white paper.
    expect(PRINT).toContain('--c-bg:#fff!important')
    expect(PRINT).toContain('--c-text:#1a1a1a!important')
    // The pen is NOT overridden: the marks are the reason a page off this site looks like
    // this site, and a colour printer should give the reader the ones the writer drew.
    expect(PRINT).not.toContain('--c-accent:')
  })

  it('keeps the address of a link that leaves the site, and only that one', () => {
    expect(PRINT).toContain('.prose a[href^="http"]::after')
    expect(PRINT).toContain('.prose a[href^="#"]::after,.prose a.footnote-ref::after')
  })

  // The one that got away. Every rule above was written and checked against an ARTICLE, and
  // an article carries no listing cards — so nothing here noticed that a LISTING prints its
  // cards at whatever opacity the scroll reveal had reached, which for everything below the
  // fold is zero. Measured on the front page 2026-08-27: five of ten cards at opacity 0,
  // still taking their space. Two posts and a wall of white, over three sheets.
  it('undoes the scroll reveal, which on paper never scrolls', async () => {
    expect(PRINT).toContain('.reveal{animation:none!important;opacity:1!important;transform:none!important}')

    // ...and the class is really the one a listing writes, so this cannot rot into a rule
    // that silences nothing the way the hide-list above could.
    const html = await (await app.request('/')).text()
    expect(html).toContain('class="reveal"')
  })
})
