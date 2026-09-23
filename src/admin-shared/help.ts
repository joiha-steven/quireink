// THE HELP SCREEN'S CONTENT, as data.
//
// It was eight React components of prose, and the prose never needed React: the screen's own
// header said so — "Pure server component (static), so it ships no client JS" — while it shipped
// inside a 15 KB chunk of one. ADR 0054 makes that comment true, and this is where the words
// live so the server can write them.
//
// ENGLISH BY DESIGN, and that is the one thing here that is not an oversight: this mirrors the
// repo docs, which are canonical. Only the nav label and the page title come from `adminT`.
//
// The markup is the markup that shipped, moved rather than retyped — the three custom tags the
// React version had (`<C>`, `<In>`, `<Ext>`) are the only things rewritten, into the HTML they
// always stood for.
import { A, CODE, LINKS, P, UL } from '@/admin-shared/kit'

export const REPO = 'https://github.com/joiha-steven/quireink'
export const doc = (p: string): string => `${REPO}/blob/main/${p}`

/** The jump index, in the order the sections render — so a chip's position predicts where it lands. */
export const HELP_INDEX: [string, string][] = [
['writing', 'Writing'],
  ['media', 'Media'],
  ['readers', 'Readers'],
  ['analytics', 'Analytics'],
  ['settings', 'Settings'],
  ['server', 'Server'],
  ['cache', 'Cache'],
  ['mcp', 'MCP'],
  ['api', 'Content API'],
  ['fediverse', 'Fediverse'],
  ['markdown', 'Markdown'],
  ['keys', 'Keyboard'],
  ['trouble', 'Troubleshooting'],
]

export type HelpSection = { id: string; title: string; body: string }

/** Each section is an anchored card the index links to. */
export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'writing',
    title: 'Writing &amp; publishing',
    body: `<ul class="${UL}">
    <li>Markdown plus a toolbar. Drafts <b>autosave in your browser</b> and only reach the site when you Save or Publish, so editing a live post never pushes half-finished text.</li>
    <li><b>Schedule</b> by publishing with a future date: the post stays hidden and goes live on time. It does <b>not</b> email anyone by itself.</li>
    <li>The last <b>3 versions</b> of every post are kept; restore one from the editor.</li>
    <li><b>Series</b> group related posts in order, with prev/next links and a <code class="${CODE}">/series/…</code> page.</li>
    <li>Every delete is a <b>soft delete</b>. Nothing is ever removed automatically — Trash is emptied by hand.</li>
    </ul>
    <p class="${LINKS}"><a href="/admin/editor" class="${A}">New post</a>
    <a href="/admin/content" class="${A}">All content</a>
    <a href="/admin/trash" class="${A}">Trash</a></p>`,
  },
  {
    id: 'media',
    title: 'Media &amp; files',
    body: `<ul class="${UL}">
    <li>Drop an image into the editor or the Library. Responsive <b>AVIF and WebP</b> versions plus a thumbnail are generated for you; the original is always kept.</li>
    <li>Any picture can wear a <b>frame</b> — a mat of paper or of ink, in three weights — picked on the picture itself in the editor. <a href="/admin/settings?tab=post" class="${A}">Settings &rarr; Posts &rarr; Pictures</a> sets the one every picture wears when it has not chosen; a picture that did choose keeps its own, and <code class="${CODE}">No frame</code> says so out loud on a framed site.</li>
    <li>The Library flags <b>unused</b> files (nothing links them) so a clear-out is safe. It only reports — it never deletes.</li>
    <li>Files live on your server's own disk, served from <code class="${CODE}">/uploads</code>. No object-storage account.</li>
    </ul>
    <p class="${LINKS}"><a href="/admin/media" class="${A}">Open Library</a></p>`,
  },
  {
    id: 'readers',
    title: 'Readers — comments &amp; newsletter',
    body: `<p class="${P}">Both are <b>off until you set them up</b>, and both are yours: no third-party service sits between you and your readers.</p>
    <ul class="${UL} mt-2">
    <li><b>Comments</b> — enable in Settings → Content. Optional Turnstile anti-spam and Google sign-in. Replying emails the person you replied to.</li>
    <li><b>Newsletter</b> — add your SMTP details in Settings → Integrations and a sign-up form appears at the foot of every post plus a button in the site header. Sign-up is <b>double opt-in</b>: the address only counts once it clicks the confirmation link.</li>
    <li><b>Sending is always manual.</b> Nothing is emailed automatically, not even a scheduled post going live. You tick the posts, read the real email in the preview, and press send. Tick several and they go out as <b>one digest</b>, not one message each.</li>
    <li>Newsletter → People shows what each address actually received, any SMTP failure with its error, and the open rate. Newsletter → Test sends you a sample of each email before a reader ever sees one.</li>
    </ul>
    <p class="${LINKS}"><a href="/admin/newsletter" class="${A}">Newsletter</a>
    <a href="/admin/comments" class="${A}">Comments</a>
    <a href="/admin/settings?tab=people" class="${A}">SMTP settings</a></p>`,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    body: `<ul class="${UL}">
    <li><b>No cookies, no personal data.</b> A visitor is a salted hash of IP + user agent, and the raw user agent is never stored — only coarse device / browser / OS buckets.</li>
    <li>Bots, admin pages and your own visits are skipped, so the numbers are readers.</li>
    <li>Views, scroll depth and dwell time; traffic sources; per-post drill-down. Kept forever — no rolling window.</li>
    </ul>
    <p class="${LINKS}"><a href="/admin/analytics" class="${A}">Open Analytics</a></p>`,
  },
  {
    id: 'settings',
    title: 'Settings',
    body: `<p class="${P}">One form, one Save, applied site-wide with <b>no redeploy</b>. Five tabs:</p>
    <ul class="${P} mt-2 space-y-1 list-disc pl-4">
    <li><b>Site</b> — title, logo, header menu, language, content width.</li>
    <li><b>Content</b> — reader features (search, contents, sidebar, related, book mode…) and comments.</li>
    <li><b>Appearance</b> — palettes, fonts, per-role text sizes, custom CSS.</li>
    <li><b>SEO</b> — sitemap, RSS, robots, OG images, URL redirects.</li>
    <li><b>Integrations</b> — email for the newsletter, MCP, off-site backups, Cloudflare, WordPress import, comment keys.</li>
    </ul>
    <p class="${LINKS}"><a href="/admin/settings" class="${A}">Open Settings</a></p>`,
  },
  {
    id: 'server',
    title: 'Server, backups &amp; upgrades',
    body: `<ul class="${UL}">
    <li>Runs entirely on <b>your own server</b>: two SQLite files for content and analytics, the local filesystem for images. Native or Docker, no cloud account.</li>
    <li><code class="${CODE}">/api/health</code> reports the database and the storage directory separately — point your uptime monitor at it. Boot fails fast on a missing required setting.</li>
    <li><b>Backups</b>: scheduled snapshots (both databases + every file) written to your own disk, plus a download-now archive. Settings → System → Backups.</li>
    <li>Upgrades apply <b>tracked SQL migrations</b>, so a schema change runs once and only once.</li>
    </ul>
    <p class="${LINKS}"><a href="${doc('docs/self-host.md')}" target="_blank" rel="noopener noreferrer" class="${A}">Self-host guide</a>
    <a href="${doc('docs/backups.md')}" target="_blank" rel="noopener noreferrer" class="${A}">Backups</a></p>`,
  },
  {
    id: 'cache',
    title: 'Cloudflare &amp; cache',
    body: `<p class="${P}">Put Cloudflare in front for TLS and a global edge cache — the big win when readers are far from your server.</p>
    <ul class="${UL} mt-2">
    <li><b>Cache Rules</b>: bypass <code class="${CODE}">/admin</code> and <code class="${CODE}">/api</code>, cache everything else at the origin TTL. Turn <b>Rocket Loader off</b> (it reorders and defers scripts, which breaks the admin). SSL: Full (Strict).</li>
    <li>Add a Cloudflare API token + Zone ID in Settings → Integrations and every save purges the zone automatically.</li>
    <li><b>Clear all cache</b> (sidebar) purges the origin and Cloudflare, then re-warms the home and newest pages.</li>
    <li>After deploying code, flush the edge with <code class="${CODE}">GET /api/cron?purge=1</code>. Cloudflare caches HTML, so a stale page is not something a reader can refresh away.</li>
    </ul>
    <p class="${LINKS}"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/" target="_blank" rel="noopener noreferrer" class="${A}">Cache Rules</a>
    <a href="${doc('docs/seo-pwa.md')}" target="_blank" rel="noopener noreferrer" class="${A}">SEO &amp; caching</a></p>`,
  },
  {
    id: 'mcp',
    title: 'MCP — let an AI run the blog',
    body: `<p class="${P}">
    The built-in <b>MCP server</b> gives an AI agent the <b>same rules as the admin</b>: create and update posts and pages, manage media and settings, everything revalidated and written to the activity log exactly like a human action. Turn it on and mint access tokens in Settings → Integrations — tokens are shown once and stored hashed.
    </p>
    <p class="${P}">
    The same abilities live inside the admin as the <b>Assistant</b> page, running on the model from Settings → AI — no MCP client needed. Either door, the agent <b>reads and stewards</b>: your traffic compared to last week, comments swept into the Trash, the archive searched (drafts included), the front page recomposed around what people actually read, the look restyled from the curated palettes, a test issue of the newsletter sent to you alone. Ask your assistant <i>"how did my blog do this week?"</i> and it answers with the dashboard's own numbers — the <b>cookbook</b> below is a page of prompts that do real jobs.
    </p>
    <p class="${P}">
    Where the lines are: subscriber addresses and commenters' identities never cross MCP; appearance accepts the preset menus only, never free-form color; deletes go to the Trash, not away; and the real newsletter broadcast is <b>deliberately not a tool</b> — an email cannot be unsent, so that button stays yours.
    </p>
    <p class="${LINKS}"><a href="${doc('docs/agent-cookbook.md')}" target="_blank" rel="noopener noreferrer" class="${A}">Agent cookbook</a>
    <a href="${doc('docs/mcp.md')}" target="_blank" rel="noopener noreferrer" class="${A}">MCP docs</a>
    <a href="/admin/settings?tab=server" class="${A}">Server &amp; connections</a>
    <a href="/admin/log" class="${A}">Activity log</a></p>`,
  },
  {
    id: 'api',
    title: 'Content API — let a program read the blog',
    body: `<p class="${P}">
    The <b>Content API</b> serves your published writing as JSON at <code class="${CODE}">/api/v1</code> — posts, pages, notes and your categories, each with the Markdown it was written in. It is for building something out of the blog rather than reading it: a second front end, a search index, a static export, a script that checks its own links. Turn it on in Settings → Server &amp; connections; until you do, every one of those paths answers <b>404</b>.
    </p>
    <p class="${P}">
    <b>It is read-only and it has no key.</b> Anyone who knows the address can read it, and what they get is exactly what they could already get by browsing the site: no drafts, no posts dated ahead, nothing in the trash, and nothing that can change the blog. The switch is there because of what it makes <i>cheap</i>, not what it makes possible — the whole blog in as many requests as it has pages, instead of as many as it has readers. On a quiet personal blog that is a convenience; decide for yours.
    </p>
    <p class="${P}">
    To write from a program instead, use <b>MCP</b> above, or Micropub from a notebook client. Both authenticate; this does not, which is why it may only read.
    </p>
    <p class="${LINKS}"><a href="${doc('docs/content-api.md')}" target="_blank" rel="noopener noreferrer" class="${A}">Content API docs</a>
    <a href="/admin/settings?tab=server" class="${A}">Server &amp; connections</a></p>`,
  },
  {
    id: 'fediverse',
    title: 'Fediverse — let people follow the blog',
    body: `<p class="${P}">
    Switch this on and your blog becomes an <b>account</b> that anyone on Mastodon — or any of its neighbours — can follow. A new post arrives in their timeline as its title, its standfirst and a link back here; the writing itself stays on your blog, where you can still edit it. Editing one sends a correction; moving one to the Trash withdraws it.
    </p>
    <p class="${P}">
    <b>Choose your handle once.</b> It is the <i>@name</i> half of <i>@name@yourdomain</i>, and it is not your sign-in name — that one stays private. Your handle and your site address <b>together are your identity</b> out there: change either one later and every follower is lost, because their server goes on looking for the old name and nothing tells it where you went.
    </p>
    <p class="${P}">
    Two things it deliberately does <b>not</b> do yet. It publishes but does not read: replies, likes and boosts reach your blog and are dropped, so a reply in Mastodon does not become a comment here. And nothing you wrote <i>before</i> you switched this on is ever sent — turning it on does not push your archive into anybody\u2019s timeline.
    </p>
    <p class="${LINKS}"><a href="${doc('docs/fediverse.md')}" target="_blank" rel="noopener noreferrer" class="${A}">Fediverse docs</a>
    <a href="/admin/settings?tab=server" class="${A}">Server &amp; connections</a>
    <a href="/admin/log" class="${A}">Activity log</a></p>`,
  },
]

/**
 * A table beats prose for both of these: you arrive knowing what you want — a syntax, or a
 * symptom — and want the answer in one glance, not a paragraph to read.
 */
export type HelpRow = [syntax: string, does: string]

// Everything the editor understands beyond plain CommonMark. Plain bold/italic/links are not
// listed: nobody needs to look those up.
export const MARKDOWN_ROWS: HelpRow[] = [
['# … ######', 'Headings. The table of contents is built from these.'],
  ['> [!NOTE]', 'Callout box. Also TIP, WARNING, IMPORTANT, CAUTION.'],
  ['==text==', 'Highlighter pen. ==text==#green picks the ink: yellow, green, pink, blue, orange.'],
  ['++text++', 'Pencil underline. ++text++#green draws the line in one of the five inks instead.'],
  ['@@word@@', 'Ballpoint ring around a word. @@word@@#blue picks the ink; red without one.'],
  ['text[^1]', 'Footnote reference; define it as [^1]: the note anywhere in the body.'],
  ['![alt](url)', 'Image. Dropping a file into the editor writes this for you.'],
  ['![alt](url#frame)', 'A mat around that picture. #frame-thin and #frame-thick change the weight, ink makes the mat dark, #noframe keeps one picture plain on a framed site.'],
  ['```lang', 'Fenced code, syntax-highlighted on the server (no client JS).'],
  ['---', 'The one divider style used site-wide.'],
  ['A YouTube / Vimeo URL on its own line', 'Becomes a responsive embedded player.'],
  ['A Spotify / Apple Music URL on its own line', 'Becomes an embedded player (no third-party script).'],
]

// Symptoms that have cost real time, and what actually fixes each.
export const TROUBLE_ROWS: HelpRow[] = [
[
    'An edit is live on the origin but readers still see the old page',
    'Cloudflare caches HTML. Use Clear all cache in the sidebar — a browser refresh cannot fix an edge cache.',
  ],
  [
    'Test SMTP fails with "wrong version number"',
    'Port and TLS disagree. 465 is implicit TLS (tick the box); 587 and 25 are STARTTLS (leave it unticked).',
  ],
  [
    'A subscriber signed up but got no email',
    'The row is saved before the mail is sent, so the sign-up survives a bad SMTP. Check Newsletter → People for the failure, then Newsletter → Test.',
  ],
  ['A scheduled post did not go live on time', 'Its cron must be hitting /api/cron?publish=1 with the CRON_SECRET bearer.'],
  ['Sign-in silently returns to the homepage', 'That Google account is not AUTHORIZED_EMAIL. Only that one address reaches the admin.'],
  ['An old URL 404s after a rename', 'Renaming adds a 301 automatically. If the URL never existed here, add one in Settings → SEO → Redirects.'],
  ['Images vanished after a restore', 'Check /api/health — it reports the database and the storage directory separately.'],
]
