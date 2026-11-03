// MCP tools for themes installed from a zip (ADR 0072): the same door the Look card uses, for an
// agent that writes the files itself.
//
// NOT A SECOND PATH. Checking is `readThemePackage(zip, packageOptions())`, the call the install
// route and `bun run theme:check` both make; installing is `installTheme`, the function
// `POST /api/themes` calls; a rollback is `rollbackTheme`, as `POST /api/themes/:id/rollback`. The
// only thing this file adds is packaging: the agent hands over files, they are zipped here in
// memory as `theme:check` zips a directory, and the zip goes through the door every other zip
// goes through. So a theme this accepts is a theme the admin would accept, and the other way round.
//
// Choosing it stays `update_appearance`, which already takes an installed theme's id: a theme
// installed here changes nothing a reader sees until that call, or the owner's own Save.
//
// AN AGENT HAS NO EYES, and the checker's findings are written for one: each carries the rule, the
// place, the offending text and the sentence the admin shows the owner. The preview is the owner's,
// not the agent's: `preview_theme` hands back the link the Look card's Preview opens, which draws
// the site in the theme only for a browser signed in as the owner.

import { z } from 'zod'
import type { ToolHost } from '@/mcp/registry'
import { readThemePackage, THEME_LIMITS, SCREENSHOT_SIZE, type Violation } from '@/theme'
import { packageOptions, SUPPORTED_THEME_API } from '@/content/theme-package-options'
import { installTheme, listInstalledThemes, rollbackTheme } from '@/content/installed-themes'
import { isPreviewableTheme } from '@/content/chosen-theme'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { RESERVED_FONT_IDS, RESERVED_PALETTE_IDS, RESERVED_THEME_IDS } from '@/content/theme-reserved'
import { PROMISED_ATTRIBUTES, PROMISED_SELECTORS, PROMISED_VARS } from '@/content/appearance-contract'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { ZipWriter } from '@/import/zip-write'
import { logActivity } from '@/server/activity'
import { asError, asJson } from '@/mcp/result'
import en from '@/locales/admin/en'

/**
 * A 1200 x 900 WebP of one plain colour, 88 bytes: the screenshot a package must carry, for a
 * theme whose author could not take one. The Look card draws it as a blank tile, which is the
 * truth about a theme nobody has photographed. An agent that has a real one sends it as base64.
 */
const PLACEHOLDER_SCREENSHOT = Buffer.from(
  'UklGRlAAAABXRUJQVlA4TEMAAAAvr8TgAAdQ9sKXvP8BAEX6/58i+p/63//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9//9sNAA==',
  'base64',
)

const RULES = en.themeRules as Record<string, string>

const fileInput = z.object({
  path: z.string().min(1).max(120).describe('Path inside the package: theme.json, theme.css, screenshot.webp, fonts/<name>.woff2 or images/<name>.<ext>'),
  text: z.string().optional().describe('The file as UTF-8 text (theme.json, theme.css, an SVG)'),
  base64: z.string().optional().describe('The file as base64 (screenshot.webp, fonts, raster images)'),
})

const filesSchema = z.array(fileInput).min(1).max(THEME_LIMITS.files)
  .describe('Every file of the theme. theme.json and theme.css are required; screenshot.webp is added as a blank tile when left out.')

type FileInput = z.infer<typeof fileInput>

/** A finding as a model can act on it: where, what, and the sentence the owner would be shown. */
const explain = (v: Violation) => ({
  rule: v.rule,
  file: v.file,
  ...(v.line > 0 ? { line: v.line, col: v.col } : {}),
  subject: v.subject,
  why: RULES[v.rule] ?? RULES.other,
})

const refused = (violations: Violation[]) => ({
  ok: false,
  installed: false,
  findings: violations.map(explain),
  next: 'Fix every finding and call check_theme again. get_theme_guide lists the selectors, variables and rules.',
})

/** A size refusal in the checker's own shape (rule A5), so a model reads one kind of finding, not two. */
const sizeFinding = (subject: string): Violation => ({ rule: 'A5', file: '', line: 0, col: 0, subject })

type Packed = { zip: Uint8Array; placeholder: boolean } | { error: string } | { refused: Violation[] }

/**
 * The agent's files as the zip the installer reads, or why they cannot be one. Directories are
 * records too, as `zip -r` writes them and `theme:check` packs a directory.
 *
 * THE SIZES ARE CAPPED HERE, because the door's own cap is sized for the call, not the package:
 * `MCP_BODY_LIMIT` (`web/admin/mcp-transport.ts`) lets through a 10 MiB package as base64, far
 * more than the admin's 5 MB upload. The package's expanded limit is checked from the lengths before anything is decoded, and
 * the zip this makes is held to the route's own `file_too_large` ceiling, `THEME_LIMITS.zipBytes`.
 */
function packFiles(files: FileInput[]): Packed {
  const entries: { path: string; bytes: Uint8Array }[] = []
  const seen = new Set<string>()
  let total = 0
  for (const f of files) {
    if (seen.has(f.path)) return { error: `${f.path} is given twice` }
    seen.add(f.path)
    if ((f.text === undefined) === (f.base64 === undefined)) return { error: `${f.path}: give exactly one of text or base64` }
    // The fewest bytes this string can decode to (UTF-8 spends at least one per UTF-16 unit; base64
    // four characters per three), so a string past the limit is refused before it is decoded.
    const least = f.text !== undefined ? f.text.length : Math.floor(f.base64!.length * 3 / 4) - 2
    if (total + least > THEME_LIMITS.totalBytes) {
      return { refused: [sizeFinding(`${f.path} is past the ${THEME_LIMITS.totalBytes}-byte package limit`)] }
    }
    const bytes = f.text !== undefined ? new TextEncoder().encode(f.text) : new Uint8Array(Buffer.from(f.base64!, 'base64'))
    total += bytes.length
    if (total > THEME_LIMITS.totalBytes) return { refused: [sizeFinding(`the files add up to more than ${THEME_LIMITS.totalBytes} bytes`)] }
    entries.push({ path: f.path, bytes })
  }
  const placeholder = !seen.has('screenshot.webp')
  if (placeholder) entries.push({ path: 'screenshot.webp', bytes: PLACEHOLDER_SCREENSHOT })

  const chunks: Uint8Array[] = []
  const zip = new ZipWriter({ write: (bytes) => void chunks.push(Uint8Array.from(bytes)) })
  const dirs = [...new Set(entries.map((e) => e.path.split('/').slice(0, -1).join('/')).filter(Boolean))].sort()
  for (const d of dirs) zip.addBytes(`${d}/`, new Uint8Array(0))
  for (const e of entries.sort((a, b) => (a.path < b.path ? -1 : 1))) zip.addBytes(e.path, e.bytes)
  zip.finish()
  const size = chunks.reduce((n, c) => n + c.length, 0)
  if (size > THEME_LIMITS.zipBytes) return { refused: [sizeFinding(`zip of ${size} bytes, past ${THEME_LIMITS.zipBytes}`)] }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return { zip: out, placeholder }
}

/** A theme that passes the checker, kept here so the guide's example is a promise the test holds. */
export const EXAMPLE_THEME = {
  'theme.json': JSON.stringify({
    api: 1,
    id: 'warm-paper',
    name: 'Warm paper',
    version: '1.0.0',
    author: 'Example',
    license: 'MIT-0',
    description: 'A warm paper page with the menu in the masthead.',
    layout: { menu: 'header' },
    palettes: [{
      id: 'warm-paper-day',
      name: 'Warm paper',
      light: { bg: '#f6f0e4', text: '#2f2a24', heading: '#1d1915', meta: '#6b6155', link: '#8c3b1c', rule: '#e0d5c2', accent: '#8c3b1c' },
      dark: { bg: '#1d1a16', text: '#e6dfd3', heading: '#f4eee5', meta: '#aaa092', link: '#e9a27f', rule: '#3b362f', accent: '#e9a27f' },
    }],
    suggests: { palette: 'warm-paper-day', readingFont: 'literata' },
  }, null, 2),
  'theme.css': '.prose h2{padding-bottom:0.25em;border-bottom:1px solid var(--c-rule)}\n.fc-title{color:var(--c-heading)}\n',
}

export function registerThemeTools(server: ToolHost): void {
  server.registerTool(
    'get_theme_guide',
    {
      readOnly: true,
      description:
        'Everything needed to write a theme that passes the checker: the files a package holds and their '
        + 'limits, the theme.json fields, every rule code with its meaning, the selectors, attributes and CSS '
        + 'variables a theme may use (and which page surface each selector belongs to), the ids a theme may not '
        + 'take, and a small example that passes. Read it before writing theme.css.',
      inputSchema: {},
    },
    async () => asJson({
      what: 'A theme is a skin over the engine\'s own markup: theme.json, one theme.css, a screenshot, optional '
        + 'woff2 fonts and images. No HTML and no JavaScript. Colours come only from palettes (read them as '
        + 'var(--c-*)); sizes only from the type scale; fonts only as choices. The owner\'s settings and custom '
        + 'CSS always win.',
      files: {
        'theme.json': { required: true, maxBytes: THEME_LIMITS.cssBytes },
        'theme.css': { required: true, maxBytes: THEME_LIMITS.cssBytes },
        'screenshot.webp': { required: true, size: SCREENSHOT_SIZE, maxBytes: THEME_LIMITS.imageBytes, note: 'install_theme adds a blank tile when you leave it out' },
        'fonts/<name>.woff2': { required: false, maxBytes: THEME_LIMITS.fontBytes },
        'images/<name>.webp|png|jpg|jpeg|avif|svg': { required: false, maxBytes: THEME_LIMITS.imageBytes },
        package: { maxFiles: THEME_LIMITS.files, maxBytes: THEME_LIMITS.totalBytes },
      },
      manifest: {
        required: { api: SUPPORTED_THEME_API, id: 'kebab-case, at most 40', name: '1-60 chars', version: 'major.minor.patch', author: '1-80 chars', license: '1-40 chars, e.g. MIT-0' },
        optional: {
          homepage: 'https:// URL', description: '1-200 chars', layout: '{ menu: "rail" | "header", deepenMetaInk: boolean }',
          palettes: 'up to 8 of { id, name, light, dark }, light/dark each { bg, text, heading, meta, link, rule, accent } as #rrggbb',
          fonts: 'up to 6 of { id, name, role: "reading" | "chrome" | "display", faces: [{ file: "fonts/x.woff2", weight, style }] }',
          suggests: '{ palette, readingFont, chromeFont }: ids that exist (the theme\'s own or built-in)',
          ownsSettings: 'subset of table.head, table.grid, table.ruleWeight',
        },
        unknownKeys: 'refused at every level',
      },
      reserved: { themeIds: [...RESERVED_THEME_IDS], paletteIds: [...RESERVED_PALETTE_IDS], fontIds: [...RESERVED_FONT_IDS] },
      rules: RULES,
      mustStyleBothSurfaces: 'theme.css has to select at least one "blog" selector and one "front" selector (rule S2).',
      selectors: PROMISED_SELECTORS,
      attributes: PROMISED_ATTRIBUTES,
      variables: PROMISED_VARS,
      versions: 'Installing the same id and version again replaces that version. Raise the version to keep the old one as a rollback point.',
      example: EXAMPLE_THEME,
    }),
  )

  server.registerTool(
    'list_themes',
    {
      readOnly: true,
      description: 'The themes this blog can wear: the built-in ones, and each installed theme with its current version, the versions a rollback goes back to, and which one the site wears now.',
      inputSchema: {},
    },
    async () => {
      const chosen = (await getSettings()).theme
      return asJson({
        wearing: chosen,
        builtIn: BUILTIN_THEMES.map((t) => t.id),
        installed: (await listInstalledThemes()).map((t) => ({
          id: t.id, name: t.current.name, version: t.current.version, active: t.active, readable: t.readable,
          previous: t.previous.map((p) => p.version),
        })),
      })
    },
  )

  server.registerTool(
    'check_theme',
    {
      readOnly: true,
      description:
        'Run the install\'s own checker on theme files and write nothing. Answers ok with the id and version, or '
        + 'one finding per problem: rule, file, line and column, the offending text, and why. A theme that '
        + 'passes here installs.',
      inputSchema: { files: filesSchema },
    },
    async ({ files }) => {
      const packed = packFiles(files)
      if ('error' in packed) return asError(packed.error)
      if ('refused' in packed) return asJson(refused(packed.refused))
      const result = await readThemePackage(packed.zip, packageOptions())
      if (!result.ok) return asJson(refused(result.violations))
      const { manifest, files: inside } = result.pkg
      return asJson({ ok: true, id: manifest.id, version: manifest.version, files: inside.length, placeholderScreenshot: packed.placeholder })
    },
  )

  server.registerTool(
    'install_theme',
    {
      description:
        'Check and install a theme from its files, exactly as the admin installs a zip. Refused: nothing is '
        + 'written and the findings come back as check_theme gives them. Installed: the site does NOT wear it '
        + 'yet; give the owner preview_theme\'s link, then update_appearance with theme set to its id puts it on '
        + 'the site. The same id and version again replaces that version; raise the version to keep a rollback point.',
      inputSchema: { files: filesSchema },
    },
    async ({ files }) => {
      const packed = packFiles(files)
      if ('error' in packed) return asError(packed.error)
      if ('refused' in packed) return asJson(refused(packed.refused))
      const result = await installTheme(packed.zip)
      if (!result.ok) return asJson(refused(result.violations))
      if (result.changed) await logActivity('theme.install', `${result.id} ${result.version}`)
      return asJson({
        ok: true, installed: true, id: result.id, version: result.version, changed: result.changed,
        placeholderScreenshot: packed.placeholder,
        next: `Not on the site yet. preview_theme { id: "${result.id}" } for the owner to look; update_appearance { theme: "${result.id}", useSuggestions: true } to wear it with the palette and fonts it suggests.`,
      })
    },
  )

  server.registerTool(
    'preview_theme',
    {
      readOnly: true,
      description:
        'The link that shows the site wearing a theme, built-in or installed, to the OWNER only: it works in a '
        + 'browser signed in to this blog and changes nothing readers see. Give it to the owner; you cannot open it yourself.',
      inputSchema: { id: z.string().min(1).max(40) },
    },
    async ({ id }) => {
      if (!isPreviewableTheme(id)) return asError(`No theme "${id}" the site can draw. list_themes shows what there is.`)
      const site = resolveSiteUrl(await getSettings())
      return asJson({
        id,
        url: `${site}/api/themes/${encodeURIComponent(id)}/preview`,
        forOwner: 'Opens the site in this theme for the signed-in owner until they press Leave. Readers see nothing.',
      })
    },
  )

  server.registerTool(
    'rollback_theme',
    {
      description:
        'Remove the current version of an installed theme so the version installed before it is current again, '
        + 'as the Look card\'s Roll back does. If the site wears that theme, readers see the earlier version at once. '
        + 'To stop wearing a theme altogether, use update_appearance with another theme instead.',
      inputSchema: { id: z.string().min(1).max(40) },
    },
    async ({ id }) => {
      const result = rollbackTheme(id)
      if (!result.ok) {
        return asError(result.error === 'not_found'
          ? `No installed theme "${id}". list_themes shows what there is.`
          : `"${id}" has no earlier version to go back to.`)
      }
      await logActivity('theme.rollback', `${result.id} ${result.removed.version} → ${result.current.version}`)
      return asJson({ id: result.id, current: result.current.version, removed: result.removed.version })
    },
  )
}
