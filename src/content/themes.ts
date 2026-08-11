// Built-in palettes (6 tokens × light+dark, emitted by `themesToCss`). All live in
// `settings.themes` (id -> ThemeSettings), each owner-customizable; `themePreset`
// names the visitor default (switchable via PaletteToggle). `name` is the English
// fallback — the displayed name is localized via `paletteNames`, keyed by id.

import type { ThemeColors, ThemeSettings, TypographySettings, TypeRole, TypeStyle, FontSettings } from '@/types'

// The palettes' colour VALUES live in `palettes.ts` (split 2026-08-11, by reader — see its
// header). Re-exported here so every existing importer of `themes.ts` is unaffected.
import { THEME_PRESETS } from '@/content/palettes'
export { THEME_PRESETS }

export type ThemePreset = {
  id: string
  name: string
  theme: ThemeSettings
}

// Render order for the role editor + CSS emit. Each role is fully tunable
// (size/line/spacing). Lives here (client-safe) so the settings UI imports it.
export const TYPE_ROLES: TypeRole[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'body', 'small', 'caption', 'code']

// Custom-font weight slots (one upload each; all share the family).
export const FONT_WEIGHTS = [400, 500, 600, 700] as const

// Default type system (client-safe so the settings UI imports it for reset).
// Tuned for long-form reading the way fine European book typography is set:
//  - 18px body (--fs-body 1.125rem) at a ~66-char measure (contentWidth 672) — the
//    classic 60-75 cpl comfort zone (Bringhurst's ideal ~66).
//  - Body leading 1.7: airy enough for screens, a touch tighter than the old 1.75
//    so the column reads as an even grey block rather than spaced-out lines.
//  - A restrained, monotonic heading scale (h1 2.0 → h5 1.0). Headings stay modest
//    (books differentiate with weight + whitespace, not size); larger sizes take
//    tighter leading + a little negative tracking, body/small stay at 0.
//  - h4 sits just above body; h5 is the small label (was 0.9, below body — fixed).
//  - `small` at 0.9375 (15px), not 0.875 (14px). It is not a minor role: dates, tags,
//    footnotes, the footer, the related list and the whole comment thread are all set in
//    it, so it is most of the page that is not the article. 14px against an 18px body is
//    0.78 of it, which is a bigger drop than book typography uses for secondary matter;
//    0.83 keeps the hierarchy and stops the furniture reading as fine print.
//  - `caption` follows it up to 0.875 (14px) for the same reason: it labels a photograph
//    the reader is looking at, and 13px under an 18px column was a squint.
// Mirror any change in the table in docs/conventions.md.
export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  roles: {
    h1: { size: 2.0, line: 1.2, spacing: -0.02 },
    h2: { size: 1.5, line: 1.27, spacing: -0.015 },
    h3: { size: 1.25, line: 1.35, spacing: -0.01 },
    h4: { size: 1.15, line: 1.45, spacing: -0.006 },
    h5: { size: 1.0, line: 1.5, spacing: 0 },
    body: { size: 1.125, line: 1.7, spacing: 0 },
    small: { size: 0.9375, line: 1.6, spacing: 0 },
    caption: { size: 0.875, line: 1.5, spacing: 0.003 },
    code: { size: 0.875, line: 1.6, spacing: 0 },
  },
  smoothing: false,
}

// Default typeface: none uploaded → the bundled Inter.
export const DEFAULT_FONT: FontSettings = { family: '', faces: [] }

// Built-in font choices (Admin → Appearance). Each is a self-hosted family (see
// globals.css) plus the typography TUNED for it — a serif runs small and wants a
// tighter leading than a sans, so switching font also loads its reading setup.
// `typography` here is what the admin drops into the editable roles when the owner
// picks the font; they still own and can tweak every value afterwards.
export type FontPreset = {
  id: string
  name: string
  slug: string // public/fonts/<slug>-{latin,latin-ext,vietnamese}.woff2
  stack: string // CSS font-family value assigned to --font-sans
  typography: TypographySettings
  // Bold weight for the reading text (`.prose strong`). Book serifs render a very
  // black 700, heavier than the 600 headings — 600 keeps bold as emphasis, not a
  // second heading. Omitted → the default 700 (right for the sans faces).
  readingBold?: number
}

// The font files to <link rel="preload"> — the SYSTEM-WIDE rule, one place. Preload
// ONLY what the LCP text (the post title, set in the reading font) needs to paint in
// its final face, and only when that file is small + known. Everything else is left
// to `font-display: swap` (the title still paints instantly in a fallback):
//   • built-in reading font → its language subset(s): `latin`, plus `vietnamese` on a
//     vi site (a VN title needs BOTH files — separate unicode-ranges). latin-ext and
//     unused weights are never preloaded (variable file carries every weight).
//   • CJK locale (ja/zh/ko) → NOTHING: the built-ins ship no CJK glyphs, so the title
//     renders in a system font; preloading a latin file it won't use only steals bandwidth.
//   • custom uploaded font → NOTHING: the face is unsubsetted (whole charset, often
//     large), so a high-priority preload would contend with the render-blocking CSS and
//     hurt LCP; swap covers it. (It wins --font-reading via fontToCss regardless.)
//   • chrome font → NEVER preloaded here (it is not the LCP element; it swaps in).
// `hasCustomFont` = an owner typeface is set (see FontSettings); when true the reading
// font is that upload, so the built-in preset is not the one painting the title.
export function fontPreloadHrefs(
  id: string, lang: string, hasCustomFont: boolean, chromeFont: string,
): string[] {
  if (lang === 'ja' || lang === 'zh' || lang === 'ko') return []
  const subsets = (slug: string): string[] => (lang === 'vi'
    ? [`/fonts/${slug}-latin.woff2`, `/fonts/${slug}-vietnamese.woff2`]
    : [`/fonts/${slug}-latin.woff2`])
  const reading = hasCustomFont ? [] : subsets(getFontPreset(id).slug)
  // The CHROME face too, when it is a self-hosted family of its own. The rule above used to
  // be "never, it is not the LCP", and that was written when the chrome font was Inter: the
  // fallback was a system sans and the swap was barely visible. It is a MONOSPACE now on any
  // site that picked one, and the header, the meta line and both rails all re-flow when it
  // lands. Measured before changing it (origin, cold, 4x CPU throttle) — see
  // docs/performance.md; the reading font still wins the race and is still declared first.
  // `getChromeFont` falls back to Inter for an unknown id, which is right for the FONT
  // STACK and wrong here: an install that has never chosen a chrome font is using the
  // reading face, and preloading 44 KB of Inter it will not paint a glyph in is worse than
  // preloading nothing. Measured — that mistake cost 160ms of LCP.
  const chrome = isChromeFontId(chromeFont) ? getChromeFont(chromeFont).slug : null
  const extra = chrome && chrome !== getFontPreset(id).slug ? subsets(chrome) : []
  return [...reading, ...extra]
}

// A preset's typography = the tuned defaults with a few roles overridden.
function tuned(over: Partial<Record<TypeRole, Partial<TypeStyle>>>): TypographySettings {
  const roles = {} as Record<TypeRole, TypeStyle>
  for (const r of TYPE_ROLES) roles[r] = { ...DEFAULT_TYPOGRAPHY.roles[r], ...over[r] }
  return { roles, smoothing: DEFAULT_TYPOGRAPHY.smoothing }
}

export const FONT_PRESETS: FontPreset[] = [
  {
    // Inter — the geometric UI sans, the historical default. Crisp, even, neutral.
    id: 'inter',
    slug: 'inter',
    name: 'Inter',
    stack: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
    typography: tuned({}),
  },
  {
    // Source Sans 3 — Adobe's humanist sans, and the one preset whose numbers were guessed
    // rather than measured. Measured 2026-07-29 against the other three, at the default
    // 672px column:
    //
    //   preset          body px   x-height   chars/line   leading ÷ x-height
    //   Inter            18.08      10.0        70            3.07
    //   Literata         18.08       9.0        71            3.31
    //   Source Serif 4   18.40       9.0        72            3.31
    //   Source Sans 3    18.40       9.0      * 79 *        * 3.52 *
    //
    // Two things at once, and they compound. The face is NARROW — 7.70px per character
    // against Inter's 8.69 — so the same column takes nine more characters per line, past
    // the 45-75 band this site's defaults are built on. And the old note here reasoned from
    // the short x-height to "loosen the line a hair", which is backwards: a small x-height
    // under a long measure is exactly when the eye loses the return sweep, and 1.72 made it
    // the loosest of the four.
    //
    // The LEADING is fixed here: 1.62 puts it at 3.31 x the x-height, exactly where both
    // serifs sit. The MEASURE is not, and cannot be from this file. Sizing up until 79
    // characters comes back into band needs body ~1.26rem, and two pinned rules in
    // `web/typography.test.ts` refuse it — `small` must stay above 0.8 of body, and the
    // serifs' secondary text must stay larger than the sans's. Both are right: `small` also
    // sets the CHROME, which renders in the chrome font and has no reason to grow with the
    // reading face. Under them the ceiling is ~1.17rem, which moves the measure by one
    // character. So the body goes up only as far as the rules allow, and the real lever is
    // recorded rather than forced: **the measure belongs to `contentWidth`, which a preset
    // does not own.** A reader on this preset wants roughly a 620px column, not 672.
    id: 'source-sans',
    slug: 'sourcesans',
    name: 'Source Sans 3',
    stack: `'Source Sans 3', system-ui, -apple-system, sans-serif`,
    typography: tuned({ body: { size: 1.16, line: 1.62 } }),
  },
  {
    // Literata — Google's book serif (Play Books). A generous x-height, so 18px body
    // is plenty; booklike leading; headings drop the sans's negative tracking; a 600
    // bold so emphasis stays lighter than the headings.
    // A serif's secondary text needs to run a shade larger than a sans's: the strokes are
    // finer and the modulation between thick and thin is what goes first at small sizes.
    id: 'literata',
    slug: 'literata',
    name: 'Literata',
    stack: `'Literata', Georgia, 'Times New Roman', serif`,
    readingBold: 600,
    typography: tuned({
      body: { size: 1.125, line: 1.65 },
      small: { size: 0.95, line: 1.6 }, caption: { size: 0.9, line: 1.5 },
      h1: { spacing: -0.01 }, h2: { spacing: -0.008 }, h3: { spacing: 0 }, h4: { spacing: 0 },
    }),
  },
  {
    // Source Serif 4 — Adobe's screen book serif, sibling to Source Sans. A little
    // finer than Literata, similar reading setup, and the finer strokes are why its
    // secondary text is set at the same size on a slightly tighter line.
    id: 'source-serif',
    slug: 'sourceserif',
    name: 'Source Serif 4',
    stack: `'Source Serif 4', Georgia, 'Times New Roman', serif`,
    readingBold: 600,
    typography: tuned({
      body: { size: 1.15, line: 1.62 },
      small: { size: 0.95, line: 1.58 }, caption: { size: 0.9, line: 1.5 },
      h1: { spacing: -0.01 }, h2: { spacing: -0.008 }, h3: { spacing: 0 }, h4: { spacing: 0 },
    }),
  },
]

export const DEFAULT_FONT_PRESET = 'inter'

export function getFontPreset(id: string): FontPreset {
  return FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0]
}

export function isFontPresetId(id: unknown): id is string {
  return typeof id === 'string' && FONT_PRESETS.some((f) => f.id === id)
}

// Point --font-reading (the article/comment/editor face) at the chosen family —
// NOT --font-sans, which stays Inter for all system chrome. Emitted after globals
// (beats the default) but before fontToCss (an uploaded custom font still wins).
export function fontPresetCss(id: string): string {
  const p = getFontPreset(id)
  const bold = p.readingBold ? `;--reading-bold:${p.readingBold}` : ''
  return `:root{--font-reading:${p.stack}${bold}}`
}

// System-chrome font (Admin → Appearance). Independent of the reading font: it drives
// --font-sans (header/footer/rail/dates/meta/admin) and leaves --font-reading (the
// article body) alone. `sans` is the CSS font-family it points --font-sans at, or null
// for the Inter default (no override — globals' baseline stands):
//   inter     -> Inter (default)
//   reading   -> follow the chosen reading font (the old `fontChromeInter: false`)
//   plex-mono -> IBM Plex Mono, the self-hosted "code" face declared in globals.css
//   jetbrains-mono -> JetBrains Mono, self-hosted variable mono (globals.css)
// Add one = append here (+ its @font-face in globals.css if it's self-hosted).
// `slug` is the file stem the face is served under (`/fonts/<slug>-<subset>.woff2`), or
// null when nothing extra is fetched: `reading` follows the reading font, which is already
// preloaded. It has to match the slug in `render/font-faces.ts` FACES, and a test pins that
// — two lists of the same filenames is exactly how a preload ends up pointing at a 404.
export type ChromeFont = { id: string; name: string; sans: string | null; slug: string | null }
export const CHROME_FONTS: ChromeFont[] = [
  { id: 'inter', name: 'Inter', sans: null, slug: 'inter' },
  { id: 'reading', name: 'Reading font', sans: 'var(--font-reading)', slug: null },
  { id: 'plex-mono', name: 'IBM Plex Mono', slug: 'plexmono-400', sans: `'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', slug: 'jetbrainsmono', sans: `'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` },
]

export const DEFAULT_CHROME_FONT = 'inter'

export function getChromeFont(id: string): ChromeFont {
  return CHROME_FONTS.find((f) => f.id === id) ?? CHROME_FONTS[0]
}

export function isChromeFontId(id: unknown): id is string {
  return typeof id === 'string' && CHROME_FONTS.some((f) => f.id === id)
}

// Repoint --font-sans at the chosen chrome font. Emitted in layout AFTER fontPresetCss +
// fontToCss so 'reading' resolves the reading font already set; '' for the Inter default
// (globals baseline stands).
export function chromeFontCss(id: string): string {
  const f = getChromeFont(id)
  return f.sans ? `:root{--font-sans:${f.sans}}` : ''
}


export const DEFAULT_PRESET_ID = 'mono'

// The default palette every fresh install starts from (also the globals.css fallback). Read
// off the presets rather than re-naming `MONO`, which is private to `palettes.ts`: one
// definition of "the first palette is the default", not two that can disagree.
export const DEFAULT_THEME: ThemeSettings = THEME_PRESETS[0]!.theme

// Look up a preset by id, falling back to the default. Always returns a value.
export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

export function isPresetId(id: unknown): id is string {
  return typeof id === 'string' && THEME_PRESETS.some((p) => p.id === id)
}

// Deep clone a palette so editing one mode never mutates a shared preset object.
export function cloneTheme(t: ThemeSettings): ThemeSettings {
  const copy = (c: ThemeColors): ThemeColors => ({ ...c })
  return { light: copy(t.light), dark: copy(t.dark) }
}

// A fresh id -> palette map seeded from the built-ins (the owner can then
// customize any of them). Cloned so edits never touch the preset constants.
export function defaultThemes(): Record<string, ThemeSettings> {
  const out: Record<string, ThemeSettings> = {}
  for (const p of THEME_PRESETS) out[p.id] = cloneTheme(p.theme)
  return out
}

// The palette a visitor sees by default (owner's `themePreset`), falling back to
// the first preset. Always returns a usable ThemeSettings.
export function getDefaultTheme(themes: Record<string, ThemeSettings>, defaultId: string): ThemeSettings {
  return themes[defaultId] ?? themes[DEFAULT_PRESET_ID] ?? THEME_PRESETS[0].theme
}

// Every built-in palette id, in display order. The default "everything on" set.
export const ALL_PALETTE_IDS: string[] = THEME_PRESETS.map((p) => p.id)

function vars(c: ThemeColors): string {
  return `--c-bg:${c.bg};--c-text:${c.text};--c-heading:${c.heading};--c-meta:${c.meta};--c-link:${c.link};--c-accent:${c.accent};--c-rule:${c.rule}`
}

// CSS for EVERY palette so the switcher swaps instantly via `<html data-palette>`.
// Default also lands on :root/.dark (no-JS baseline); mode-qualified
// `[data-palette].dark` has higher specificity so dark resolves correctly.
//
// DARK BEFORE THE ISLAND SPEAKS. `.dark` is applied by `assets/js/theme.ts`, which is a
// deferred module — so a reader whose system is dark, on the default `system` mode, was
// shown a white page for the length of one paint on every single navigation. There was no
// `prefers-color-scheme` rule anywhere in the public sheet: measured at 0 of 429 rules.
//
// `data-scheme`, NOT `data-theme`: `<body data-theme="…">` already exists and holds the
// translated word "Theme" for the island's button label (`assets/js/dom.ts` reads every UI
// string off `body.dataset`). Two attributes of the same name on parent and child, one a
// sentence and one a mode, is a mix-up waiting to be made.
//
// The handoff is `data-scheme` on `<html>`. Nothing server-rendered sets it (the page cache is
// keyed by URL alone, Invariant 1, so a server-rendered mode would be the first visitor's
// mode for everyone), the island sets it to the RESOLVED light/dark the moment it runs, and
// this block applies only while it is absent. So: no script, correct first paint for the
// system-dark reader, and the island still owns every explicit choice.
//
// The honest cost, because there is one: a reader who explicitly chose LIGHT on a dark system
// now gets the inverse flash, for exactly as long as the dark reader used to get theirs.
// `system` is the default and by far the common case, so this moves the flash off the many
// and onto the few. Removing it entirely needs an inline script, which this project does not
// have anywhere and asserts it does not.
//
// `color-scheme` rides along: it is what makes the scrollbar, the form controls and the
// canvas the browser draws follow the page instead of staying light under a dark one.
//
// NOT mirrored per palette, and now for a smaller reason than before. It used to be that
// nothing set `data-palette` at all; since 2026-08-11 the per-palette rules are only emitted
// when two or more are enabled, so on a one-palette blog there is nothing to mirror. On a blog
// that enables several, mirroring this per palette is the second half of porting the switcher,
// and it is still not free: it doubles a block per palette.
/**
 * `enabled` is `settings.enabledPalettes`: the palettes a reader may switch between, which is
 * the only set worth emitting rules for.
 *
 * It used to emit all six unconditionally — twelve rule sets, ~2 KB on every page — because
 * `settings.themes` always holds all six so that each is customisable in the admin. Whether a
 * palette is CUSTOMISABLE and whether a reader can REACH it are different questions, and this
 * answered the wrong one. A blog with one palette enabled paid for five it had turned off.
 *
 * Fewer than two enabled means no switcher (the control hides itself), so `:root` already IS
 * the palette and no `[data-palette]` block can ever match: emit none. Two or more emits one
 * per enabled palette, INCLUDING the default — a reader who switches away and back sets
 * `data-palette` to the default's own id, so it needs a rule of its own to return to.
 *
 * Omitting `enabled` keeps every palette, which is what the admin shell wants: its preview
 * renders whatever the owner is editing, enabled or not.
 */
export function themesToCss(
  themes: Record<string, ThemeSettings>,
  defaultId: string,
  enabled?: string[],
): string {
  const base = getDefaultTheme(themes, defaultId)
  let css = `:root{color-scheme:light;${vars(base.light)}}.dark{color-scheme:dark;${vars(base.dark)}}`
  const reachable = enabled === undefined
    ? Object.keys(themes)
    : enabled.length < 2 ? [] : enabled.filter((id) => id in themes)
  for (const id of reachable) {
    const t = themes[id]
    if (t === undefined) continue
    css += `[data-palette="${id}"]{${vars(t.light)}}[data-palette="${id}"].dark{${vars(t.dark)}}`
  }
  // `:root:not([data-scheme])` is 0,2,0 — above both `:root` and `[data-palette="…"]`, and
  // never in a fight with `.dark`, which only exists once `data-scheme` does.
  css += `@media (prefers-color-scheme:dark){:root:not([data-scheme]){color-scheme:dark;${vars(base.dark)}}}`
  return css
}
