// The settings GROUPS: one type per feature the owner can switch, size or colour.
//
// Split out of `src/types.ts` on 2026-08-24, when adding `InkSettings` put that file over
// the 400-line ceiling. The seam is not the line count: `types.ts` describes what this site
// IS — a post, a page, a comment, an upload, the assembled `SiteSettings` — and everything
// below describes one KNOB on it. The two are read at different times by different people.
//
// Re-exported from `@/types`, so no import site had to change. That is the same bargain
// `admin/components/scale.ts` made when it left the kit: a split nobody has to learn.

// MCP server settings. Just an on/off switch — the access tokens live in their own
// `mcp_tokens` table (hashed), managed from Admin → Settings → Advanced.
/**
 * The automatic jobs, not the credentials: provider/key/model live in `integration_keys`
 * and never reach a client payload. Every switch here defaults ON — the master switch is
 * the key itself, and without one no job runs regardless of what these say.
 */
export type AiSettings = {
  altText: boolean // describe uploaded images in the site's language
  excerpt: boolean // write the excerpt when a post publishes with the field left blank
  commentGuard: boolean // hold spam comments in the Trash for review
}

export type McpSettings = {
  enabled: boolean // when false, /api/mcp + the OAuth flow are disabled
}

/**
 * What `/` serves. ADR 0014.
 *
 * `list` is what this has always been and stays the default, byte for byte: an install that
 * upgrades into this feature must see no change until somebody chooses one. The composed
 * front page (`front`) is part 2 and is not in the union until it renders.
 */
export type HomeSettings = {
  mode: 'list' | 'page' | 'front' // 'list' = page 1 of the post list at /; 'page' = a chosen page; 'front' = the composed front page
  page: string // the slug rendered at / in 'page' mode. Empty, missing, unpublished or trashed falls back to the list
  listPath: string // where the post list is mounted once it leaves / ('/post' by default). Leading slash, no trailing one
  front: FrontSettings // the composed front page, used only in 'front' mode
}

/**
 * The composed front page. ADR 0014.
 *
 * The ROW ORDER is fixed in code and is not a setting: this is a prepared layout with
 * options, not a block composer. What settings choose is which rows appear, how big they
 * are, and where their posts come from.
 *
 * `kind` is the one dial that moves the whole page. It is not two layouts: an image site
 * leads with a picture and a short standfirst, a text site drops the picture, raises the
 * headline a step and lets the standfirst run. Measured on the NYT front page, most stories
 * carry no image at all, so the same grammar serves both.
 */
export type FrontSettings = {
  kind: 'image' | 'text'
  lead: {
    on: boolean
    source: 'latest' | 'pinned' // 'latest' = the newest public post; 'pinned' = `slug`
    slug: string // the pinned post; ignored (and falls back to latest) when it is not public
    secondary: number // headline-only posts stacked under the lead, 0-3
  }
  featured: { on: boolean; count: number; columns: number } // from settings.featured, the owner's own list
  strips: FrontStrip[] // one row per category, in this order
  popular: { on: boolean; count: number; days: number } // days: 7, 30, or 0 for all time
  latest: { on: boolean; count: number; columns: number }
  showDate: boolean
  showReadingTime: boolean
  tagLinks: boolean // the topic links beside a strip's category label; hidden under 3 tags
}

export type FrontStrip = {
  category: string // the category NAME, as stored on posts
  count: number
  columns: number
}

/**
 * How a gallery looks, site-wide.
 *
 * These are DEFAULTS, and they are applied as CSS variables rather than baked into the
 * rendered HTML. That is not a style choice: rendered Markdown is cached under a hash of
 * its input, so a default that changed the markup would leave every already-rendered body
 * serving the old shape until something unrelated evicted it.
 *
 * A gallery that names its own shape in the image fragment (`#grid-1x1`, `#grid-nocap`)
 * overrides these. One that says nothing follows them, which is what makes a whole
 * imported site fixable from one screen.
 */
/**
 * The frame every picture wears unless it says otherwise, site-wide.
 *
 * Same contract as GallerySettings below and for the same reason: applied as CSS variables,
 * never baked into the markup, because a rendered body is cached under a hash of its INPUT —
 * a default that rewrote HTML would leave every already-rendered post showing the old frame
 * until something unrelated evicted it. Here it also means the setting is instant: change it
 * and every picture on the site is reframed on the next paint, with nothing re-rendered.
 *
 * A picture that names its own frame in the fragment (`#frame-thick`, `#noframe`) overrides
 * this. One that says nothing follows it — which is the point, and the same reason the
 * gallery defaults exist: an imported archive is fixed from one screen rather than one
 * picture at a time.
 *
 * `none` at install, deliberately. A frame is a decision about a site's voice, and arriving
 * with one already made is the kind of default nobody asked for.
 */
export type FigureSettings = {
  frame: 'none' | 'thin' | 'medium' | 'thick'
  /** The mat is ink instead of paper. It inverts by itself in dark mode. */
  ink: boolean
}

export type GallerySettings = {
  /** '' = the photos keep their own proportions, so rows are as tall as their tallest tile. */
  ratio: '' | '1x1' | '3x2' | '4x3'
  /** Print the alt under each tile. Off hides it in CSS; the alt is still in the HTML. */
  captions: boolean
}

/**
 * Where a post's own picture is allowed to appear.
 *
 * `featuredImage` has been stored since the port and, until 2026-08-29, appeared in exactly
 * two places a reader could see: the share card, and a front-page card in newspaper mode.
 * The article itself never showed it, and the ordinary post list had no `<img>` in it at
 * all — so a blog about objects (a flashlight review, a recipe, a trip) could not put a
 * picture on its own front door without switching its whole homepage to the newspaper
 * layout. The pictures were already stored, already resized, already served; only the
 * showing was missing.
 *
 * BOTH DEFAULT TO `none`, and that is the load-bearing part. Turning a picture on is a
 * decision about a site's voice — the same argument `FigureSettings.frame` makes for
 * arriving frameless — and a default that grew a hero on every existing article would be a
 * redesign nobody asked for, delivered by an upgrade.
 */
export type PostImageSettings = {
  /**
   * The picture at the top of an article: the width of the reading column, or nothing.
   *
   * THERE IS NO WIDER OPTION, and that is a measurement rather than a preference. A `wide`
   * hero was built and removed the same afternoon: at contentWidth 672 on a 1440 viewport
   * the left rail measured 126-376 while a broken-out hero started at 264, so it printed
   * over the table of contents. The band between the two rails is EIGHT pixels either side
   * of the column, and it does not grow with the viewport — the rails are positioned
   * against the column and travel with it.
   *
   * `render/rail-css.ts` had already litigated the same collision for in-body pictures:
   * `.img-wide` noses into the right gutter only, and stops doing even that in the first
   * two blocks, "because a photograph with Tags printed across it is the worse of the two
   * failures". A hero is permanently in those first two blocks.
   */
  hero: 'none' | 'inline'
  /**
   * The picture on a row of the post list.
   * `side` = a small square beside the words. `top` = above the title, card-like, which is
   * also the shape the grid view wants.
   *
   * A thumbnail's shape is NOT a setting and is always cropped — square beside the words,
   * 3:2 above the title. A gallery gets a ratio choice because a gallery IS the
   * photographs; a list thumbnail is chrome whose job is recognition, and a column of
   * mixed heights is nobody's intention. Measured with three real images on 2026-08-29:
   * ratios 0.70, 2.10 and 0.72 produced a tall block, a thin strip and a tall block down
   * one edge of the list.
   */
  thumb: 'none' | 'side' | 'top'
  /**
   * The hero's shape. '' keeps the photograph's own proportions, which is the default
   * because an article has room for one picture and cropping it is a decision.
   *
   * Whatever this says, a hero is capped at 70vh (`postimage.css.ts`): a portrait at the
   * column's width is 960px tall on a 672px column, which is a whole screen of picture
   * before the first sentence.
   */
  ratio: '' | '1x1' | '3x2' | '4x3' | '16x9'
}

/**
 * The three knobs that change SHAPE rather than colour.
 *
 * The gap they close was measured on 2026-08-29 across three real sites: with 84 colour
 * fields and 27 type numbers available, the whole visible difference between them was two
 * colour values nobody can see. Every existing knob adjusts colour, size, or whether a
 * block is present; none of them changes the shape of the thing, and shape is what an eye
 * uses to tell two blogs apart.
 *
 * Each `normal`/today value below reproduces the current site EXACTLY, so this type can be
 * added to an existing blog without moving a pixel until somebody chooses to move it.
 */
export type ShapeSettings = {
  /**
   * How much air. Multiplies `--sp`, the article's spacing unit, which every gap around
   * the reading column is already a multiple of (`content/settings-css.ts`). It rides the
   * same variable book mode scales, so the two compose instead of fighting.
   */
  density: 'compact' | 'normal' | 'relaxed'
  /** Corner radius for the site's boxes. Pills and avatars keep their own shape. */
  radius: 'square' | 'soft' | 'round'
  /**
   * How heavy headlines sit. `normal` is today's pair exactly — 700 for a post title, 600
   * for a card title — because those two were never the same number and collapsing them
   * into one knob would itself be a redesign.
   */
  headingWeight: 'light' | 'normal' | 'bold'
}

/**
 * Who wrote this. One blog, one owner (ADR 0002), so this is a single person and not a
 * table of them.
 *
 * It did not exist until 2026-08-29, and its absence was louder than it looks: every
 * `BlogPosting` this software has ever emitted went out with no `author` at all, on every
 * blog, which is the one structured-data field search engines lean on hardest when they
 * are deciding whether a page was written by somebody. `render/schema.ts` said so in a
 * comment — "No `author`, because this software has no owner-name setting" — and that was
 * the whole reason.
 *
 * `name: ''` is the default and means silence: no byline, no author box, no `author` in
 * the JSON-LD. An existing blog upgrades into exactly what it had.
 */
export type AuthorSettings = {
  /** '' = no byline anywhere, and no `author` in the structured data. */
  name: string
  /** A sentence or two under an article. '' = no author box, even when a name is set. */
  bio: string
  /** Square portrait for the author box. '' = the box renders without one. */
  avatarUrl: string
  /** Where the name links to (a homepage, a profile). '' = the name is plain text. */
  url: string
}

// Motion engine: ONE site-wide switch for all UI animation (public + admin). When
// off (or under prefers-reduced-motion) every motion duration collapses to 0s.
export type CacheSettings = {
  /**
   * On: public HTML is held in the page cache and a shared cache may hold it for a minute.
   * Off: neither. Both halves move together on purpose — turning off only the in-process
   * cache leaves a CDN in front of the site still answering with the copy you are trying to
   * get rid of, which is the exact confusion the switch exists to end.
   */
  enabled: boolean
}

/**
 * The pen's colours, and the selection highlight. EVERY FIELD IS AN OVERRIDE, and '' means
 * "the built-in", which is why the defaults are all empty strings.
 *
 * That shape is the whole design. ADR 0018 measured the five highlighter pigments off a
 * photograph of a real pen box and hand-tuned each one twice more (a dark-page mix audited
 * at 5.0:1, and a ballpoint-strength line version, because a pale sweep is invisible as a
 * 2px underline). Storing a full colour here would mean shipping a copy of those values into
 * every install's database, where they could never be corrected again. An override left
 * empty keeps the measured ink; an override that is set derives its own dark and line
 * variants (`render/pen-derive.ts`) from the one colour somebody chose.
 *
 * Owner's call, 2026-08-24, amending ADR 0018's "the colours are NOT a setting": the
 * argument there is that a highlighter should not restyle itself per PALETTE, and that still
 * holds — one pen for the whole site, whatever the reader picks. Which pen it is, is his.
 */
export type InkSettings = {
  yellow: string // '' = the measured pigment. Hex, with or without '#'
  green: string
  pink: string
  blue: string
  orange: string
  ring: string // the ballpoint a circled word defaults to; '' = the built-in red
  underline: string // the pencil an underline defaults to; '' = the built-in graphite
  selection: string // what dragging across text looks like on a light page; '' = the heading colour
  selectionDark: string // ...and on a dark one; '' = the palette's mid grey
}

/**
 * What the editor does when a key lands, and it is a CHOICE OF INSTRUMENT rather than a
 * switch (owner's call, 2026-08-24).
 *
 * ⚠️ THE NAMES ARE NOT THE NAMES OF REAL MACHINES, and that is deliberate as of 2026-08-25.
 * They were: `typewriter`, `tactile`, `linear`. The synthesis is genuinely modelled on those
 * three mechanisms and says so at length in `key-voices.ts` — but the owner listened and
 * said the honest thing: *"nghe chưa giống đồ thiệt cho lắm... đừng nên gọi tên thiệt, vì ko
 * làm giống được"*. A name that promises a Underwood and delivers a good synthesised knock
 * is a name that makes the sound worse by comparison. So they are named for what they ARE:
 *
 *  - `woody` — the deep, wooden one. A lever, something striking a hard surface, and a small
 *    bright mechanism finishing after it. Three events across 60ms.
 *  - `crisp` — the sharp one. Two transients 14ms apart, bright, gone in 40ms.
 *  - `deep`  — the round one. A blunt onset, a low body letting go slowly, one quiet tick as
 *    it comes back.
 *
 * `off` is the browser's own caret and silence.
 */
export type KeyFeedback = 'off' | 'woody' | 'crisp' | 'deep'

export type MotionSettings = {
  enabled: boolean
  keys: KeyFeedback // admin editor: the caret, and what a keystroke sounds like
  /**
   * How loud that keystroke is, 0-100, as a plain fraction of full volume.
   *
   * A setting rather than a constant since 2026-08-25: it shipped at a fixed level and the
   * owner's verdict was "tiếng có vẻ nhỏ". Loudness is not a thing that has a right answer
   * — it is a room, a pair of speakers and a person, and the person is the only one of the
   * three this program can ask. 0 leaves the caret and takes the sound away, which is a
   * different thing from `keys: 'off'` and worth having: some people want the caret.
   */
  keyVolume: number
}

// Google Drive backup config (non-secret, lives in settings.data). The Drive
// refresh token + run state are kept server-only in the `backup_state` table.
export type BackupSettings = {
  enabled: boolean // when true, the cron runs a full snapshot every intervalDays
  intervalDays: number // days between automatic full snapshots (default 4)
  keep: number // how many most-recent snapshots to retain on Drive (default 4)
}
