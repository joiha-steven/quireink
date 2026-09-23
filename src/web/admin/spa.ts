// Serving the admin: the shell HTML, and the bundle behind it.
//
// The bundle is code-split, so unlike the three public files there is no fixed list to
// import as text — the chunk names carry a hash the bundler chose. The whole directory is
// therefore read at startup and held in memory, which also keeps the compiled binary
// self-contained in the one way that matters: `Bun.embeddedFiles` covers the entry point
// and `import.meta.dir` covers running from source.
//
// The gate is the important part. The shell is served only to the owner, and everything
// under it is a router-group route (Invariant 4). A signed-out request is REDIRECTED to
// sign in rather than 404'd: the admin is not a secret, only its contents are.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from 'hono'
import type { SiteSettings } from '@/types'
import { getIntegrationStatus } from '@/store/integration-keys'
import { railBootScript, railData, railHtml, railHtmlAttrs } from '@/web/admin/rail'
import { overlaysHtml } from '@/web/admin/overlays'
import { notFoundScreen } from '@/web/admin/screens/not-found'
import { screenFor } from '@/web/admin/screens'
import { adminT } from '@/i18n/admin-i18n'
import { escapeHtml } from '@/utils'
import { allFontFaceCss } from '@/render/font-faces'
import { fontPresetCss, themesToCss } from '@/content/themes'
import { typographyToCss, fontToCss, tableToCss } from '@/content/settings'

const DIR = join(import.meta.dir, '../../admin/dist')

type Asset = { body: Uint8Array; type: string }

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/**
 * Every built file, by name. Read once: the admin is a build artefact, so a change to it
 * arrives with a restart, and re-reading per request would buy nothing but syscalls.
 */
const ASSETS = new Map<string, Asset>()
try {
  for (const name of readdirSync(DIR)) {
    const ext = name.slice(name.lastIndexOf('.'))
    const type = TYPES[ext]
    if (!type) continue
    ASSETS.set(name, { body: new Uint8Array(readFileSync(join(DIR, name))), type })
  }
} catch {
  // A source checkout that has not run `bun run build:admin` yet. The route below says so
  // in plain words rather than serving a blank page that looks like a broken admin.
}

/**
 * The stylesheet, served under a name that carries a fingerprint.
 *
 * `admin.css` is 19 KB brotli / 23 KB gzip (136 KB raw, measured 2026-09-23, after the pen moved
 * to `admin-ink.css`; it was 34 KB brotli / 55 KB gzip with the pen inside) and was `cache-control:
 * no-cache` with no validator, so the owner
 * re-downloaded it on every single admin load while the chunks beside it, which carry the
 * bundler's hash, were `immutable` and free. The public side has always done this
 * (`/assets/site.<hash>.css`); this is the same trick.
 *
 * The sheet is concatenated by `build-admin.ts` rather than emitted by Bun's bundler, so there
 * is no bundler hash to use and the name is computed here. That is safe for a SHEET and was not
 * safe for the entry: nothing imports a stylesheet by name, where a JavaScript module is
 * identified BY ITS URL.
 */
function fingerprint(name: string): string {
  const asset = ASSETS.get(name)
  // 'dev' when the bundle has not been built: the shell says so in words rather than
  // linking a name that resolves to nothing.
  return asset ? Bun.hash(asset.body as Uint8Array<ArrayBuffer>).toString(36) : 'dev'
}

/**
 * The rail's island, which is a SEPARATE build and a separate request.
 *
 * Separate because it must not wait for a SCREEN. The rail is the frame the owner navigates
 * by, ADR 0054's step 0 is that it arrives with the page, and it is the one island every admin
 * address loads: folded into each screen's entry it would be fetched again per screen and would
 * run only after whatever else that screen needs. Its own immutable URL means it is fetched
 * once and then cached for every page after.
 *
 * It also carries the parts that belong to no screen, which `overlays.ts` draws into the shell:
 * the toast, the confirm dialog, the shortcut sheet, the palette and the media picker. So a
 * page whose own island fails to load still has all five.
 */
function railEntryName(): string {
  return islandNamed('rail')
}

/**
 * An island's built file, by the name its entry has on disk.
 *
 * Every file in `src/admin/island/` is its own entry (`build-admin.ts`), so a screen's
 * behaviour is a request only the pages that need it make. The hash is the bundler's, which is
 * what makes the URL immutable; finding it by pattern is how the shell links a name it did not
 * choose. A COMPUTED name would be a bug: a module's identity is its URL, so the file's
 * name on disk IS the name the shell links, and `build-admin.ts` puts the hash in it.
 */
function islandNamed(stem: string): string {
  const want = new RegExp(`^${stem}\\.[a-z0-9]+\\.js$`)
  for (const name of ASSETS.keys()) if (want.test(name)) return name
  return `${stem}.dev.js`
}

const RAIL_ENTRY_NAME = railEntryName()
const RAIL_ENTRY = `/admin/assets/${RAIL_ENTRY_NAME}`
export const STYLES_NAME = `admin.${fingerprint('admin.css')}.css`
const STYLES = `/admin/assets/${STYLES_NAME}`
/** The pen, fingerprinted the same way, linked only where `Screen.pen` says (build-admin.ts). */
export const INK_NAME = `admin-ink.${fingerprint('admin-ink.css')}.css`
const INK = `/admin/assets/${INK_NAME}`
/**
 * An OLD shell's sheet: chrome AND pen, joined. A tab open across the release that split the pen
 * out links one sheet and no pen, and may be on the editor — the chrome alone would leave every
 * stroke bare until a reload (`tour-flows-pen.ts`).
 */
const STALE_SHEET: Asset | null = (() => {
  const chrome = ASSETS.get('admin.css')
  const ink = ASSETS.get('admin-ink.css')
  if (!chrome || !ink) return chrome ?? null
  const body = new Uint8Array(chrome.body.length + ink.body.length)
  body.set(chrome.body, 0)
  body.set(ink.body, chrome.body.length)
  return { body, type: chrome.type }
})()

/**
 * THE BOOT SCRIPT, AS A FILE, and the reason is a Content Security Policy.
 *
 * It was inline in the head — the one shape of script `docs/performance.md` allows there — and
 * on 2026-09-14 the deploy was measured on prod and the browser said: *"Executing inline script
 * violates the following Content Security Policy directive 'script-src 'self''."* Three of the
 * four public instances send that header from nginx, the owner's own blog among them, so on all
 * three the script had NEVER RUN: the rail was briefly the wrong width on every load, the Mac
 * chords printed Ctrl, and the theme arrived only when the island did. Silently, for weeks —
 * the page still worked, it just worked a beat late and nobody was measuring the first frame.
 *
 * A same-origin FILE with a fingerprinted name passes `script-src 'self'` with nothing for an
 * operator to configure, and that is the point: the frame's correctness must not depend on an
 * instance's headers. A CLASSIC script, not a module, and no `defer` — a module is deferred by
 * definition and would run after parsing, which is exactly the beat this exists to beat.
 *
 * The cost is one blocking request on a connection the HTML just arrived on. Measured at
 * 500 KB/s before shipping it, and written down in `docs/performance.md` beside the rule it
 * amends.
 *
 * Built here rather than by the bundler because it is generated from constants the server
 * shares with the rail (`admin-shared/rail.ts`), and because it must be ONE file that never
 * imports anything — an import would be a second request before the first paint.
 */
const BOOT_BODY = railBootScript()
const BOOT_NAME = `boot.${Bun.hash(new TextEncoder().encode(BOOT_BODY)).toString(36)}.js`
ASSETS.set(BOOT_NAME, { body: new TextEncoder().encode(BOOT_BODY), type: TYPES['.js'] ?? 'text/javascript' })
const BOOT = `/admin/assets/${BOOT_NAME}`

/**
 * Every chunk a module entry needs before it can run, found by following STATIC imports.
 *
 * Without these the browser discovers the module graph one level at a time, because it cannot
 * know a chunk exists until it has parsed the file that imports it. Measured on the dashboard
 * while the admin was still a React application: four waves, at 4ms, 13ms, 24ms and 31ms — on
 * localhost, where a hop is a millisecond. On a real connection that is four round trips of
 * blank screen.
 *
 * STATIC only. A dynamic import is a thing the owner may never open, and preloading those
 * would trade one problem for a worse one.
 */
function bootChunks(entry: string): string[] {
  const found: string[] = []
  const seen = new Set<string>([entry])
  const queue = [entry]
  while (queue.length > 0) {
    const asset = ASSETS.get(queue.shift() ?? '')
    if (!asset) continue
    const text = new TextDecoder().decode(asset.body)
    // `from"./x.js"` and the bare side-effect form `import"./x.js"`. A dynamic import has a
    // parenthesis between the keyword and the string, so it cannot match.
    for (const match of text.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
      const dep = match[1] ?? ''
      if (!dep || seen.has(dep)) continue
      seen.add(dep)
      found.push(dep)
      queue.push(dep)
    }
  }
  return found
}

const PRELOADS = bootChunks(RAIL_ENTRY_NAME)
  .map((name) => `<link rel="modulepreload" href="/admin/assets/${name}">`)
  .join('')

/**
 * The owner's live type and colour settings, for the admin document.
 *
 * The frozen tree got these for free: the admin sat inside the root layout and inherited
 * `globals.css` plus the runtime style block. There is no root layout here.
 *
 * ⚠️ `chromeFont` is deliberately NOT applied, and that reverses an earlier fix. The admin used
 * to follow it, because an owner on a JetBrains Mono site opened an admin in Inter and reported
 * it — which turned out to be the wrong reading. A mono chrome font is a BRANDING choice about
 * what a reader sees; the admin is the tool the owner works in, and letting the branding pick
 * the tool's typeface put a code face on every label, tab, button and table cell. Beside the
 * reading face that reads as two loud unrelated voices, and on 2026-08-14 it was rejected.
 *
 * So the admin has its OWN chrome face, Inter, and honours only the settings about the owner's
 * WORDS: palette, type scale, reading preset, uploaded face — because the editor is WYSIWYG.
 * `MONO_TRACKING` goes with the chrome font: it corrects a wide monospace, and there is none
 * here. The owner's custom CSS is absent, as in the frozen tree: it is written against the
 * public page and has no business restyling the tool.
 */
function adminStyles(settings: SiteSettings): string {
  return [
    // EVERY family, not just the active two: the Appearance font picker paints each
    // tile in the font it offers. See allFontFaceCss.
    allFontFaceCss(),
    `:root{--font-sans:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;`
    + `--font-reading:var(--font-sans);`
    + `--font-mono:'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace}`,
    `body{font-family:var(--font-sans), system-ui, -apple-system, 'Segoe UI', sans-serif}`,
    // No `enabledPalettes` here, deliberately: the public sheet ships only what a reader can
    // reach, and the admin has to render whatever the owner is EDITING — including a palette
    // they have turned off, which is exactly when they are looking at it.
    themesToCss(settings.themes, settings.themePreset),
    typographyToCss(settings.typography),
    // The editor is a `.prose` surface, so a table drawn there has to be the table that will
    // be published. Without this block it falls back to `prose.css.ts`'s own defaults and an
    // owner who chose an inverted header would write against a tinted one — the same
    // WYSIWYG mismatch `admin-design.md` records for the reading face.
    tableToCss(settings.table),
    fontPresetCss(settings.fontPreset),
    fontToCss(settings.customFont),
  ].filter(Boolean).join('\n')
}

// No `#admin-shell` payload. It held the language, the version, whether a model is plugged
// in, the nav order and the owner's portrait, as JSON on every admin page, for `useView` to
// seed itself from at epoch 0. `useView` left with React in ADR 0054's step 6 and nothing
// replaced it: measured 2026-09-16, zero readers in any built bundle, 226 bytes a page. The
// sibling payload `#admin-rail-data` IS read (`admin/island/rail.ts`) and stays.
//
// `shellView()` itself stays too: `/api/admin/view/shell` is alive, and the tour reads it
// back as its oracle for the shell.

/**
 * The shell, and it is no longer empty of anything. All five of ADR 0054's steps are
 * discharged: the screen's own markup goes into the canvas below, beside the chrome data the
 * rail needs to draw itself on the first frame.
 *
 * The class on <body> is the neutral canvas, and the SERVER states it for a reason: the first
 * paint has to be the right colour already. Left to a script it would be white until that
 * script ran, which is the same beat `BOOT` above exists to beat for the theme.
 */
/**
 * What the browser tab says, and what it shows.
 *
 * "quireINK" alone told the owner which PRODUCT they were in, which they knew, and not which
 * SITE — the one thing a tab among fifteen tabs is for. The favicon was worse than absent:
 * the shell linked none, so the browser fell back to `/favicon.ico`, which is the icon
 * compiled into the product. An owner who had uploaded their own was looking at Quire Ink's.
 */
function tabHead(settings: SiteSettings): string {
  let host = ''
  try {
    host = new URL(settings.siteUrl).host
  } catch {
    /* not set, or not a URL: the name alone is still better than the product's */
  }
  const title = host ? `quireINK · ${host}` : 'quireINK'
  const icon = settings.faviconUrl
    ? `<link rel="icon" href="${settings.faviconUrl.replace(/"/g, '&quot;')}">`
    : ''
  return `<title>${title}</title>${icon}`
}

export async function adminShell(settings: SiteSettings, path: string, query = new URLSearchParams()): Promise<string> {
  if (ASSETS.size === 0) {
    return `<!DOCTYPE html><meta charset="utf-8">${tabHead(settings)}`
      + '<p style="font:14px system-ui;padding:2rem">The admin bundle has not been built. '
      + 'Run <code>bun run build:admin</code>.</p>'
  }
  const esc = (s: string) => s.replace(/[<>"&]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' })[c] ?? c)
  const { aiConfigured } = await getIntegrationStatus()
  // ADR 0054: every admin screen arrives as finished HTML in the canvas. An address the table
  // does not claim is not a gap any more — it is the dead end, and the server draws that too.
  const found = screenFor(path)
  const screen = found
    ? await found.screen.render(settings, query)
    : await notFoundScreen(settings)
  const ink = found?.screen.pen ? `\n<link rel="stylesheet" href="${INK}">` : ''
  const island = found?.screen.island
    ? `\n<script type="module" src="/admin/assets/${islandNamed(found.screen.island)}"></script>`
    : ''
  // No `data-chrome-font`: the admin does not wear the site's chrome face (see adminStyles),
  // and the only rule that ever read the attribute was `MONO_TRACKING`, which is no longer
  // emitted here. Stamping it would leave a hook that says the admin follows a setting it
  // does not.
  return `<!DOCTYPE html>
<html lang="${esc(settings.language)}" class="admin" data-motion="${settings.motion.enabled ? 'on' : 'off'}"${railHtmlAttrs(settings)} data-admin-screen="${found ? found.name : 'not-found'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tabHead(settings)}
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${STYLES}">${ink}
${PRELOADS}
<style>${adminStyles(settings)}</style>
<!-- Before the first paint. Everything in it is a decision the SERVER cannot make: three
     localStorage preferences, a media query, the theme the owner picked, what o'clock it is
     where the reader is, and whether the keyboard has a Command key. Reading them after the
     first paint means a rail that is briefly the wrong width — and, measured on 2026-09-14, an
     admin that was LIGHT for 189 to 246ms on a throttled connection before it turned dark.
     A FILE rather than inline since 2026-09-14: see BOOT above, and the CSP that had been
     silently blocking the inline one on three of the four public instances. -->
<script src="${BOOT}"></script>
</head>
<!-- The base text colour belongs HERE, with the background it has to be legible on.
     Without it every element that does not name its own \`text-neutral-*\` inherits the
     browser default, which is pure black: fine on a light page, invisible on a dark one.
     That was the whole of "the logo and the post titles are pitch black in dark mode" -
     the sidebar wordmark and the title links in the tables set no colour, and there was
     no floor for them to fall back to. A default at the root fixes the class, not the
     three places that happened to be noticed. -->
<body class="bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
<!-- THE FRAME IS THE SERVER'S (ADR 0054). From lg up it is an INSTRUMENT PANEL: locked to
     the viewport, nothing on it moves, and only the canvas scrolls — so the rail, the write
     pane and the editor's sticky rows hold still while the paper passes, and a rubber-band at
     the top of a page bounces the paper rather than the frame. Below lg the page scrolls as
     pages do: a phone drawer inside a height-locked shell is a trap.
     ⚠️ dvh, NEVER vh. Mobile Safari resolves 100vh against the viewport it would have WITH
     THE TOOLBAR HIDDEN, so a shell told to be h-screen is taller than the glass by
     exactly that toolbar, and the page scrolls that much — carrying the "locked" rail up with
     it on every iPad. dvh is the height that is actually visible right now. -->
<div class="admin-shell admin-case min-h-screen lg:flex lg:h-[100dvh] lg:overflow-hidden">
<!-- THE FIRST STOP. The rail holds four destinations, a group of seven and a strip of
     controls, so reaching the page itself from the keyboard cost up to eighteen presses of Tab
     on every visit. Invisible until it has focus, which is the whole convention: the people who
     need it find it with the first key they press, and nobody else ever sees it. -->
<a href="#admin-content" class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-neutral-300 focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:shadow-lg dark:focus:border-neutral-700 dark:focus:bg-neutral-900 dark:focus:text-neutral-100">${escapeHtml(adminT(settings.language).skipToContent)}</a>
${railHtml({ settings, aiConfigured, path })}
<main id="admin-content" class="admin-canvas min-w-0 flex-1 lg:h-[100dvh] lg:overflow-y-auto lg:overscroll-y-contain">
<div class="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">${screen}<div id="admin"></div></div>
</main>
</div>
${overlaysHtml(adminT(settings.language), settings)}
${railData(settings, aiConfigured)}
<script type="module" src="${RAIL_ENTRY}"></script>${island}
</body>
</html>
`
}

/** One built file, or null. */
export function adminAsset(name: string): Asset | null {
  return ASSETS.get(name) ?? null
}

/**
 * A sheet name from a PREVIOUS release: `admin.<fingerprint>.css`, but not this shell's.
 *
 * A tab left open across a release still holds the old shell, and what it asks for on the
 * next screen is that shell's stylesheet. Until 2026-09-19 the answer was 404 and the admin
 * drew with no stylesheet at all — the two wordmark shapes side by side among the rest of it,
 * because the rule that picks between them (`#admin-rail .rail-mark`) was in the sheet that
 * never arrived. The current sheet under the old name is the smaller wrong by far: styles one
 * release ahead of the markup are a nudge out of place, a 404 is a bare page.
 */
export const staleSheet = (name: string): boolean =>
  (name !== STYLES_NAME && /^admin\.[a-z0-9]+\.css$/.test(name))
  || (name !== INK_NAME && /^admin-ink\.[a-z0-9]+\.css$/.test(name))

export function handleAdminAsset(c: Context): Response {
  const name = c.req.path.replace('/admin/assets/', '')
  // ONE virtual name, the sheet's. The entry had one too and that was the bug: a module is
  // identified by the URL it was fetched from, so an entry reachable under two names is two
  // modules, and a chunk that imports the entry back gets a second copy of everything in it.
  // The bare `admin.css` still serves — a bookmark, or a shell an old tab is still holding —
  // and still revalidates, because only the fingerprinted URL promises the bytes cannot change.
  const stale = staleSheet(name)
  const ink = name === INK_NAME || (stale && name.startsWith('admin-ink.'))
  const stored = name === STYLES_NAME ? 'admin.css' : ink ? 'admin-ink.css' : name
  const asset = stale && !ink ? STALE_SHEET : adminAsset(stored)
  if (!asset) return new Response('Not found', { status: 404 })
  // Every name the shell emits carries a hash: the bundler's on the entry and the chunks,
  // ours on the sheet. Anything else is a bare name and must revalidate — and so must a
  // fingerprint from an earlier release, whose bytes have just changed under it.
  const immutable = !stale && (stored !== name || /[-.][a-z0-9]{8,}\./.test(name))
  return new Response(asset.body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  })
}
