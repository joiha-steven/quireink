// The Help screen's reference sections. Each is an anchored card the index links to.
// Kept apart from the shell so neither file outgrows the 400-line cap.
import { Card } from './kit'
import { Anchor, C, Ext, In, Links, P, UL, doc } from './help-kit'

export function WritingSection() {
  return (
    <Anchor id="writing">
      <Card panel title="Writing &amp; publishing">
        <ul className={UL}>
          <li>Markdown plus a toolbar. Drafts <b>autosave in your browser</b> and only reach the site when you Save or Publish, so editing a live post never pushes half-finished text.</li>
          <li><b>Schedule</b> by publishing with a future date: the post stays hidden and goes live on time. It does <b>not</b> email anyone by itself.</li>
          <li>The last <b>3 versions</b> of every post are kept; restore one from the editor.</li>
          <li><b>Series</b> group related posts in order, with prev/next links and a <C>/series/…</C> page.</li>
          <li>Every delete is a <b>soft delete</b>. Nothing is ever removed automatically — Trash is emptied by hand.</li>
        </ul>
        <Links>
          <In href="/admin/editor">New post</In>
          <In href="/admin/content">All content</In>
          <In href="/admin/trash">Trash</In>
        </Links>
      </Card>
    </Anchor>
  )
}

export function MediaSection() {
  return (
    <Anchor id="media">
      <Card panel title="Media &amp; files">
        <ul className={UL}>
          <li>Drop an image into the editor or the Library. Responsive <b>AVIF and WebP</b> versions plus a thumbnail are generated for you; the original is always kept.</li>
          <li>The Library flags <b>unused</b> files (nothing links them) so a clear-out is safe. It only reports — it never deletes.</li>
          <li>Files live on your server&apos;s own disk, served from <C>/uploads</C>. No object-storage account.</li>
        </ul>
        <Links><In href="/admin/media">Open Library</In></Links>
      </Card>
    </Anchor>
  )
}

export function ReadersSection() {
  return (
    <Anchor id="readers">
      <Card panel title="Readers — comments &amp; newsletter">
        <p className={P}>Both are <b>off until you set them up</b>, and both are yours: no third-party service sits between you and your readers.</p>
        <ul className={`${UL} mt-2`}>
          <li><b>Comments</b> — enable in Settings → Content. Optional Turnstile anti-spam and Google sign-in. Replying emails the person you replied to.</li>
          <li><b>Newsletter</b> — add your SMTP details in Settings → Integrations and a sign-up form appears at the foot of every post plus a button in the site header. Sign-up is <b>double opt-in</b>: the address only counts once it clicks the confirmation link.</li>
          <li><b>Sending is always manual.</b> Nothing is emailed automatically, not even a scheduled post going live. You tick the posts, read the real email in the preview, and press send. Tick several and they go out as <b>one digest</b>, not one message each.</li>
          <li>Newsletter → People shows what each address actually received, any SMTP failure with its error, and the open rate. Newsletter → Test sends you a sample of each email before a reader ever sees one.</li>
        </ul>
        <Links>
          <In href="/admin/newsletter">Newsletter</In>
          <In href="/admin/comments">Comments</In>
          <In href="/admin/settings?tab=connections">SMTP settings</In>
        </Links>
      </Card>
    </Anchor>
  )
}

export function AnalyticsSection() {
  return (
    <Anchor id="analytics">
      <Card panel title="Analytics">
        <ul className={UL}>
          <li><b>No cookies, no personal data.</b> A visitor is a salted hash of IP + user agent, and the raw user agent is never stored — only coarse device / browser / OS buckets.</li>
          <li>Bots, admin pages and your own visits are skipped, so the numbers are readers.</li>
          <li>Views, scroll depth and dwell time; traffic sources; per-post drill-down. Kept forever — no rolling window.</li>
        </ul>
        <Links><In href="/admin/analytics">Open Analytics</In></Links>
      </Card>
    </Anchor>
  )
}

export function SettingsSection() {
  return (
    <Anchor id="settings">
      <Card panel title="Settings">
        <p className={P}>One form, one Save, applied site-wide with <b>no redeploy</b>. Five tabs:</p>
        <ul className={`${P} mt-2 space-y-1 list-disc pl-4`}>
          <li><b>Site</b> — title, logo, header menu, language, content width.</li>
          <li><b>Content</b> — reader features (search, contents, sidebar, related, book mode…) and comments.</li>
          <li><b>Appearance</b> — palettes, fonts, per-role text sizes, custom CSS.</li>
          <li><b>SEO</b> — sitemap, RSS, robots, OG images, URL redirects.</li>
          <li><b>Integrations</b> — SMTP, MCP, Google Drive backups, Cloudflare, WordPress import, comment keys.</li>
        </ul>
        <Links><In href="/admin/settings">Open Settings</In></Links>
      </Card>
    </Anchor>
  )
}

export function ServerSection() {
  return (
    <Anchor id="server">
      <Card panel title="Server, backups &amp; upgrades">
        <ul className={UL}>
          <li>Runs entirely on <b>your own server</b>: two SQLite files for content and analytics, the local filesystem for images. Native or Docker, no cloud account.</li>
          <li><C>/api/health</C> reports the database and the storage directory separately — point your uptime monitor at it. Boot fails fast on a missing required setting.</li>
          <li><b>Backups</b>: scheduled snapshots (both databases + every file) written to your own disk, plus a download-now archive. Settings → System → Backups.</li>
          <li>Upgrades apply <b>tracked SQL migrations</b>, so a schema change runs once and only once.</li>
        </ul>
        <Links>
          <Ext href={doc('docs/self-host.md')}>Self-host guide</Ext>
          <Ext href={doc('docs/backups.md')}>Backups</Ext>
        </Links>
      </Card>
    </Anchor>
  )
}

export function CacheSection() {
  return (
    <Anchor id="cache">
      <Card panel title="Cloudflare &amp; cache">
        <p className={P}>Put Cloudflare in front for TLS and a global edge cache — the big win when readers are far from your server.</p>
        <ul className={`${UL} mt-2`}>
          <li><b>Cache Rules</b>: bypass <C>/admin</C> and <C>/api</C>, cache everything else at the origin TTL. Turn <b>Rocket Loader off</b> (it breaks React). SSL: Full (Strict).</li>
          <li>Add a Cloudflare API token + Zone ID in Settings → Integrations and every save purges the zone automatically.</li>
          <li><b>Clear all cache</b> (sidebar) purges the origin and Cloudflare, then re-warms the home and newest pages.</li>
          <li>After deploying code, flush the edge with <C>GET /api/cron?purge=1</C>. Cloudflare caches HTML, so a stale page is not something a reader can refresh away.</li>
        </ul>
        <Links>
          <Ext href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</Ext>
          <Ext href={doc('docs/seo-pwa.md')}>SEO &amp; caching</Ext>
        </Links>
      </Card>
    </Anchor>
  )
}

export function McpSection() {
  return (
    <Anchor id="mcp">
      <Card panel title="MCP — let an AI run the blog">
        <p className={P}>
          The built-in <b>MCP server</b> gives an AI agent the <b>same rules as the admin</b>: create and update posts and pages, manage media and settings, everything revalidated and written to the activity log exactly like a human action. Turn it on and mint access tokens in Settings → Integrations — tokens are shown once and stored hashed.
        </p>
        <Links>
          <Ext href={doc('docs/mcp.md')}>MCP docs</Ext>
          <In href="/admin/settings?tab=connections">Integrations</In>
          <In href="/admin/log">Activity log</In>
        </Links>
      </Card>
    </Anchor>
  )
}
