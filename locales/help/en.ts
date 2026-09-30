import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Everything this blog can do, and where each thing lives. Start at the top if it is a new site; jump to a section if you are looking something up.',
  index: {
    writing: 'Writing', media: 'Media', readers: 'Readers', analytics: 'Analytics', settings: 'Settings',
    server: 'Server', cache: 'Cache', mcp: 'MCP', api: 'Content API', fediverse: 'Fediverse',
    markdown: 'Markdown', keys: 'Keyboard', trouble: 'Troubleshooting',
  },
  sections: [
    {
      id: 'writing',
      title: 'Writing and publishing',
      body: `<ul>
<li>Markdown plus a toolbar. While you type, a copy is <b>kept on this device and on the server</b>; the piece itself only changes when you Save or Publish, so editing a live post never puts half-finished text on the site.</li>
<li><b>Schedule</b> by publishing with a future date: the post stays hidden and goes live on time. It does <b>not</b> email anyone by itself.</li>
<li>The last <b>3 versions</b> of every post are kept; restore one from the editor.</li>
<li><b>Series</b> group related posts in order, with previous and next links and a <code>/series/…</code> page.</li>
<li>Every delete goes to the <b>Trash</b>. Nothing is removed for good automatically — the Trash is emptied by hand.</li>
</ul>
<p class="links"><a href="/admin/editor">New post</a> <a href="/admin/content">All content</a> <a href="/admin/trash">Trash</a></p>`,
    },
    {
      id: 'media',
      title: 'Media and files',
      body: `<ul>
<li>Drop an image into the editor or the Library. Responsive <b>AVIF and WebP</b> versions and a thumbnail are made for you; the original is always kept.</li>
<li>Open a picture in the Library to read or change its <b>description</b> (alt text), the words a reader who cannot see it hears instead.</li>
<li>Any picture can wear a <b>frame</b> — a mat of paper or of ink, in three weights — picked on the picture itself in the editor. {t:navSettings} → {t:tabPost} → {t:cardPictures} sets the one every picture wears when it has not chosen; a picture that did choose keeps its own.</li>
<li>The Library flags <b>unused</b> files (nothing links to them), so a clear-out is safe. It only reports — it never deletes.</li>
<li>Files live on your server’s own disk, served from <code>/uploads</code>. No object-storage account.</li>
</ul>
<p class="links"><a href="/admin/media">Open the Library</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Readers — comments and newsletter',
      body: `<p>Both are <b>off until you set them up</b>, and both are yours: no third-party service sits between you and your readers.</p>
<ul class="after">
<li><b>Comments</b> — turn them on in {t:navSettings} → {t:tabPeople}. Cloudflare Turnstile against spam and sign-in with Google are optional. You can read and delete comments on the Comments screen.</li>
<li><b>Newsletter</b> — add your SMTP details in {t:navSettings} → {t:tabPeople}, and a sign-up form appears at the foot of every post, with a button in the site header. Sign-up is <b>double opt-in</b>: an address only counts once it has clicked the confirmation link.</li>
<li><b>Sending is always manual.</b> Nothing is emailed automatically, not even a scheduled post going live. You tick the posts, read the real email in the preview, and press send. Tick several and they go out as <b>one digest</b>, not one message each.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} shows what each address actually received, any SMTP failure with its error, and the open rate. {t:navNewsletter} → {t:nlTabTest} sends you a sample of each email before a reader ever sees one.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Comments</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Analytics',
      body: `<ul>
<li><b>No cookies, no personal data.</b> A visitor is a salted hash of the address and the browser, and the browser string itself is never stored — only coarse device, browser and system groups.</li>
<li>Bots, admin pages and your own visits are left out, so the numbers are readers.</li>
<li>Views, how far people scroll and how long they stay; where they came from; each post on its own. Kept for good — there is no rolling window.</li>
</ul>
<p class="links"><a href="/admin/analytics">Open Analytics</a></p>`,
    },
    {
      id: 'settings',
      title: 'Settings',
      body: `<p>One form and one Save, applied to the whole site with <b>no redeploy</b>. Seven tabs:</p>
{tabs}
<p>Looking for one setting? Type its name in the search at the top of the Settings screen.</p>
<p class="links"><a href="/admin/settings">Open Settings</a></p>`,
    },
    {
      id: 'server',
      title: 'Server, backups and upgrades',
      body: `<ul>
<li>Runs entirely on <b>your own server</b>: two SQLite files for the content and the analytics, and the local disk for pictures. Native or Docker, no cloud account.</li>
<li><code>/api/health</code> reports the database and the storage folder separately — point your uptime monitor at it. The server refuses to start when a required setting is missing, rather than starting half-configured.</li>
<li><b>Backups</b>: scheduled snapshots (both databases and every file) written to your own disk, a copy off the server if you add one, and an archive to download now. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Upgrades apply <b>tracked database migrations</b>, so a change to the schema runs once and only once.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Self-host guide</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare and the cache',
      body: `<p>Put Cloudflare in front for TLS and a cache near every reader — the big win when readers are far from your server.</p>
<ul class="after">
<li><b>Cache Rules</b>: bypass <code>/admin</code> and <code>/api</code>, cache everything else for the time the server says. Turn <b>Rocket Loader off</b> (it reorders and delays scripts, which breaks the admin). SSL: Full (Strict).</li>
<li>Add a Cloudflare API token and Zone ID in {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, and every save clears the zone by itself.</li>
<li><b>{t:clearCache}</b>, in the sidebar, clears this server and Cloudflare, then warms the home page and the newest pages again.</li>
<li>After deploying new code, clear the edge with <code>GET /api/cron?purge=1</code>. Cloudflare caches HTML, so a stale page is not something a reader can refresh away.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO and caching</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — let an AI run the blog',
      body: `<p>The built-in <b>MCP server</b> gives an AI agent the <b>same rules as the admin</b>: write and update posts and pages, look after pictures and settings, every change checked and written to the activity log exactly like yours. Turn it on and make access tokens in {t:navSettings} → {t:tabServer} → {t:cardMcp} — a token is shown once and stored only as a hash.</p>
<p>The same abilities live inside the admin as the <b>Assistant</b> screen, running on the model from {t:navSettings} → {t:tabServer} → {t:cardAi} — no MCP client needed. Through either door the agent <b>reads and looks after</b>: this week’s traffic against last week’s, comments swept into the Trash, the archive searched (drafts included), the front page rearranged around what people actually read, the look restyled from the ready-made palettes, a test issue of the newsletter sent to you alone. Ask it <i>how did my blog do this week?</i> and it answers with the dashboard’s own numbers — the <b>cookbook</b> below is a page of prompts that do real jobs.</p>
<p>Where the lines are: subscriber addresses and who wrote which comment never cross MCP; the look accepts the ready-made choices only, never a free colour; deletes go to the Trash, not away; and sending the real newsletter is <b>deliberately not a tool</b> — an email cannot be unsent, so that button stays yours.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Agent cookbook</a> <a href="doc:docs/mcp.md">MCP docs</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Activity log</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — let a program read the blog',
      body: `<p>The <b>Content API</b> serves your published writing as JSON at <code>/api/v1</code> — posts, pages, notes and your categories, each with the Markdown it was written in. It is for building something out of the blog rather than reading it: a second front end, a search index, a static copy, a script that checks its own links. Turn it on in {t:navSettings} → {t:tabServer}; until you do, every one of those addresses answers <b>404</b>.</p>
<p><b>It only reads, and it has no key.</b> Anyone who knows the address can read it, and what they get is exactly what they could already get by browsing the site: no drafts, no posts dated ahead, nothing in the Trash, and nothing that can change the blog. The switch is there because of what it makes <i>cheap</i>, not what it makes possible — the whole blog in as many requests as it has pages. On a quiet personal blog that is a convenience; decide for yours.</p>
<p>To write from a program, use <b>MCP</b> above, or Micropub from a notebook app. Both sign in; this does not, which is why it may only read.</p>
<p class="links"><a href="doc:docs/content-api.md">Content API docs</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverse — let people follow the blog',
      body: `<p>Switch this on and your blog becomes an <b>account</b> that anyone on Mastodon — or any of its neighbours — can follow. A new post arrives in their timeline as its title, its standfirst and a link back here; the writing itself stays on your blog, where you can still edit it. Editing a post sends a correction; moving it to the Trash withdraws it.</p>
<p><b>Choose your handle once.</b> It is the <i>@name</i> half of <i>@name@yourdomain</i>, and it is not your sign-in name — that one stays private. Your handle and your site address <b>together are your identity</b> out there: change either one later and every follower is lost, because their server goes on looking for the old name and nothing tells it where you went.</p>
<p>Two things it deliberately does <b>not</b> do yet. It publishes but does not read: replies, likes and boosts reach your blog and are dropped, so a reply on Mastodon does not become a comment here. And nothing you wrote <i>before</i> switching it on is ever sent — turning it on does not push your archive into anybody’s timeline.</p>
<p class="links"><a href="doc:docs/fediverse.md">Fediverse docs</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Activity log</a></p>`,
    },
  ],
  markdownTitle: 'Markdown the editor understands',
  markdownLede: 'Standard Markdown, plus these. The toolbar inserts most of them for you.',
  markdownHead: ['Type this', 'And you get'],
  markdown: {
    '# … ######': 'Headings. The table of contents is built from these.',
    '> [!NOTE]': 'A callout box. Also TIP, WARNING, IMPORTANT and CAUTION.',
    '==text==': 'Highlighter. ==text==#green picks the ink: yellow, green, pink, blue or orange.',
    '++text++': 'Pencil underline. ++text++#green draws the line in one of the five inks instead.',
    '@@word@@': 'A ballpoint ring around a word. @@word@@#blue picks the ink; red without one.',
    'text[^1]': 'A footnote reference; write the note as [^1]: anywhere in the body.',
    '![alt](url)': 'A picture. Dropping a file into the editor writes this for you.',
    '![alt](url#frame)': 'A mat around that picture. #frame-thin and #frame-thick change the weight, ink makes the mat dark, and #noframe keeps one picture plain on a framed site.',
    '```lang': 'Fenced code, coloured on the server (no script in the reader’s browser).',
    '---': 'The one divider style used across the site.',
    'YouTube / Vimeo': 'A YouTube or Vimeo address on its own line becomes an embedded player that fits the page.',
    'Spotify / Apple Music': 'A Spotify or Apple Music address on its own line becomes an embedded player (no third-party script).',
  },
  keysTitle: 'Keys the editor answers to',
  keysLede: 'On top of the usual bold, italic, headings and undo.',
  keysHead: ['Press', 'And it does'],
  keys: {
    save: 'Save. A draft stays a draft and a published piece stays published: only Publish, or the status in the panel, changes that. Autosave keeps a copy on this device and on the server, but only Save writes the piece itself.',
    link: 'Add a link, or edit the one the cursor is inside. Clearing the box removes it.',
    ink: 'Highlighter over the selection (==text==).',
    ring: 'A ballpoint ring around the selection (@@word@@).',
    clear: 'Strip every mark off the selection — the repair for text pasted from somewhere else.',
    attributes: 'The Attributes panel: address, date, categories and tags, both pictures, the SEO fields and the Trash.',
    markdown: 'Switch between the writing surface and the Markdown source.',
    focus: 'Focus mode: everything but the paper goes away.',
    find: 'Find, in either view. Enter goes to the next match, Shift-Enter to the one before, Escape closes it.',
    replace: 'Find and replace: the same strip with the replace field open. The arrow at its start opens it too.',
    palette: 'Search everything: the screens, the settings and your writing. Also the button at the top of the sidebar.',
    bold: 'Bold.',
    italic: 'Italic.',
    underline: 'Pencil underline (++text++).',
    strike: 'Strikethrough.',
    code: 'Code in a line of text.',
    codeBlock: 'A block of code.',
    heading: 'Heading levels 1 to 6 — Mod-Alt-2 for a level 2 heading, and so on. Mod-Alt-0 goes back to a paragraph.',
    bulletList: 'Bulleted list.',
    orderedList: 'Numbered list.',
    taskList: 'Checklist.',
    blockquote: 'Quotation. Start it with [!NOTE] for a callout.',
    undo: 'Undo. Shift-Mod-Z redoes.',
    hardBreak: 'A line break inside the same paragraph.',
  },
  troubleTitle: 'When something looks wrong',
  troubleLede: 'The problems that actually come up, and what fixes each.',
  troubleHead: ['Symptom', 'What to do'],
  trouble: [
    ['An edit is live on the server but readers still see the old page', 'Cloudflare caches HTML. Use {t:clearCache} in the sidebar — refreshing the browser cannot fix a cache at the edge.'],
    ['Test SMTP fails with “wrong version number”', 'The port and TLS disagree. 465 is implicit TLS (tick the box); 587 and 25 are STARTTLS (leave it unticked).'],
    ['A subscriber signed up but got no email', 'The address is saved before the mail is sent, so the sign-up survives a broken SMTP. Look in {t:navNewsletter} → {t:nlTabPeople} for the failure, then use {t:navNewsletter} → {t:nlTabTest}.'],
    ['A scheduled post did not go live on time', 'The blog publishes it by itself within a minute of its time, as long as the server is running. If the server was down at that moment, the post goes live as soon as it is back.'],
    ['The authenticator app is gone and sign-in asks for its code', 'On the code screen, choose “{t:authUseRecovery}” and type one of your recovery codes; each one works once. Then make new ones in {t:navSettings} → {t:tabAccount}.'],
    ['An old address gives 404 after a rename', 'Renaming adds a 301 by itself. If the address never existed here, add one in {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['Pictures vanished after a restore', 'Open /api/health — it reports the database and the storage folder separately.'],
  ],
}

export default help
