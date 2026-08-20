// FONTS: the reading presets, the chrome face, and the typography tuned for each.
//
// Split out of `themes.ts` on 2026-08-15 for the same reason `palettes.ts` was in August:
// the file held two subjects and the 400-line cap came due. The seam is real rather than
// arbitrary — a PALETTE is colour and a PRESET is a typeface plus the reading setup that
// face wants, and nothing here reads a theme.
//
// The dependency runs ONE WAY. This file imports nothing from `themes.ts`; `themes.ts`
// re-exports everything below, so all 22 existing importers are untouched. Do not add an
// import back the other way: `FONT_PRESETS` is built at module load by `tuned()`, and a
// cycle would have it read `DEFAULT_TYPOGRAPHY` before that const is initialised — a
// temporal-dead-zone crash at boot, not a type error.

import type { TypographySettings, TypeRole, TypeStyle, FontSettings } from '@/types'


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
// Mirror any change in the table in docs/conventions/type.md.
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

/**
 * THE CJK TAIL, and why a stack that ends at `serif` is not already enough.
 *
 * None of the four bundled faces carries a Han, kana or hangul glyph, and no subset in
 * `src/render/fonts` does either — a CJK webfont is megabytes, which is why the fixture's
 * note said CJK was "deliberately absent". That note was about what we SHIP, and that part
 * has not moved. It was never an argument for letting the stack end at the generic keyword.
 *
 * A missing glyph does not fail: the browser reaches past the whole list to its own
 * last-resort face, and that choice is nobody's. The page renders — differently on every
 * machine, at an optical size nothing here picked, with no setting anywhere that explains
 * it. Naming the faces costs zero bytes (they are already installed) and takes the choice
 * back.
 *
 * ONE STACK CANNOT SERVE ALL THREE LANGUAGES, and this is the part worth reading twice.
 * 直, 直 and 直 are one Unicode character drawn three ways, and a font-family list resolves
 * to the first INSTALLED family without ever consulting the language of the text. So a
 * single tail with `PingFang SC` at its head sets Japanese prose in Chinese letterforms on
 * every Mac — not a fallback, the primary rendering. The first cut of this file did exactly
 * that, and put `Yu Mincho` (Japanese) ahead of `SimSun` (Chinese) for Windows readers too.
 *
 * Hence one tail PER LANGUAGE below, and `cjkLangCss` to switch between them on `:lang()`.
 * A Japanese site gets Japanese shapes because `<html lang="ja">` selects them, and the day
 * a post carries its own language the same rules start working per post with no change here.
 */
type CjkTail = { serif: string; sans: string }

/** Chinese: macOS, then Windows, then the Noto families a Linux desktop ships. */
const CJK_ZH: CjkTail = {
  serif: `'Songti SC', 'SimSun', 'Noto Serif CJK SC', 'Noto Serif SC'`,
  sans: `'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC'`,
}

/** Japanese. `ProN` rather than `Pro`: the N faces carry the JIS2004 glyph shapes. */
const CJK_JA: CjkTail = {
  serif: `'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP', 'Noto Serif JP'`,
  sans: `'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', 'Noto Sans JP'`,
}

/**
 * Korean. Apple ships no system myeongjo (serif), so the serif list falls to a gothic on a
 * Mac without Nanum installed — correct, and better than a Chinese serif drawing hangul.
 */
const CJK_KO: CjkTail = {
  serif: `'Nanum Myeongjo', 'Apple SD Gothic Neo', 'Noto Serif CJK KR', 'Noto Serif KR'`,
  sans: `'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR'`,
}

/**
 * What a site that is NOT in a CJK language gets, and why the order is Chinese first.
 *
 * This is the demo's own case and the common one: an English blog with the occasional CJK
 * quotation or post. There is no right answer — any order sets two of the three languages in
 * the third one's letterforms — so it goes to the one with the most readers, and the fact
 * that it IS a guess is why the `:lang()` rules exist to override it the moment a site says
 * which language it is in.
 */
const CJK_ANY: CjkTail = {
  serif: `${CJK_ZH.serif}, ${CJK_JA.serif}, ${CJK_KO.serif}`,
  sans: `${CJK_ZH.sans}, ${CJK_JA.sans}, ${CJK_KO.sans}`,
}

const CJK_SERIF = CJK_ANY.serif
const CJK_SANS = CJK_ANY.sans

const CJK_BY_LANG: Record<string, CjkTail> = { zh: CJK_ZH, ja: CJK_JA, ko: CJK_KO }

/**
 * Re-point the reading and chrome faces at ONE language's CJK tail, on `:lang()`.
 *
 * Emitted for all three regardless of the site's own language, because `:lang()` matches the
 * nearest ancestor that declares one: today that is `<html lang>` and only one rule can win,
 * and if a post ever carries `lang="ja"` the same stylesheet starts setting that post in
 * Japanese shapes with nothing else to change. About 700 bytes before compression, which is
 * the whole budget this buys back a page of correctly drawn Han for.
 *
 * The Latin head is unchanged — it is `stack` with its own tail swapped — so a mixed line
 * still sets its Latin words in the reading face.
 */
export function cjkLangCss(presetId: string): string {
  const { stack } = getFontPreset(presetId)
  // Which half the preset is, read off the stack it already carries rather than taken as an
  // argument or as a new `serif: boolean` field. A caller cannot get this wrong if it is
  // never asked, and a preset added later gets the right tail by construction.
  const serif = stack.includes(CJK_SERIF)
  const head = stack.split(`, ${serif ? CJK_SERIF : CJK_SANS}`)[0]
  if (!head) return ''
  const generic = serif ? 'serif' : 'sans-serif'
  return Object.entries(CJK_BY_LANG)
    .map(([lang, tail]) => `:lang(${lang}){--font-reading:${head}, ${serif ? tail.serif : tail.sans}, ${generic}}`)
    .join('')
}

export const FONT_PRESETS: FontPreset[] = [
  {
    // Inter — the geometric UI sans, the historical default. Crisp, even, neutral.
    id: 'inter',
    slug: 'inter',
    name: 'Inter',
    stack: `'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', ${CJK_SANS}, sans-serif`,
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
    stack: `'Source Sans 3', 'Source Sans 3 Fallback', system-ui, -apple-system, ${CJK_SANS}, sans-serif`,
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
    stack: `'Literata', 'Literata Fallback', Georgia, 'Times New Roman', ${CJK_SERIF}, serif`,
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
    stack: `'Source Serif 4', 'Source Serif 4 Fallback', Georgia, 'Times New Roman', ${CJK_SERIF}, serif`,
    readingBold: 600,
    typography: tuned({
      body: { size: 1.15, line: 1.62 },
      small: { size: 0.95, line: 1.58 }, caption: { size: 0.9, line: 1.5 },
      h1: { spacing: -0.01 }, h2: { spacing: -0.008 }, h3: { spacing: 0 }, h4: { spacing: 0 },
    }),
  },
]

/**
 * What a FRESH INSTALL reads in. The owner's call on 2026-08-21: Literata to read and
 * JetBrains Mono for the furniture — the pairing this project's own instances converged on,
 * so a new blog now starts where they finished rather than at the neutral sans.
 *
 * Existing installs are untouched: `getSettings` only reaches for these when the stored
 * blob names no font at all, and every instance has stored one since its first save.
 */
export const DEFAULT_FONT_PRESET = 'literata'

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

export const DEFAULT_CHROME_FONT = 'jetbrains-mono'

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

