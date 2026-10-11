// THEMES INSTALLED FROM A ZIP, driven from the Look card the owner uses (ADR 0072, T2c): a small
// valid package is installed through the card's own file input, listed with the Unreviewed badge,
// chosen and saved with the screen's Save key, worn by the public home page, removed through the
// product's own confirm, and the site is Plain again. A refused package shows its findings.
//
// The zips are built here, in the tour's process, by the installer tests' own helper
// (`src/theme/test-zip.ts`), and handed to the page as base64: the page puts them in the file
// input with a `DataTransfer`, which is the one way a script can choose a file for a real input.
//
// The fixture wears the source-code theme; whatever happens, a `finally` puts it back and removes
// the tour's theme, so the flows after this one tour what they always toured.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions: each is a template literal.
import { readFileSync } from 'node:fs'
import type { Tour } from './tour'
import { MANIFEST, themeZip } from '../src/theme/test-zip'

const ID = 'tour-sheet'
// A real 1200 by 900 WebP (3.5 KB), so the tile is proven to show a screenshot that decodes: the
// test helper's own screenshot is only a header the checker reads, and no browser can draw it.
const SHOT = new Uint8Array(readFileSync('scripts/tour-fixtures/theme-screenshot.webp'))
const GOOD = Buffer.from(themeZip({ 'theme.json': { ...MANIFEST, id: ID, name: 'Tour sheet' }, 'screenshot.webp': SHOT })).toString('base64')
// A colour written straight into the sheet (C1), and no front-page rule at all (S2).
const BAD = Buffer.from(themeZip({ 'theme.json': { ...MANIFEST, id: 'tour-refused' }, 'theme.css': '.prose{color:red}' })).toString('base64')

/** Put the zip `b64` in the card's file input and wait until `done()` says the card answered. */
const upload = (b64: string, name: string): string => `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const input = document.querySelector('[data-theme-file]')
  if (!input) return 'no theme file input on the Look card'
  const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))
  const dt = new DataTransfer()
  dt.items.add(new File([bytes], ${JSON.stringify(name)}, { type: 'application/zip' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const shown = (q) => { const el = document.querySelector(q); return el && el.offsetParent !== null ? el : null }
  let answered = null
  for (let i = 0; i < 60 && !answered; i++) {
    await sleep(100)
    answered = shown('[data-theme-status]') || shown('[data-theme-error]') || shown('[data-theme-refusal]')
  }
  if (!answered) return 'the card said nothing after a file was chosen'
`

/** The fixture's theme back on, and the tour's theme gone, whatever the flow did. */
const tidy = `(async () => {
  await fetch('/api/themes/${ID}', { method: 'DELETE', credentials: 'same-origin' })
  const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'code' }) })
  return r.ok ? 'ok' : 'could not put the fixture theme back: ' + r.status
})()`

export function registerThemeFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('a theme installed from a zip is listed unreviewed, chosen, worn, removed, and the site is Plain again', async () => {
    try {
      return await expect('/admin/settings?tab=appearance', `(async () => {
        ${upload(GOOD, 'tour-sheet.zip')}
        const cell = document.querySelector('[data-theme-cell="${ID}"]')
        if (!cell) return 'the installed theme is not listed: ' + answered.textContent
        const badge = cell.querySelector('[data-theme-badge]')
        if (!badge || badge.offsetParent === null) return 'the installed tile wears no Unreviewed badge'
        if (!cell.textContent.includes('Tour sheet')) return 'the tile does not carry the theme name'
        const image = cell.querySelector('img')
        const hash = ((image && image.getAttribute('src')) || '').split('/')[2] || ''
        if (hash.length !== 64) return 'the tile does not point at its package screenshot'
        // Lazy: it loads once the tile is on screen.
        cell.scrollIntoView({ block: 'center' })
        for (let i = 0; i < 30 && !(image.complete && image.naturalWidth > 0); i++) await sleep(100)
        if (image.hidden || image.naturalWidth !== 1200) return 'the screenshot did not paint on the tile (' + image.naturalWidth + ')'

        // Chosen the way a built-in tile is: pressed, then the screen's one Save.
        cell.querySelector('[data-choice]').click()
        await sleep(150)
        const save = document.querySelector('[data-settings-save]')
        if (!save || save.disabled) return 'pressing the installed tile did not arm Save'
        save.click()
        // Save is disabled while it stores as well as after, so the home page is what is waited on.
        const home = () => fetch('/', { credentials: 'same-origin' }).then((r) => r.text())
        let worn = ''
        for (let i = 0; i < 40 && !worn.includes('data-theme="${ID}"'); i++) { await sleep(100); worn = await home() }
        if (!worn.includes('/themes/' + hash + '/theme.css')) return 'the public home does not link the theme sheet'
        if (!worn.includes('data-theme="${ID}"')) return 'the public home is not drawn as the theme'

        // Removed through the product's own question.
        cell.querySelector('[data-theme-remove]').click()
        let yes = null
        for (let i = 0; i < 30 && !yes; i++) {
          await sleep(100)
          yes = [...document.querySelectorAll('[data-confirm-yes]')].find((b) => b.offsetParent !== null) || null
        }
        if (!yes) return 'Remove did not ask first'
        yes.click()
        for (let i = 0; i < 40 && document.querySelector('[data-theme-cell="${ID}"]'); i++) await sleep(100)
        if (document.querySelector('[data-theme-cell="${ID}"]')) return 'the removed theme is still listed'
        const plainKey = document.querySelector('[data-choice-track][data-k="theme"] [data-choice="plain"]')
        if (!plainKey || plainKey.getAttribute('aria-pressed') !== 'true') return 'Plain is not the chosen tile after removing the worn theme'
        let after = worn
        for (let i = 0; i < 40 && after.includes('data-theme="${ID}"'); i++) { await sleep(100); after = await home() }
        if (after.includes('/themes/' + hash + '/theme.css')) return 'the public home still links the removed theme'
        if (!after.includes('data-theme="plain"')) return 'the public home is not Plain after the removal'
        return 'ok installed, badge, chosen, worn (' + hash.slice(0, 8) + '), removed, Plain'
      })()`, 900)
    } finally {
      await expect('/admin', tidy)
    }
  })

  flow('a refused theme zip lists what the check found, and installs nothing', () =>
    expect('/admin/settings?tab=appearance', `(async () => {
      ${upload(BAD, 'tour-refused.zip')}
      const lines = [...document.querySelectorAll('[data-theme-violations] li')]
      if (lines.length === 0) return 'the refusal listed no finding'
      const first = lines[0]
      const what = first.querySelector('[data-theme-violation-what]').textContent.trim()
      const where = first.querySelector('[data-theme-violation-where]').textContent.trim()
      if (!what || !where) return 'a finding line is empty'
      const listed = await (await fetch('/api/themes', { credentials: 'same-origin' })).json()
      if (listed.data.some((t) => t.id === 'tour-refused')) return 'a refused package was installed'
      return 'ok ' + lines.length + ' finding(s), first: ' + where
    })()`, 900))
}
