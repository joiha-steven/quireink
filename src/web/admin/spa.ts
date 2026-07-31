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
import { allFontFaceCss, MONO_TRACKING } from '@/render/font-faces'
import { fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
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

/** The entry point's current name, which carries no hash — the chunks do. */
const ENTRY = '/admin/assets/main.js'
const STYLES = '/admin/assets/admin.css'

/**
 * The owner's live type and colour settings, for the admin document.
 *
 * The frozen tree got these for free: the admin sat inside the root layout, so it inherited
 * `globals.css` (the @font-face declarations and `body{font-family:var(--font-sans)}`) plus
 * the runtime style block the layout injected from settings. There is no root layout here,
 * and `admin.css` hard-coded Inter as a stand-in — which meant the admin ignored the owner's
 * chrome font entirely and stayed Inter on a site set to JetBrains Mono.
 *
 * The order mirrors the frozen layout exactly: palettes first, then the type scale, then the
 * reading preset, then any uploaded face, and the chrome font LAST so it has the final word
 * on `--font-sans`. The owner's custom CSS is deliberately absent, as it was there: it is
 * written against the public page and has no business restyling the tool.
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
    themesToCss(settings.themes, settings.themePreset),
    typographyToCss(settings.typography),
    fontPresetCss(settings.fontPreset),
    fontToCss(settings.customFont),
    chromeFontCss(settings.chromeFont),
    MONO_TRACKING,
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
  return `<!DOCTYPE html>
<html lang="${esc(settings.language)}" class="admin" data-motion="${settings.motion.enabled ? 'on' : 'off'}" data-chrome-font="${esc(settings.chromeFont)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tabHead(settings)}
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${STYLES}">
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
  const asset = adminAsset(name)
  if (!asset) return new Response('Not found', { status: 404 })
  // The entry point has no hash in its name, so it must revalidate; the chunks it pulls in
  // do, and can be held forever.
  const immutable = /-[a-z0-9]{8,}\./.test(name)
  return new Response(asset.body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  })
}
