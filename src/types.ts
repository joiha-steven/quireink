// Core domain types shared across the app.

export type PostStatus = 'draft' | 'published'

// Frontmatter + metadata for a single post.
// Stored as YAML frontmatter inside posts/{slug}.md and mirrored in _index.json.
export type Post = {
  title: string
  slug: string // custom URL, auto-generated from title if empty
  date: string // ISO 8601, past/present/future all valid
  status: PostStatus
  categories: string[]
  tags: string[]
  featuredImage?: string // stored image URL; used only for SEO/social meta, never shown
  excerpt?: string // auto-extracted from first paragraph if empty
  readingMinutes?: number // estimated read time, computed from the body at save (for lists)
  series?: string // optional series/collection name this post belongs to (undefined = none)
  seriesOrder?: number // position within the series (ascending); undefined when no series
  metaTitle?: string // SEO <title> override (else the post title)
  metaDescription?: string // SEO description/OG override (else the excerpt)
  coverImage?: string // visible hero image shown at the top of the post
  updatedAt?: string // ISO 8601 of the last save; surfaces "Updated" + JSON-LD dateModified
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// Full post = metadata + markdown body.
export type PostWithContent = Post & {
  content: string
}

// A snapshot of a post taken right before it was overwritten. Up to 3 are kept
// per slug at revisions/{slug}.json so the editor's "time machine" can restore
// recently-overwritten versions.
export type PostRevision = PostWithContent & {
  savedAt: string // ISO 8601, when the snapshot was taken
}

// A static page (About, Contact...). Like a post but with no taxonomy or date:
// not part of the feed, only reachable directly at /page/{slug}.
export type Page = {
  title: string
  slug: string
  status: PostStatus
  featuredImage?: string // stored image URL; used only for SEO/social meta, never shown
  updatedAt?: string // ISO 8601 of the last save; the admin's one list sorts on it
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// Full page = metadata + markdown body.
export type PageWithContent = Page & {
  content: string
}

// One entry in media/_index.json.
export type MediaItem = {
  url: string // ORIGINAL (uncompressed) — stored store-relative, absolute on read
  filename: string
  size: number // bytes of the original
  uploadedAt: string // ISO 8601
  width?: number // original pixel dimensions (raster only)
  height?: number
  thumb?: string // library thumbnail — store-relative, absolute on read
  variants?: boolean // true if responsive -1024/-1600 (avif+webp) were generated
  alt?: string // AI-suggested or owner-edited description; the editor's default alt
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// A non-image file in the "Files" library (PDF, zip, docx, audio…). Stored under
// `files/` in the local store with its own manifest, separate from the image media library.
export type FileItem = {
  url: string // store-relative, absolute on read
  filename: string // display name (original upload name)
  size: number // bytes
  contentType: string // MIME type as uploaded
  uploadedAt: string // ISO 8601
  deletedAt?: string // ISO 8601; set only on trashed (soft-deleted) rows, else undefined
}

// Site-wide settings, stored at settings/site.json.
export type SiteLang = 'vi' | 'en' | 'de' | 'ja' | 'zh' | 'ko'

// One configurable header navigation link (page, category, or custom URL).
export type MenuItem = {
  label: string
  href: string
}

// Customizable reading-surface colors (one set per light/dark mode). All hex.
export type ThemeColors = {
  bg: string // page background
  text: string // body text
  heading: string // h1/h2/h3 titles
  meta: string // secondary text (dates, captions)
  link: string // links
  rule: string // horizontal rule (---) and borders
  accent: string // the ONE highlight: active sidebar row, title hover underline. Seeded from `link` (so mono stays monochrome)
}

export type ThemeSettings = {
  light: ThemeColors
  dark: ThemeColors
}

// The tunable typographic roles. Every piece of text on the public site maps to
// exactly one — no per-element hardcoded sizes. Each emits CSS vars
// (--fs-<role>, --lh-<role>, --ls-<role>).
export type TypeRole =
  | 'h1' // page/post titles + body H1 — biggest
  | 'h2' // list-card titles + body H2
  | 'h3'
  | 'h4'
  | 'h5'
  | 'body' // normal reading text (article body)
  | 'small' // secondary UI text: dates, meta, related, ToC, pagination, search
  | 'caption' // figure captions
  | 'code' // code blocks + inline code (monospace)

// One role's tuning: size (rem), line-height (unitless), letter-spacing (em).
export type TypeStyle = {
  size: number
  line: number
  spacing: number
}

// Full type system: a style per role + the global font-smoothing toggle. One
// source of truth, injected as CSS vars; owner-customizable with reset-to-default.
export type TypographySettings = {
  roles: Record<TypeRole, TypeStyle>
  smoothing: boolean // antialiased font-smoothing on body (off = browser default)
}

// One uploaded weight of the custom typeface.
export type FontFace = {
  weight: number // 400 | 500 | 600 | 700
  url: string // store URL; store-relative at rest, absolute on read
}

// Owner-uploaded custom typeface (stored under files/). All faces share one
// `family`, registered via @font-face per weight so bold/heading text is crisp (the
// site disables faux-bold synthesis). Empty family / no faces = bundled Inter.
export type FontSettings = {
  family: string // CSS font-family name; '' = no custom font
  faces: FontFace[] // one per uploaded weight (400/500/600/700)
}

// Search-engine / AI-crawler features, each independently toggleable.
export type SeoSettings = {
  autoSchema: boolean // inject JSON-LD structured data (WebSite + Article)
  sitemap: boolean // serve /sitemap.xml
  llms: boolean // serve /llms.txt (content index for AI crawlers)
  robots: boolean // serve a crawl-friendly robots.txt referencing the sitemap
  rss: boolean // serve /feed.xml (RSS 2.0)
  ogImage: boolean // generate a dynamic OG share image per post/page
  ogFallbackImage: string // image used when a post has no featured image; '' = none
}

// Feature toggles (Admin -> Settings -> Tính năng). Mostly reader-facing; the last
// one (activityLog) is an admin feature.
export type FeatureSettings = {
  search: boolean // header search icon + /search page
  toc: boolean // table of contents on long posts (the post sidebar)
  related: boolean // related posts at the end of an article
  readingTime: boolean // reading-time estimate in the post meta
  progressBar: boolean // reading-progress bar on posts
  activityLog: boolean // record admin mutations to the activity log (Admin -> Log)
  sidebar: boolean // categories + tags in the left gutter of the post list
  sidebarSeries: boolean // the series list in the sidebar, under the categories
  leadPost: boolean // first post of page 1 gets the h1 role instead of h2
  categoryLabel: boolean // category name in the meta line of cards and post headers
  deck: boolean // the excerpt shown as a standfirst under a post title
  bookText: boolean // running text set like a book: first-line indent, justified >=600px
  penUnderline: boolean // ++text++ drawn as a hand-drawn pen line; off = the browser's straight underline
  penRing: boolean // @@word@@ drawn as a ballpoint ring; off = the words stay plain
  bookMode: boolean // reader can open a post as a fullscreen 2-column "book" (desktop/iPad)
  infiniteScroll: boolean // reveal posts on scroll instead of pagination; adds a date timeline in the right gutter (desktop)
  gridView: boolean // reader can switch the listing to a card grid (header grid/list toggle); off = list only
}

export type SiteSettings = {
  language: SiteLang // public site language: drives lang attr, font, labels, dates
  title: string
  description: string
  siteUrl: string // canonical base URL (e.g. https://example.com); '' -> derive from env
  logoUrl: string // '' when no logo — the ALWAYS-kept original source the owner picked
  logoWidth: number // px, horizontal width of the logo in the header
  logoRenderUrl: string // derived, display-sized WebP (2x for retina) generated from logoUrl at logoWidth; '' = serve original (vector/animated, or none). Regenerated + old one deleted whenever logoUrl/logoWidth change
  logoRenderHeight: number // displayed height (px) of the logo at logoWidth — set width+height on the <img> to reserve space (no CLS); 0 when unknown
  logoEmailUrl: string // derived PNG twin of the logo, for the newsletter masthead ONLY. '' = none (vector/undecodable source), then the email falls back to the site name as text. PNG because WebP is unrenderable in Outlook on Windows and the web render is always WebP
  logoDarkUrl: string // '' = none, and then the normal logo is used in dark mode too. A logo is ink on transparency: a dark mark measures ~3.4:1 on the dark background and reads as a black smudge
  logoDarkRenderUrl: string // derived, same pipeline as logoRenderUrl, at the same logoWidth
  logoDarkRenderHeight: number // displayed height (px); 0 when unknown
  showLogo: boolean
  showDescription: boolean
  fontPreset: string // built-in font choice id (lib/themes FONT_PRESETS); '' -> Inter
  ideChrome: boolean // dress the SYSTEM CHROME as source code (comment markers on rail headings, bracketed counts in the accent, an editor line-number gutter). Deliberately a switch: the contrast it creates with an analogue reading column is a taste, and a taste has to be reversible in one click. Public site only; the admin has its own scale
  chromeFont: string // system-chrome font (lib/themes CHROME_FONTS): 'inter' | 'reading' (follow the reading font) | 'plex-mono' (IBM Plex Mono). Drives --font-sans (header/footer/rail/meta/admin); leaves the article body alone
  faviconUrl: string // browser-tab icon; '' = the bundled default favicon
  appIconUrl: string // PWA / home-screen app icon (square); '' = favicon, else bundled default
  autosaveSeconds: number // how often the editor stashes a local snapshot while you type, in seconds. NOT a server autosave — see admin/components/useLocalDraft.ts, which rejects one on the grounds that it cannot help when the network is what dropped and would push half-finished edits onto a published post. The floor is 15s: at a long interval the flush on hide is what actually keeps work safe, and that one is not optional
  maxUploadMb: number // largest single upload, in MB (0 = whatever the deployment allows). ONLY EVER NARROWS the MAX_UPLOAD_MB ceiling: the operator's number is the one an upload cannot argue with, and this field can lower it but never raise it (media/limits.ts)
  storageQuotaGb: number // largest the whole blob store may grow, in GB (0 = whatever the deployment allows). Counts derived variants and icons, because on a photo blog those are most of the disk. Same narrow-only rule as maxUploadMb
  /** Has the owner dismissed the first-run steps? Set once, never unset by the app. */
  firstRunDone: boolean
  contentWidth: number // px, max width of the content column (desktop)
  postsPerPage: number // posts shown per page on home/category/tag lists
  relatedCount: number // related posts shown at the end of an article (0 = none)
  excerptLength: number // words auto-used as a post excerpt when none is set
  customCss: string // owner CSS injected into PUBLIC pages only ('' = none)
  footer: string // footer content: limited inline markdown (bold/italic/underline/link) + {year}/{title} tokens
  menu: MenuItem[] // header navigation links
  featured: string[] // owner-curated post slugs shown in the sidebar "Featured" block, in this order (first 5 render); auto-drops any that stop being public
  mostViewedCount: number // how many posts the sidebar "Most viewed" block shows (0 = hide the block)
  sidebarLayout: 'single' | 'two' // listing sidebar: 'single' = one left rail (all blocks stacked); 'two' = discovery-left + nav-right rails with a narrower column (desktop). Mobile is one drawer either way
  defaultScheme: 'system' | 'light' | 'dark' // what a FIRST-TIME visitor opens in; 'system' follows their OS. A reader's own pick always wins over this (theme.ts)
  themePreset: string // default palette for visitors (one of THEME_PRESETS ids)
  enabledPalettes: string[] // palettes a visitor may switch between (subset of THEME_PRESETS ids); ALWAYS includes themePreset. <2 enabled => the switcher is hidden
  themes: Record<string, ThemeSettings> // per-palette reading colors (owner-customizable); keyed by preset id
  typography: TypographySettings // type scale + reading rhythm → CSS vars (--fs-*, --lh-body, --ls-body)
  customFont: FontSettings // owner-uploaded typeface (files/); '' = bundled Inter
  home: HomeSettings // what `/` serves, and where the post list lives when it is not there
  gallery: GallerySettings // site-wide default shape + caption state for in-body galleries
  seo: SeoSettings // SEO / crawler feature toggles
  features: FeatureSettings // reader-facing feature toggles
  comments: CommentSettings // reader comment system (off by default)
  mcp: McpSettings // MCP server toggle (tokens are managed separately)
  ai: AiSettings // which jobs the AI model does automatically (the key lives server-only)
  motion: MotionSettings // site-wide motion/animation engine toggle
  cache: CacheSettings // page cache + shared-cache headers for public HTML
  backups: BackupSettings // Google Drive backup config (secrets live in backup_state)
  timezone: string // IANA zone the WHOLE site reads its clock in: the date under a post, the month markers, and the day an analytics bucket starts on. Empty = the `ANALYTICS_TZ` variable, then UTC. It is a SETTING and not the machine's own zone on purpose — a page is rendered once and cached, so the server's timezone would otherwise decide what date every reader sees, and moving the box would silently move every date on the site
  updateCheck: boolean // ask check.quireink.com once a day what the newest release is, and be counted by asking. ON by default: a number nobody opts into is a number that means nothing, and the owner knew that when they chose the default. Off = the blog never calls out at all. `server/update-check.ts` states exactly what the call carries; `UPDATE_CHECK=0` turns it off for every instance on a box, whatever this says
}

// Reader comment system. Booleans only — NO secrets here (this object is sent to
// the admin client). Turnstile / OAuth keys live in env; a toggle is only EFFECTIVE
// when its env keys are present (the UI flags a toggle that lacks them).
export type CommentSettings = {
  enabled: boolean // master switch — when false, no comments are shown or accepted
  turnstile: boolean // require a Cloudflare Turnstile pass for manual (name/email) comments
  googleAuth: boolean // offer "Sign in with Google" to commenters
}

// Where a comment's identity came from.
export type CommentProvider = 'manual' | 'google'

// One comment as sent to the PUBLIC client. Email is NEVER included. A tombstone
// (`deleted: true`) is a soft-deleted node kept only because it still has live
// replies — its name/content are blanked. `replies` nest up to 3 tiers.
export type PublicComment = {
  id: number
  parentId: number | null
  name: string
  website?: string
  provider: CommentProvider
  contentHtml: string // limited markdown, already rendered + sanitized
  createdAt: string
  deleted: boolean
  replies: PublicComment[]
}

// One comment as shown in the admin table (flat; includes email + post title).
export type AdminComment = {
  id: number
  postSlug: string
  postTitle: string
  name: string
  email: string
  website?: string
  provider: CommentProvider
  content: string // raw markdown source
  ip?: string // commenter IP captured at submit (empty for pre-feature rows)
  country?: string // ISO 3166-1 alpha-2 from a proxy/CDN header (empty when absent)
  createdAt: string
  deletedAt?: string
}

// MCP server settings. Just an on/off switch — the access tokens live in their own
// `mcp_tokens` table (hashed), managed from Admin → Settings → Advanced.
/**
 * The automatic jobs, not the credentials: provider/key/model live in `integration_keys`
 * and never reach a client payload. Every switch here defaults ON — the master switch is
 * the key itself, and without one no job runs regardless of what these say.
 */
export type AiSettings = {
  altText: boolean // describe uploaded images in the site's language
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

export type MotionSettings = {
  enabled: boolean
  typewriter: boolean // admin editor: custom caret, insert/delete response + key sound
}

// Google Drive backup config (non-secret, lives in settings.data). The Drive
// refresh token + run state are kept server-only in the `backup_state` table.
export type BackupSettings = {
  enabled: boolean // when true, the cron runs a full snapshot every intervalDays
  intervalDays: number // days between automatic full snapshots (default 4)
  keep: number // how many most-recent snapshots to retain on Drive (default 4)
}

// Uniform API envelope returned by every route.
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}
