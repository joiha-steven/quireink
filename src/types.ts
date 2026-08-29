import type {
  AiSettings, McpSettings, HomeSettings, GallerySettings, FigureSettings,
  CacheSettings, InkSettings, MotionSettings, BackupSettings,
  PostImageSettings, ShapeSettings, TableSettings, AuthorSettings,
} from '@/types-settings'
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
export type SiteLang = 'vi' | 'en' | 'de' | 'ja' | 'zh' | 'ko' | 'fr' | 'es' | 'pt' | 'it' | 'ru'

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
  transferStats: boolean // store, per visit, the bytes the reader's browser reported downloading (Analytics -> Delivery). ON by default, like the dwell time it sits beside and is no more identifying than. Off means the column stays NULL and the panel reads as unmeasured; nothing else changes, and the beacon is sent either way
  sidebar: boolean // categories + tags in the left gutter of the post list
  sidebarSeries: boolean // the series list in the sidebar, under the categories
  leadPost: boolean // first post of page 1 gets the h1 role instead of h2
  categoryLabel: boolean // category name in the meta line of cards and post headers
  deck: boolean // the excerpt shown as a standfirst under a post title
  bookText: boolean // running text set like a book: first-line indent, justified >=600px
  penUnderline: boolean // ++text++ drawn as a hand-drawn pen line; off = the browser's straight underline
  penRing: boolean // @@word@@ drawn as a ballpoint ring; off = the words stay plain
  bookMode: boolean // reader can open a post as a fullscreen 2-column "book" (desktop/iPad)
  readNext: boolean // one pointer at the end of an article: the next part of its series, else the adjacent post
  resume: boolean // coming back to a half-read post offers the reader's own last position (their browser only)
  infiniteScroll: boolean // reveal posts on scroll instead of pagination; adds a date timeline in the right gutter (desktop)
  gridView: boolean // reader can switch the listing to a card grid (header grid/list toggle); off = list only
  offline: boolean // register a service worker so a post the reader already opened still opens with no network (ADR 0039). OFF by default: a worker outlives the page that installed it, and installing one on every existing blog's readers because the software updated is not a decision to make for the owner. Off also UNINSTALLS it from anyone who has it
  archive: boolean // /archive: every published post in one page, grouped by year, plus the year list in the sidebar. Off = the route 404s and the block is not rendered
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
  figure: FigureSettings // site-wide default frame for every picture
  gallery: GallerySettings // site-wide default shape + caption state for in-body galleries
  postImage: PostImageSettings // where a post's own picture may appear: article hero, list thumbnail. Both 'none' at install
  shape: ShapeSettings // density, corner radius and headline weight — the knobs that change shape rather than colour. Defaults reproduce today exactly
  table: TableSettings // how every table in an article is drawn: header, rules, banding, first column, air. One set for the whole blog, because GFM has no syntax for any of it and the markdown has to stay portable
  author: AuthorSettings // the one person who writes here: byline, author box, and the `author` field in every BlogPosting. name:'' = silent
  seo: SeoSettings // SEO / crawler feature toggles
  features: FeatureSettings // reader-facing feature toggles
  comments: CommentSettings // reader comment system (off by default)
  mcp: McpSettings // MCP server toggle (tokens are managed separately)
  ai: AiSettings // which jobs the AI model does automatically (the key lives server-only)
  inks: InkSettings // the pen's own colours, and what a text selection looks like
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

// Every settings GROUP lives in its own file now; re-exported here so that `@/types` stays
// the one import every screen and route already writes.
export type * from '@/types-settings'

// Uniform API envelope returned by every route.
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}
