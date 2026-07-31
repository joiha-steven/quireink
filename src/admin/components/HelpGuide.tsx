// In-admin help. Content is ENGLISH by design (canonical, like the repo docs) — the
// nav label + page title are localized, the body links out to docs/*.md for depth.
// Pure server component (static), so it ships no client JS.
//
// Shape: a numbered first-run path at the top (the one thing a new owner needs), a jump
// index, then reference sections, then two lookup tables. Sections live in
// `HelpSections`, tables in `HelpTables` — this file is the shell.
import { PageHeader, Card } from './kit'
import { Anchor, A, P, Ext, In, REPO } from './help-kit'
import { MarkdownTable, TroubleTable } from './HelpTables'
import {
  WritingSection, MediaSection, ReadersSection, AnalyticsSection,
  SettingsSection, ServerSection, CacheSection, McpSection,
} from './HelpSections'

// The order a new blog is actually set up in — each step is one link away.
const STEPS: { href: string; label: string; body: string }[] = [
  { href: '/admin/settings', label: 'Name the site', body: 'Title, logo, language and menu in Settings → Site. It is live the moment you save.' },
  { href: '/admin/editor', label: 'Write the first post', body: 'Markdown and a toolbar. Save keeps it a draft; Publish puts it on the site.' },
  { href: '/admin/settings?tab=appearance', label: 'Choose the look', body: 'Six palettes, a font, and text sizes per role. Readers can switch palette themselves.' },
  { href: '/admin/settings?tab=integrations', label: 'Turn on what you need', body: 'SMTP for the newsletter, Google Drive for backups, Cloudflare for the edge cache.' },
  { href: '/admin/newsletter', label: 'Gather readers', body: 'Once SMTP is set, a sign-up form appears on the site. Sending is always your call.' },
]

// Same order as the sections render in, so a chip's position predicts where it lands.
const INDEX: [string, string][] = [
  ['writing', 'Writing'],
  ['media', 'Media'],
  ['readers', 'Readers'],
  ['analytics', 'Analytics'],
  ['settings', 'Settings'],
  ['server', 'Server'],
  ['cache', 'Cache'],
  ['mcp', 'MCP'],
  ['markdown', 'Markdown'],
  ['trouble', 'Troubleshooting'],
]

export function HelpGuide({ title, version }: { title: string; version: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Everything this blog can do, and where each thing lives. Start at the top if it is a new site; jump to a section if you are looking something up."
      />

      <Card title="First five minutes">
        {/* Numbered so the order reads as a path, not a menu. Each step is the link. */}
        <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.href} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {i + 1}
              </span>
              <span className="min-w-0">
                <In href={s.href}>{s.label}</In>
                <span className={`mt-0.5 block ${P}`}>{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Jump index — the page is long by design; this keeps it a reference. */}
      <nav className="flex flex-wrap gap-2">
        {INDEX.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-sm text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-100"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* CSS columns, not a grid: the cards are wildly different heights and a grid
          aligns rows, leaving a dead gap under every short one. Columns pack them. */}
      <div className="columns-1 gap-4 lg:columns-2">
        <WritingSection />
        <MediaSection />
        <ReadersSection />
        <AnalyticsSection />
        <SettingsSection />
        <ServerSection />
        <CacheSection />
        <McpSection />
      </div>

      <Anchor id="markdown">
        <Card title="Markdown the editor understands">
          <p className={`${P} mb-3`}>Standard Markdown, plus these. The toolbar inserts most of them for you.</p>
          <MarkdownTable />
        </Card>
      </Anchor>

      <Anchor id="trouble">
        <Card title="When something looks wrong">
          <p className={`${P} mb-3`}>The problems that actually come up, and what fixes each.</p>
          <TroubleTable />
        </Card>
      </Anchor>

      <p className="pt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <a href={REPO} target="_blank" rel="noopener noreferrer" className={A}>Quire Ink</a> v{version} · PolyForm Noncommercial ·{' '}
        <Ext href={`${REPO}#readme`}>README</Ext>
      </p>
    </div>
  )
}
