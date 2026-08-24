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
export type GallerySettings = {
  /** '' = the photos keep their own proportions, so rows are as tall as their tallest tile. */
  ratio: '' | '1x1' | '3x2' | '4x3'
  /** Print the alt under each tile. Off hides it in CSS; the alt is still in the HTML. */
  captions: boolean
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
 * switch (owner's call, 2026-08-24). The three are not three volumes of one sound:
 *
 *  - `typewriter` — the machine that moves. A bright, hard strike, and the caret takes a
 *    small step with it, because on a typewriter the carriage is the thing that responds.
 *  - `tactile` — a mechanical keyboard with a bump partway down: two transients a few
 *    milliseconds apart, the bump and then the bottom-out.
 *  - `linear` — the same board with no bump: one softer, lower thock, and nothing moves.
 *
 * `off` is the browser's own caret and silence.
 */
export type KeyFeedback = 'off' | 'typewriter' | 'tactile' | 'linear'

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
