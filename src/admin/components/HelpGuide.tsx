// In-admin help. The REFERENCE content is English by design (canonical, like the repo docs)
// and the body links out to docs/*.md for depth. The nav label, the page title and — since
// 2026-08-14 — the five first-run steps are localized: those are onboarding, and onboarding
// somebody cannot read is worse than none. They live in `FirstRun.tsx` and render here and
// on the dashboard from one source.
// Pure server component (static), so it ships no client JS.
//
// Shape: a numbered first-run path at the top (the one thing a new owner needs), a jump
// index, then reference sections, then two lookup tables. Sections live in
// `HelpSections`, tables in `HelpTables` — this file is the shell.
import { PageHeader, Card } from './kit'
import { SHEET } from './sheet'
import { FirstRunSteps } from './FirstRun'
import { Anchor, A, P, Ext, REPO } from './help-kit'
import { MarkdownTable, TroubleTable } from './HelpTables'
import {
  WritingSection, MediaSection, ReadersSection, AnalyticsSection,
  SettingsSection, ServerSection, CacheSection, McpSection,
} from './HelpSections'

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

export function HelpGuide({ title, version, firstRunTitle }: {
  title: string; version: string; firstRunTitle: string
}) {
  return (
    // ONE SHEET, sections packed TWO columns wide ("nhật ký, hướng dẫn nên chia đôi
    // giống mấy cái kia" — the owner's verdict on the first centred-column cut). Each
    // section is a hairline PANEL inside the sheet, and CSS columns pack them: the
    // panels are wildly different heights, and a grid would leave a dead gap under
    // every short one.
    <div>
      <PageHeader title={title} />
      <div className={SHEET}>
        <div className="space-y-5 p-5">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Everything this blog can do, and where each thing lives. Start at the top if it is a new site; jump to a section if you are looking something up.
      </p>

      {/* THE ONE COPY of the five steps, shared with the dashboard's first-run card. They
          were written out twice for about an hour and that is exactly how two versions of
          "how to set this up" end up disagreeing. */}
      <Card panel title={firstRunTitle}>
        <FirstRunSteps />
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

      <div className="columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
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
        <Card panel title="Markdown the editor understands">
          <p className={`${P} mb-3`}>Standard Markdown, plus these. The toolbar inserts most of them for you.</p>
          <MarkdownTable />
        </Card>
      </Anchor>

      <Anchor id="trouble">
        <Card panel title="When something looks wrong">
          <p className={`${P} mb-3`}>The problems that actually come up, and what fixes each.</p>
          <TroubleTable />
        </Card>
      </Anchor>

      <p className="pt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
        <a href={REPO} target="_blank" rel="noopener noreferrer" className={A}>Quire Ink</a> v{version} ·{' '}
        <Ext href={`${REPO}/blob/main/LICENSE-EXCEPTION.md`}>PolyForm NC + hosting</Ext> ·{' '}
        <Ext href={`${REPO}#readme`}>README</Ext>
      </p>
        </div>
      </div>
    </div>
  )
}
