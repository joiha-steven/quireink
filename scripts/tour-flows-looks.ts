// THE FOUR LOOKS, each by what makes it that look (2026-09-23). The fixture wears the
// source-code dialect, so the other two are worn for the length of one flow: the look is set
// through the app's own settings route, the page is measured at a laptop's size, and the
// fixture's own look is put back whatever happened — in a `finally`, because a flow that fails
// half way must not leave the next forty flows touring a newspaper.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions: each is a template literal.
import type { Tour } from './tour'

/** One PUT of the look through the app's own settings route, from a page the owner is on. */
const wear = (look: string): string => `(async () => {
  const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look: ${JSON.stringify(look)} }) })
  return r.ok ? 'ok' : 'the settings route refused the look: ' + r.status
})()`

/**
 * Wear `look`, measure `path` at 1440 with `probe`, and put the fixture's look back.
 *
 * Three navigations rather than a frame: the site refuses to be framed (frame-ancestors), which
 * is right and is not something a tour gets to turn off. The restore is in a `finally`.
 */
async function wearing(t: Pick<Tour, 'expect' | 'atWidth'>, look: string, path: string, probe: string): Promise<string> {
  const set = await t.expect('/admin', wear(look))
  if (set !== 'ok') return set
  try {
    return await t.atWidth(1440, path, `(() => {
      for (const el of document.querySelectorAll('*')) for (const a of el.getAnimations()) a.finish()
      return (${probe})()
    })()`)
  } finally {
    await t.expect('/admin', wear('code'))
  }
}

/** One PUT of a few settings through the app's own settings route, from a page the owner is on. */
const put = (settings: Record<string, unknown>): string => `(async () => {
  const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(settings))} })
  return r.ok ? 'ok' : 'the settings route refused ' + ${JSON.stringify(Object.keys(settings).join(', '))} + ': ' + r.status
})()`

/**
 * The piece's meta line under the newspaper: its tracking as a fraction of its own size, and its
 * display. The newspaper gives `.post-meta` .02em through
 * `html[data-look=paper] :is(.post-meta,…,.t-small.text-meta,…)` (0,3,1) and `display:contents`
 * through `html[data-look=paper] .post-meta`; the base gives it `.t-small`'s tracking, 0.
 */
const META_LINE = `(() => {
  const meta = document.querySelector('article .post-meta')
  if (!meta) return 'no meta line on the piece'
  const cs = getComputedStyle(meta)
  const ratio = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)
  return 'ok ' + (Math.round(ratio * 1000) / 1000) + ' ' + cs.display
})()`

export function registerLookFlows({ flow, expect, atWidth }: Tour): void {
  // ADR 0072, decision 3: the owner's custom CSS wins over the theme whatever its selectors
  // weigh, because the theme's sheet is in a cascade layer and the custom CSS is not
  // (`web/css-layers.ts`). The bar is a bare `.post-meta` (0,1,0) against the newspaper's
  // (0,3,1), which won on specificity before the layers.
  // And the other half still holds: the theme beats the base sheet, and a property the custom
  // CSS does not name stays the theme's.
  flow('custom CSS wins over the theme whatever its specificity, and the theme still beats the base', async () => {
    const was = await expect('/admin/settings?tab=appearance', `(() => {
      const ed = document.querySelector('[data-css-editor]')
      return ed ? 'css:' + ed.value : 'no custom CSS editor on the appearance tab'
    })()`)
    if (!was.startsWith('css:')) return was
    const saved = was.slice('css:'.length)
    try {
      const set = await expect('/admin', put({ look: 'paper', customCss: '' }))
      if (set !== 'ok') return set
      const plain = await atWidth(1440, '/a-type-scale-you-can-defend', META_LINE)
      if (plain !== 'ok 0.02 contents') return 'without custom CSS the newspaper meta line reads ' + plain + ', expected the theme\'s 0.02 contents'
      const css = await expect('/admin', put({ customCss: '.post-meta{letter-spacing:.3em}' }))
      if (css !== 'ok') return css
      const custom = await atWidth(1440, '/a-type-scale-you-can-defend', META_LINE)
      if (custom !== 'ok 0.3 contents') return 'with .post-meta{letter-spacing:.3em} the meta line reads ' + custom + ', expected 0.3 contents'
      return 'ok theme over base (0.02), custom CSS over theme (0.3), display left to the theme'
    } finally {
      await expect('/admin', put({ look: 'code', customCss: saved }))
    }
  })

  // `!important` runs the layers backwards, so the base sheet's own `!important`s are served
  // outside every layer (`web/css-important.ts`) and weigh what they did before: an owner's
  // `!important` beats them by weight and order, and they still beat any normal declaration, the
  // owner's or a theme's. The base says `.prose pre.shiki{background:…!important}` and
  // `.dark .shiki span{color:…!important}`.
  flow("custom CSS's !important beats the base sheet's, which still beats a normal declaration", async () => {
    const was = await expect('/admin/settings?tab=appearance', `(() => {
      const ed = document.querySelector('[data-css-editor]')
      return ed ? 'css:' + ed.value : 'no custom CSS editor on the appearance tab'
    })()`)
    if (!was.startsWith('css:')) return was
    const saved = was.slice('css:'.length)
    const code = `(() => {
      const pre = document.querySelector('.prose pre.shiki')
      const span = pre && pre.querySelector('span[style]')
      if (!pre || !span) return 'no highlighted code block on the piece'
      const theme = document.createElement('style')
      theme.textContent = '@layer theme{.prose pre.shiki{background:rgb(9,9,9)}}'
      document.head.append(theme)
      document.documentElement.classList.add('dark')
      const out = 'ok ' + getComputedStyle(pre).backgroundColor + ' ' + getComputedStyle(span).color
      document.documentElement.classList.remove('dark')
      theme.remove()
      return out
    })()`
    try {
      const plain = await expect('/admin', put({ customCss: '.prose pre.shiki{background:rgb(7,8,9)}' }))
      if (plain !== 'ok') return plain
      const lost = await atWidth(1440, '/what-a-subsetter-removes', code)
      if (!lost.startsWith('ok ')) return lost
      if (lost.includes('rgb(7, 8, 9)') || lost.includes('rgb(9, 9, 9)')) return 'a normal declaration beat the base !important: ' + lost
      const strong = await expect('/admin', put({ customCss: '.prose pre.shiki{background:rgb(1,2,3)!important}.dark .shiki span{color:rgb(4,5,6)!important}' }))
      if (strong !== 'ok') return strong
      const won = await atWidth(1440, '/what-a-subsetter-removes', code)
      if (won !== 'ok rgb(1, 2, 3) rgb(4, 5, 6)') return "the owner's !important lost to the base's: " + won
      return 'ok base !important over normal (' + lost.slice(3) + '), owner !important over base'
    } finally {
      await expect('/admin', put({ customCss: saved }))
    }
  })


  // A SHORT POST (no title) keeps its date line in every theme at every width. Above the rail
  // breakpoint the base sheet hides the meta line because the info panel in the gutter repeats
  // it; the newspaper hides that panel too, so the date was drawn nowhere. Measured, per theme
  // and width, from what the browser painted: the element is in the DOM, has a box inside the
  // viewport, and the text colour differs from the page background.
  const SHORT_DATE = 'tour-short-dated'
  const DATE_PROBE = `(() => {
    // Any copy of the date will do: the line under the headline, or the row in the gutter panel.
    const all = [...document.querySelectorAll('article time, .post-info time')]
    if (!all.length) return 'no date element'
    const shown = all.filter((t) => t.checkVisibility({ checkVisibilityCSS: true }))
    if (!shown.length) return 'date not visible: ' + all.length + ' copies, all hidden'
    const t = shown[0]
    const r = t.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) return 'date has no box: ' + Math.round(r.width) + 'x' + Math.round(r.height)
    if (r.left < 0 || r.right > innerWidth) return 'date outside the viewport: ' + Math.round(r.left) + '..' + Math.round(r.right)
    if (document.documentElement.scrollWidth > innerWidth) return 'page scrolls sideways: ' + document.documentElement.scrollWidth
    const ink = getComputedStyle(t).color
    const ground = getComputedStyle(document.body).backgroundColor
    if (ink === ground) return 'date is the colour of the page: ' + ink
    return 'ok ' + Math.round(r.top) + ' ' + ink
  })()`
  flow('a short post keeps its date line in every theme at every width', async () => {
    const made = await expect('/admin', `(async () => {
      await fetch('/api/posts/${SHORT_DATE}', { method: 'DELETE' })
      await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${SHORT_DATE}'] }) })
      const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', slug: '${SHORT_DATE}', content: 'A short one, with no headline at all.', status: 'published', categories: [], tags: [] }) })
      return r.ok ? 'ok' : 'POST /api/posts -> ' + r.status
    })()`)
    if (made !== 'ok') return made
    const lost: string[] = []
    const seen: string[] = []
    let cleaned = ''
    try {
      for (const look of ['plain', 'code', 'paper', 'notes']) {
        const set = await expect('/admin', put({ look }))
        if (set !== 'ok') return set
        for (const width of [375, 768, 1440]) {
          const got = await atWidth(width, '/' + SHORT_DATE, DATE_PROBE)
          seen.push(look + '@' + width + ' ' + got)
          if (!got.startsWith('ok')) lost.push(look + ' at ' + width + ': ' + got)
        }
      }
    } finally {
      // The look first: a failed clean-up of the post must not leave later flows on another theme.
      // Purged, not just trashed, so no later flow sees an extra Trash row.
      try {
        await expect('/admin', put({ look: 'code' }))
      } finally {
        cleaned = await expect('/admin', `(async () => {
          await fetch('/api/posts/${SHORT_DATE}', { method: 'DELETE' })
          const r = await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${SHORT_DATE}'] }) })
          return r.ok ? 'ok' : 'purge -> ' + r.status
        })()`)
      }
    }
    if (cleaned !== 'ok') return 'the short post was not purged: ' + cleaned
    return lost.length ? 'the date line is missing: ' + lost.join('; ') : 'ok 4 themes x 3 widths: ' + seen.length + ' dates visible'
  })

  // The headline speaks the chrome's monospace; the paragraph under it stays in the book face.
  flow('the source-code look sets headlines in its monospace and leaves the text a book', () =>
    atWidth(1440, '/a-type-scale-you-can-defend', `(() => {
    const face = (el) => getComputedStyle(el).fontFamily
    const h1 = document.querySelector('article > header h1')
    const h2 = document.querySelector('.prose h2')
    const p = document.querySelector('.prose > p')
    const mono = face(document.body)
    if (!h1 || !h2 || !p) return 'no headline, section head or paragraph on the piece'
    if (face(h1) !== mono) return 'the headline is in ' + face(h1) + ', not the chrome face'
    if (face(h2) !== mono) return 'a section head is in ' + face(h2)
    if (face(p) === mono) return 'the running text went monospace'
    if (getComputedStyle(h1).fontWeight !== '700') return 'the headline weighs ' + getComputedStyle(h1).fontWeight
    return 'ok'
  })()`))

  // The newspaper: the menu is in the masthead, not in the middle of the story, and the story
  // starts on the first screen. Inline, the menu block put the first line at y=980 of 1000;
  // it is 832 with the series box kept above the text, where the markup puts it.
  flow('the newspaper puts its menu in the masthead and the story on the first screen', () =>
    wearing({ expect, atWidth }, 'paper', '/a-type-scale-you-can-defend', `() => {
      const doc = document
      const menu = doc.querySelector('header.site .site-menu')
      if (!menu || !menu.checkVisibility()) return 'no section menu in the masthead'
      const inline = doc.querySelector('article .rail-inner > nav:not(.toc)')
      if (inline && inline.checkVisibility()) return 'the menu is still printed inside the piece'
      const first = doc.querySelector('.prose > p').getBoundingClientRect().top
      if (first > 850) return 'the first line of the story sits at y=' + Math.round(first)
      // The series box stays where the markup puts it: moved to the foot with 'order' it was
      // drawn at y=4050 while Tab and a screen reader met it after the byline.
      const series = doc.querySelector('aside.series')
      if (series && series.getBoundingClientRect().top > doc.querySelector('.prose').getBoundingClientRect().top)
        return 'the series box is drawn below the story but read before it'
      return 'ok first line at y=' + Math.round(first)
    }`))

  // WORN WITHOUT BEING SERVED: the demo swaps looks in the browser, so the masthead menu the
  // server draws for the newspaper is not there. The shelf's copy must then stay, or the page
  // has no menu at all (found 2026-09-23, preparing 2.2.14's screenshots).
  flow('the newspaper worn in the browser still has a menu', () =>
    atWidth(1440, '/a-type-scale-you-can-defend', `(async () => {
    document.documentElement.setAttribute('data-look', 'paper')
    document.querySelector('link[href*="/assets/look-"]')?.remove()
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = '/assets/look-paper.tour.css'
    await new Promise((r) => { el.onload = r; el.onerror = r; document.head.append(el) })
    await new Promise((r) => setTimeout(r, 200))
    if (getComputedStyle(document.documentElement).getPropertyValue('--c-bg') === '') return 'no page styles'
    const shown = [...document.querySelectorAll('nav a')].filter((a) =>
      a.checkVisibility() && a.getAttribute('href') && a.getAttribute('href').indexOf('/category/') === 0)
    return shown.length ? 'ok ' + shown.length + ' menu link(s) on screen' : 'the page has no menu left'
  })()`))

  // The notebook: dotted paper on the sheet, and the quiet ink really quiet. The ink was a
  // custom property that named itself, which is a cycle: it went invalid and every date and
  // rail link printed in the full text colour for nine days, with every static test green.
  flow('the notebook prints dot grid, and its quiet ink is not the text ink', () =>
    wearing({ expect, atWidth }, 'notes', '/a-type-scale-you-can-defend', `() => {
      const doc = document
      const cs = (el) => getComputedStyle(el)
      const sheet = doc.querySelector('main > article')
      if (cs(sheet).backgroundImage.indexOf('radial-gradient') < 0) return 'the sheet carries no dot grid'
      if (!cs(doc.body).getPropertyValue('--c-meta').trim()) return '--c-meta is invalid under the body'
      const link = doc.querySelector('.rail .rail-row')
      const text = cs(doc.querySelector('.prose > p')).color
      if (cs(link).color === text) return 'a rail link prints in the text ink ' + text
      const para = doc.querySelector('.prose > p')
      if (cs(para).textAlign === 'justify') return 'the notebook is justified'
      return 'ok'
    }`))

  // The picker draws the four, and a click presses one without saving anything.
  flow('admin: the looks are four drawn tiles, and a click presses one', () =>
    expect('/admin/settings?tab=appearance', `(() => {
    const track = document.querySelector('[data-choice-track][data-k=theme]')
    if (!track) return 'no look picker on the appearance tab'
    const tiles = [...track.querySelectorAll('[data-choice]')]
    if (tiles.length !== 4) return tiles.length + ' tiles'
    if (tiles.some((b) => !b.querySelector('svg'))) return 'a tile has no drawing'
    if (tiles.some((b) => b.querySelectorAll('span').length < 2)) return 'a tile has no line saying who it is for'
    const was = tiles.find((b) => b.getAttribute('aria-pressed') === 'true')
    const other = tiles.find((b) => b.getAttribute('aria-pressed') === 'false')
    other.click()
    const pressed = other.getAttribute('aria-pressed') === 'true'
    const one = track.querySelectorAll('[aria-pressed=true]').length === 1
    // And back, so the tab is left with nothing to save and the next address is not asked
    // whether to leave.
    was.click()
    if (!pressed) return 'the click did not press the tile'
    if (!one) return 'two tiles pressed at once'
    return 'ok'
  })()`))

  // The first-run steps that pick a look, a face and the reader's pen draw their choices as
  // `.face-choice` cards over a hidden radio. The form's field rule gives every input
  // width:100%, and an absolute radio resolves that against the PAGE: at 1440 the look step's
  // four radios ran to 2183px and the page scrolled sideways by 743px with nothing to see. The
  // fix is one rule in `web/login.css.ts`; this is what goes red without it. Each step is only
  // read here, so nothing needs putting back.
  for (const [path, step] of [['/setup/look', 'look'], ['/setup/reader', 'pen'], ['/setup/face', 'face']] as const) {
    for (const width of [1440, 375]) {
      flow(`setup: the ${step} step does not scroll sideways at ${width}`, () => atWidth(width, path, `(() => {
        if (!document.querySelector('.face-choice')) return 'no choice cards on ' + location.pathname
        const doc = document.documentElement
        const spill = doc.scrollWidth - doc.clientWidth
        if (spill <= 1) return 'ok no sideways scroll at ' + doc.clientWidth + 'px'
        let widest = null
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (r.right > doc.clientWidth + 1 && (!widest || r.right > widest.r)) {
            widest = { r: r.right, what: el.tagName + '.' + String(el.className).split(' ').slice(0, 3).join('.') }
          }
        }
        return 'scrolls sideways by ' + spill + 'px at ' + doc.clientWidth + 'px' +
          (widest ? ' (widest: ' + widest.what + ' reaching ' + Math.round(widest.r) + 'px)' : '')
      })()`, 600))
    }
  }
}
