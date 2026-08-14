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
import { allFontFaceCss } from '@/render/font-faces'
import { fontPresetCss, themesToCss } from '@/content/themes'
import { typographyToCss, fontToCss } from '@/content/settings'

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
 * The two files the bundler does not hash, served under a name that carries one.
 *
 * `main.js` and `admin.css` are 194 KB and 68 KB, and they were `cache-control: no-cache`
 * with no validator — so the owner re-downloaded 262 KB on every single admin load while
 * the chunks beside them, which DO carry a hash, were `immutable` and free. The public side
 * has always done this (`/assets/site.<hash>.css`); this is the same trick.
 *
 * The name is computed here rather than in the build because `[name]-[hash].js` is already
 * the CHUNK pattern and the chunks are also called `main-…`: hashing the entry there would
 * make the one file that must be found by name indistinguishable from the twelve that must
 * not. So the URL is virtual and `handleAdminAsset` maps it back. A `.` separator, not a
 * `-`, for the same reason.
 *
 * Relative imports still resolve: the browser resolves `./main-abc.js` against the entry's
 * URL, which is in the same directory whichever name it wears. `admin.css` references no
 * files at all — its ten `url()`s are data URIs.
 */
function fingerprint(name: string): string {
  const asset = ASSETS.get(name)
  // 'dev' when the bundle has not been built: the shell says so in words rather than
  // linking a name that resolves to nothing.
  return asset ? Bun.hash(asset.body as Uint8Array<ArrayBuffer>).toString(36) : 'dev'
}

const ENTRY_NAME = `main.${fingerprint('main.js')}.js`
const STYLES_NAME = `admin.${fingerprint('admin.css')}.css`
const ENTRY = `/admin/assets/${ENTRY_NAME}`
const STYLES = `/admin/assets/${STYLES_NAME}`

/**
 * Every chunk the entry needs before it can run, found by following STATIC imports.
 *
 * Without these the browser discovers the module graph one level at a time, because it
 * cannot know a chunk exists until it has parsed the file that imports it. Measured on the
 * dashboard: four waves, at 4ms, 13ms, 24ms and 31ms — on localhost, where a hop is a
 * millisecond. On a real connection that is four round trips of blank screen.
 *
 * STATIC only. `import("./Content-hash.js")` is a route the owner may never open, and
 * preloading all fourteen of those would trade one problem for a worse one.
 */
function bootChunks(): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const queue = ['main.js']
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

const PRELOADS = bootChunks()
  .map((name) => `<link rel="modulepreload" href="/admin/assets/${name}">`)
  .join('')

/**
 * The owner's live type and colour settings, for the admin document.
 *
 * The frozen tree got these for free: the admin sat inside the root layout, so it inherited
 * `globals.css` (the @font-face declarations and `body{font-family:var(--font-sans)}`) plus
 * the runtime style block the layout injected from settings. There is no root layout here.
 *
 * ⚠️ **`chromeFont` is deliberately NOT applied here, and that reverses an earlier fix.**
 * The admin used to follow it, because an owner on a JetBrains Mono site opened an admin in
 * Inter and reported it. Following it turned out to be the wrong reading of that report. A
 * mono chrome font is a BRANDING choice about what a reader sees; the admin is the tool the
 * owner works in, and letting the branding pick the tool's typeface put a code face on every
 * label, tab, button and table cell. Set beside the reading face it reads as two loud,
 * unrelated voices — measured on the owner's own instance, 2026-08-14: *"nhìn rối thiệt, 2
 * font này có vẻ không hợp để dùng trong admin"*. Three versions of one Settings screen were
 * photographed and he chose this one.
 *
 * So the admin has its OWN chrome face, Inter, and the settings it still honours are the ones
 * about the owner's WORDS: the palette, the type scale, the reading preset and any uploaded
 * face — because the editor is WYSIWYG and a post has to be written in the face it publishes
 * in. `MONO_TRACKING` goes with the chrome font: it corrects a wide monospace, and there is
 * no longer one here.
 *
 * The owner's custom CSS is absent, as it was in the frozen tree: it is written against the
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
    fontPresetCss(settings.fontPreset),
    fontToCss(settings.customFont),
  ].filter(Boolean).join('\n')
}

/**
 * The shell. Deliberately empty of CONTENT: there is no server rendering of the admin,
 * because a second rendering path for a tool only one person opens is a second set of bugs
 * for no reader's benefit. It is not empty of settings, which is a different thing — the
 * language, the typeface and the palette have to be right in the first paint.
 *
 * The class on <body> is the neutral canvas: the one paint the bundle must not be
 * responsible for, or the admin flashes white before React mounts.
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

export function adminShell(settings: SiteSettings): string {
  if (ASSETS.size === 0) {
    return `<!DOCTYPE html><meta charset="utf-8">${tabHead(settings)}`
      + '<p style="font:14px system-ui;padding:2rem">The admin bundle has not been built. '
      + 'Run <code>bun run build:admin</code>.</p>'
  }
  const esc = (s: string) => s.replace(/[<>"&]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' })[c] ?? c)
  // No `data-chrome-font`: the admin does not wear the site's chrome face (see adminStyles),
  // and the only rule that ever read the attribute was `MONO_TRACKING`, which is no longer
  // emitted here. Stamping it would leave a hook that says the admin follows a setting it
  // does not.
  return `<!DOCTYPE html>
<html lang="${esc(settings.language)}" class="admin" data-motion="${settings.motion.enabled ? 'on' : 'off'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tabHead(settings)}
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${STYLES}">
${PRELOADS}
<style>${adminStyles(settings)}</style>
</head>
<!-- The base text colour belongs HERE, with the background it has to be legible on.
     Without it every element that does not name its own \`text-neutral-*\` inherits the
     browser default, which is pure black: fine on a light page, invisible on a dark one.
     That was the whole of "the logo and the post titles are pitch black in dark mode" -
     the sidebar wordmark and the title links in the tables set no colour, and there was
     no floor for them to fall back to. A default at the root fixes the class, not the
     three places that happened to be noticed. -->
<body class="bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
<div id="admin"></div>
<script type="module" src="${ENTRY}"></script>
</body>
</html>
`
}

/** One built file, or null. */
export function adminAsset(name: string): Asset | null {
  return ASSETS.get(name) ?? null
}

export function handleAdminAsset(c: Context): Response {
  const name = c.req.path.replace('/admin/assets/', '')
  // The two virtual names map back to the files they fingerprint. The BARE names still
  // serve — a bookmark, or a shell an old tab is still holding — and still revalidate,
  // because only the fingerprinted URL carries the promise that the bytes cannot change.
  const stored = name === ENTRY_NAME ? 'main.js' : name === STYLES_NAME ? 'admin.css' : name
  const asset = adminAsset(stored)
  if (!asset) return new Response('Not found', { status: 404 })
  // Every name the shell emits now carries a hash: the bundler's on a chunk, ours on the
  // entry and the sheet. Anything else is a bare name and must revalidate.
  const immutable = stored !== name || /-[a-z0-9]{8,}\./.test(name)
  return new Response(asset.body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  })
}
