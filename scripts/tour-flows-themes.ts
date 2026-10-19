// THEMES INSTALLED FROM A ZIP, driven from the Look card the owner uses (ADR 0072, T2c): a small
// valid package is installed through the card's own file input, listed with the Unreviewed badge,
// previewed (the owner sees it with the bar, a reader does not) and left, chosen, one of its
// palettes picked from the palette picker, saved with the screen's Save key, worn by the public
// home page in that palette, removed through the product's own confirm, and the site is Plain
// again. A refused package shows its findings.
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
/** A palette that clears the checker's contrast floor, on a page colour of its own. */
const palette = (id: string, name: string, bg: string, darkBg: string) => ({
  id, name,
  light: { bg, text: '#222222', heading: '#111111', meta: '#555555', link: '#1a4d8f', rule: '#e0d8c0', accent: '#1a4d8f' },
  dark: { bg: darkBg, text: '#e8e8e8', heading: '#ffffff', meta: '#a0a0a0', link: '#8fb8ff', rule: '#2a3440', accent: '#8fb8ff' },
})
const PICKED = palette('tour-paper', 'Tour paper', '#fff8e7', '#101820')
const face = (file: string) => [{ file, weight: 400, style: 'normal' }]
/**
 * Three palettes, one with the longest name the checker allows (40), and three fonts in real woff2
 * files from the engine's own set, so the pickers draw the theme's options in faces that load.
 */
export const TOUR_THEME = {
  ...MANIFEST, id: ID, name: 'Tour sheet',
  palettes: [PICKED, palette('tour-sky', 'Sky', '#eef4fa', '#0f1a24'),
    palette('tour-long', 'A palette whose name runs to forty chars', '#f5f0fa', '#1a1020')],
  fonts: [
    { id: 'tour-serif', name: 'Tour Serif', role: 'reading', faces: face('fonts/serif.woff2') },
    { id: 'tour-sans', name: 'Tour Sans', role: 'reading', faces: face('fonts/sans.woff2') },
    { id: 'tour-mono', name: 'Tour Mono', role: 'chrome', faces: face('fonts/mono.woff2') },
  ],
  suggests: { palette: 'tour-paper', readingFont: 'tour-serif', chromeFont: 'tour-mono' },
}
const fontFile = (name: string) => new Uint8Array(readFileSync(`src/assets/static/fonts/${name}`))
/** The tour's package: the manifest above, a screenshot that decodes and fonts that load. */
export const tourThemeZip = (): Uint8Array => themeZip({
  'theme.json': TOUR_THEME, 'screenshot.webp': SHOT, 'fonts/body.woff2': null,
  'fonts/serif.woff2': fontFile('literata-latin.woff2'), 'fonts/sans.woff2': fontFile('sourcesans-latin.woff2'),
  'fonts/mono.woff2': fontFile('plexmono-400-latin.woff2'),
})
const GOOD = Buffer.from(tourThemeZip()).toString('base64')
/** "#rrggbb" as `getComputedStyle` writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
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

/**
 * The fixture's theme and palette back on, and the tour's theme gone, whatever the flow did. The
 * palette is the seed's (it sets none, so the default): a theme palette left stored would be kept
 * and drawn as the default anyway, but a later flow should find the row it always found.
 */
const tidy = `(async () => {
  await fetch('/api/themes/${ID}', { method: 'DELETE', credentials: 'same-origin' })
  const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'code', themePreset: 'mono' }) })
  return r.ok ? 'ok' : 'could not put the fixture theme back: ' + r.status
})()`

export function registerThemeFlows({ flow, expect, atWidth }: Pick<Tour, 'flow' | 'expect' | 'atWidth'>): void {
  flow('a theme installed from a zip is listed unreviewed, chosen, worn, removed, and the site is Plain again', async () => {
    try {
      const chosen = await expect('/admin/settings?tab=appearance', `(async () => {
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

        // Previewed before it is chosen: the tile's Preview link, followed as the new tab follows it,
        // draws the site in the theme with the bar for the owner, while a request with no cookies
        // at all (a reader) still gets the fixture's theme. Leave ends it.
        const look = cell.querySelector('[data-theme-preview-key]')
        if (!look || look.getAttribute('target') !== '_blank') return 'the installed tile has no Preview key opening a new tab'
        const opened = await fetch(look.href, { credentials: 'same-origin' })
        const seen = new DOMParser().parseFromString(await opened.text(), 'text/html')
        if (!opened.url.includes('/?theme-preview=${ID}')) return 'Preview did not land on the home page: ' + opened.url
        if (seen.documentElement.dataset.theme !== '${ID}') return 'the preview is not drawn as the theme: ' + seen.documentElement.dataset.theme
        const bar = seen.querySelector('[data-theme-preview="${ID}"]')
        if (!bar || !bar.textContent.includes('Tour sheet')) return 'the preview has no bar naming the theme'
        if (opened.headers.get('cache-control') !== 'private, no-store') return 'the preview may be cached: ' + opened.headers.get('cache-control')
        const reader = await (await fetch('/', { credentials: 'omit' })).text()
        if (reader.includes('theme-preview') || !reader.includes('data-theme="code"')) return 'a reader saw the preview'
        await fetch(bar.querySelector('[data-theme-preview-leave]').getAttribute('href'), { credentials: 'same-origin' })
        const left = await (await fetch('/', { credentials: 'same-origin' })).text()
        if (left.includes('theme-preview') || !left.includes('data-theme="code"')) return 'Leave preview did not end it'

        // Chosen the way a built-in tile is: pressed, then the screen's one Save. Its palette is
        // picked first, from the palette picker, which offers it only while the tile is pressed.
        cell.querySelector('[data-choice]').click()
        await sleep(150)
        const card = document.querySelector('[data-palette-card="${PICKED.id}"]')
        if (!card || card.hidden) return 'the pressed theme did not offer its palette in the palette picker'
        if (!card.textContent.includes('Tour sheet')) return 'the theme palette does not say which theme it comes from'
        card.querySelector('[data-palette-pick]').click()
        await sleep(100)
        document.querySelector('[data-palette-make-default]').click()
        await sleep(100)
        const save = document.querySelector('[data-settings-save]')
        if (!save || save.disabled) return 'pressing the installed tile did not arm Save'
        save.click()
        // Save is disabled while it stores as well as after, so the home page is what is waited on.
        const home = () => fetch('/', { credentials: 'same-origin' }).then((r) => r.text())
        let worn = ''
        for (let i = 0; i < 40 && !worn.includes('data-theme="${ID}"'); i++) { await sleep(100); worn = await home() }
        if (!worn.includes('/themes/' + hash + '/theme.css')) return 'the public home does not link the theme sheet'
        if (!worn.includes('data-theme="${ID}"')) return 'the public home is not drawn as the theme'
        return 'ok ' + hash
      })()`, 900)
      if (!chosen.startsWith('ok ')) return chosen
      const hash = chosen.slice(3)

      // The page a reader gets, drawn: its ground is the picked palette's, light or dark as it
      // opens. On the page itself, since the site will not be framed.
      const ground = await expect('/', `(() => {
        const ground = getComputedStyle(document.body).backgroundColor
        const want = document.documentElement.classList.contains('dark') ? '${rgb(PICKED.dark.bg)}' : '${rgb(PICKED.light.bg)}'
        return ground === want ? 'ok ' + ground : 'the public page ground is ' + ground + ', not the picked palette (' + want + ')'
      })()`)
      if (!ground.startsWith('ok ')) return ground

      const removed = await expect('/admin/settings?tab=appearance', `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const cell = document.querySelector('[data-theme-cell="${ID}"]')
        if (!cell) return 'the installed theme is not listed after the save'
        const home = () => fetch('/', { credentials: 'same-origin' }).then((r) => r.text())
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
        let after = await home()
        for (let i = 0; i < 40 && after.includes('data-theme="${ID}"'); i++) { await sleep(100); after = await home() }
        if (after.includes('/themes/${hash}/theme.css')) return 'the public home still links the removed theme'
        if (!after.includes('data-theme="plain"')) return 'the public home is not Plain after the removal'
        return 'ok'
      })()`, 900)
      if (removed !== 'ok') return removed
      return 'ok installed, badge, previewed and left, chosen, palette picked and worn (' + ground.slice(3) + ', ' + hash.slice(0, 8) + '), removed, Plain'
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

  // THE MENU IN THE HEADER IS THE ENGINE'S JOB. A theme whose manifest says layout.menu "header"
  // and whose sheet says nothing about the rail: at 1440 the header shows the menu and no rail
  // shows its copy or stands empty; at 375 the header's menu is hidden and the drawer offers it.
  const id = 'tour-masthead'
  const zip = Buffer.from(themeZip({ 'theme.json': { ...MANIFEST, id, name: 'Tour masthead', layout: { menu: 'header' } } })).toString('base64')
  const tidyMasthead = `(async () => {
    await fetch('/api/themes/${id}', { method: 'DELETE', credentials: 'same-origin' })
    const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'code' }) })
    return r.ok ? 'ok' : 'could not put the fixture theme back: ' + r.status
  })()`
  const wearMasthead = `(async () => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(zip)}), (c) => c.charCodeAt(0))
    const form = new FormData()
    form.append('file', new File([bytes], 'tour-masthead.zip', { type: 'application/zip' }), 'tour-masthead.zip')
    const put = await fetch('/api/themes', { method: 'POST', credentials: 'same-origin', body: form })
    if (!put.ok) return 'install -> ' + put.status
    const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: '${id}' }) })
    return r.ok ? 'ok' : 'choose -> ' + r.status
  })()`
  flow('a theme with the menu in the header shows it once at 1440 and in the drawer at 375', async () => {
    try {
      const worn = await expect('/admin', wearMasthead)
      if (worn !== 'ok') return worn
      const wide = `(() => {
        const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true })
        if (document.documentElement.dataset.theme !== '${id}') return 'the page does not wear the theme'
        const head = document.querySelector('.site-bar > .site-menu')
        if (!head || !vis(head)) return 'the header shows no menu'
        const copies = [...document.querySelectorAll('.rail .rail-menu-copy')]
        if (!copies.length) return 'the rail carries no marked copy of the menu'
        if (copies.some(vis)) return 'the rail shows its copy beside the header menu'
        const empty = [...document.querySelectorAll('.rail')].filter((r) => vis(r)
          && ![...r.querySelectorAll('.rail-inner > *')].some(vis))
        if (empty.length) return 'a rail is drawn with nothing in it: ' + empty[0].className
        return 'ok'
      })()`
      const narrow = `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true })
        const head = document.querySelector('.site-bar > .site-menu')
        if (head && vis(head)) return 'the header shows its menu on a phone'
        const button = document.querySelector('.rail-toggle')
        if (!button || !vis(button)) return 'no drawer button on a phone'
        button.click()
        await sleep(400)
        const copy = document.querySelector('.rail .rail-menu-copy')
        const links = copy ? [...copy.querySelectorAll('a')].filter(vis).length : 0
        button.click()
        return links > 0 ? 'ok ' + links : 'the drawer does not offer the menu'
      })()`
      const seen: string[] = []
      for (const path of ['/a-type-scale-you-can-defend', '/colophon', '/']) {
        const at1440 = await atWidth(1440, path, wide)
        if (at1440 !== 'ok') return path + ' at 1440: ' + at1440
        const at375 = await atWidth(375, path, narrow)
        if (!at375.startsWith('ok')) return path + ' at 375: ' + at375
        seen.push(path + ' ' + at375.slice(3) + ' links')
      }
      return 'ok once at 1440, in the drawer at 375: ' + seen.join(', ')
    } finally {
      await expect('/admin', tidyMasthead)
    }
  })

  // AND THE RAIL STILL STARTS AT ITS TOP. The copy is hidden, but the space the base puts between
  // rail blocks (.rail-inner > * + *) used to stay: the first block that IS drawn sat 28px under
  // the rail's top in the gutter, out of line with the facts panel and the year index, and 16px
  // low in the band. Measured on every rail the page draws, for the installed theme and for
  // Newspaper, which hides the copy itself; at 1440 also as the contents' top against the panel's.
  flow('a rail whose menu is in the header starts its first drawn block at the top', async () => {
    const probe = `(() => {
      const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true })
      const out = []
      // The first drawn block's own top margin: without a menu above it, it has none. Measured as
      // a margin rather than as a distance, because where the column is in flow (the band, the
      // newspaper's shelf) that margin collapses through the column and the rail, and the whole
      // rail moves down instead, so no distance inside the rail shows it.
      for (const inner of document.querySelectorAll('.rail .rail-inner')) {
        if (!vis(inner)) continue
        const first = [...inner.children].find(vis)
        if (first) out.push(Math.round(parseFloat(getComputedStyle(first).marginTop)))
      }
      const info = document.querySelector('.post-info')
      const toc = document.querySelector('.rail .toc')
      const level = info && toc && vis(info) && vis(toc) && getComputedStyle(info).position === 'absolute'
        ? ' info-vs-toc=' + Math.round(toc.getBoundingClientRect().top - info.getBoundingClientRect().top) : ''
      return out.length ? out.join(',') + level : 'no rail drawn'
    })()`
    const off: string[] = []
    const seen: string[] = []
    try {
      const worn = await expect('/admin', wearMasthead)
      if (worn !== 'ok') return worn
      const cells: [string, string, number][] = [
        [id, '/a-type-scale-you-can-defend', 1440], [id, '/a-type-scale-you-can-defend', 1100], [id, '/', 1440],
        ['paper', '/a-type-scale-you-can-defend', 1440], ['paper', '/a-type-scale-you-can-defend', 1100],
        ['paper', '/a-type-scale-you-can-defend', 768], ['paper', '/a-type-scale-you-can-defend', 375], ['paper', '/', 1440],
      ]
      let wearing = id
      for (const [theme, path, width] of cells) {
        if (theme !== wearing) {
          const set = await expect('/admin', `fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: '${theme}' }) }).then((r) => r.ok ? 'ok' : 'choose -> ' + r.status)`)
          if (set !== 'ok') return set
          wearing = theme
        }
        const got = await atWidth(width, path, probe)
        seen.push(theme + ' ' + path + '@' + width + ' ' + got)
        if (got === 'no rail drawn') continue
        if (got.split(' ')[0]!.split(',').some((n) => n !== '0') || (got.includes('info-vs-toc=') && !got.endsWith('info-vs-toc=0'))) {
          off.push(theme + ' ' + path + ' at ' + width + ': ' + got)
        }
      }
    } finally {
      await expect('/admin', tidyMasthead)
    }
    return off.length ? 'the first rail block is not at the top: ' + off.join('; ') : 'ok ' + seen.join('; ')
  })
}
