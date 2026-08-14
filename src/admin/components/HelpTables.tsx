// The two lookup tables on the Help screen. A table beats prose for both of these:
// you arrive knowing what you want (a syntax, or a symptom) and want the answer in one
// glance, not a paragraph to read.
import { TableFrame, THEAD, TROW } from './kit'
import { C, P } from './help-kit'

type Row = [syntax: string, does: string]

// Everything the editor understands beyond plain CommonMark. Plain bold/italic/links
// are not listed — nobody needs to look those up.
const MARKDOWN: Row[] = [
  ['# … ######', 'Headings. The table of contents is built from these.'],
  ['> [!NOTE]', 'Callout box. Also TIP, WARNING, IMPORTANT, CAUTION.'],
  ['==text==', 'Highlighter pen. ==text==#green picks the ink: yellow, green, pink, blue, orange.'],
  ['text[^1]', 'Footnote reference; define it as [^1]: the note anywhere in the body.'],
  ['![alt](url)', 'Image. Dropping a file into the editor writes this for you.'],
  ['```lang', 'Fenced code, syntax-highlighted on the server (no client JS).'],
  ['---', 'The one divider style used site-wide.'],
  ['A YouTube / Vimeo URL on its own line', 'Becomes a responsive embedded player.'],
  ['A Spotify / Apple Music URL on its own line', 'Becomes an embedded player (no third-party script).'],
]

// Symptoms that have cost real time, and what actually fixes each.
const TROUBLE: Row[] = [
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

function Lookup({ rows, head }: { rows: Row[]; head: [string, string] }) {
  return (
    <TableFrame>
      <thead className={THEAD}>
        <tr>
          <th className="w-1/3 px-4 py-2.5 font-medium">{head[0]}</th>
          <th className="px-4 py-2.5 font-medium">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a} className={TROW}>
            <td className="px-4 py-2.5 align-top">
              <C>{a}</C>
            </td>
            <td className={`px-4 py-2.5 align-top ${P}`}>{b}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  )
}

export function MarkdownTable() {
  return <Lookup rows={MARKDOWN} head={['Type this', 'And you get']} />
}

export function TroubleTable() {
  return (
    <TableFrame>
      <thead className={THEAD}>
        <tr>
          <th className="w-2/5 px-4 py-2.5 font-medium">Symptom</th>
          <th className="px-4 py-2.5 font-medium">What to do</th>
        </tr>
      </thead>
      <tbody>
        {TROUBLE.map(([a, b]) => (
          <tr key={a} className={TROW}>
            <td className="px-4 py-2.5 align-top font-medium text-neutral-800 dark:text-neutral-200">{a}</td>
            <td className={`px-4 py-2.5 align-top ${P}`}>{b}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  )
}
