// THE THREE LISTS THE SERVER COULD NOT DRAW, held to the shape the server actually sends.
//
// These rows arrive after the page does, which puts a payload across a seam nothing watched.
// On 2026-09-15 both readers on this side of it were wrong about what the other side sends:
// a session's `lastSeenAt` is epoch milliseconds and was read with `.slice()`, and a snapshot's
// date is `createdAt` and was read as `s.at`. Each one throws inside a `.map()`, which takes
// the WHOLE list with it — and an island that throws leaves the server's empty state on the
// glass, so the screen says "no signed-in devices" and "no backups" and looks like the truth.
// Neither a type-check nor a tour flow that asserts the empty state can tell the difference.
//
// So: real server markup, a payload typed by `admin-shared/wire.ts`, and the rows read back.
// `wire.ts` is what makes the payloads below honest — the routes are annotated with the same
// types, so a column that changes shape fails the build rather than this file's imagination.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { BackupListWire, McpTokenWire, SecurityWire } from '@/admin-shared/wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { backupsCard } from '@/web/admin/screens/settings-server-ops'
import { mcpCard } from '@/web/admin/screens/settings-server-mcp'
import { wireLists } from './lib/settings-lists'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const s = DEFAULT_SETTINGS

/** Epoch milliseconds, the way `sessions` stores them. 2026-09-14 03:10 local. */
const WHEN = new Date(2026, 8, 14, 3, 10).getTime()
const ISO = new Date(WHEN).toISOString()

const token = (over: Partial<McpTokenWire> = {}): McpTokenWire => ({
  id: 1, name: 'laptop', prefix: 'vbmcp_AbCd', scope: 'full',
  createdAt: ISO, expiresAt: ISO, expired: false, lastUsedAt: ISO, ...over,
})

/** What `read()` in the island expects: the `{ success, data }` envelope, never the bare body. */
const reply = (data: unknown): Response =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })

let root: HTMLElement
const routes = new Map<string, unknown>()

beforeEach(() => {
  routes.clear()
  document.body.innerHTML = ''
  root = document.createElement('div')
  document.body.appendChild(root)
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const hit = [...routes].find(([path]) => url.includes(path))
    return Promise.resolve(hit ? reply(hit[1]) : new Response('', { status: 404 }))
  }) as typeof fetch
})

/** The island fills from `fetch`, so a paint is a microtask or two away. */
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve() }

const text = (hook: string): string =>
  root.querySelector<HTMLElement>(`[${hook}]`)?.textContent?.trim() ?? ''

const shown = (hook: string): boolean => {
  const el = root.querySelector<HTMLElement>(`[${hook}]`)
  return el != null && !el.hidden
}

describe('the snapshot list', () => {
  beforeEach(() => { root.innerHTML = backupsCard(t, s) })

  it('draws a row for every archive on disk', async () => {
    routes.set('/api/backup/list', {
      snapshots: [{ name: 'quire-2026-09-14.tar.gz', size: 3_500_000, createdAt: ISO }],
      lastRunAt: ISO,
    } satisfies BackupListWire)
    wireLists(root, {})
    await settle()
    expect(root.querySelectorAll('[data-backup]').length).toBe(1)
    // The date is READ, not echoed: a field that is not there prints "undefined" or throws,
    // and both were live bugs. Anything the browser could not parse says "Invalid Date".
    expect(text('data-backup-when')).not.toBe('')
    expect(text('data-backup-when')).not.toContain('Invalid')
    expect(text('data-backup-when')).not.toContain('undefined')
  })

  it('reports a size a small blog can believe', async () => {
    routes.set('/api/backup/list', {
      snapshots: [{ name: 'a.tar.gz', size: 350_000, createdAt: ISO }], lastRunAt: ISO,
    } satisfies BackupListWire)
    wireLists(root, {})
    await settle()
    // 0.3 MB, not "0 MB". Rounded to whole megabytes every early snapshot reads as nothing.
    expect(text('data-backup-size')).toBe('0.3 MB')
  })

  it('keeps the label on the last-run line, not just the date', async () => {
    routes.set('/api/backup/list', {
      snapshots: [{ name: 'a.tar.gz', size: 1, createdAt: ISO }], lastRunAt: ISO,
    } satisfies BackupListWire)
    wireLists(root, {})
    await settle()
    expect(text('data-backup-last')).toContain(t.backupLastRun)
    expect(text('data-backup-last')).not.toBe(t.backupLastRun)
  })

  it('shows the amber lamp and the never-word when there is no copy anywhere', async () => {
    routes.set('/api/backup/list', { snapshots: [], lastRunAt: null } satisfies BackupListWire)
    wireLists(root, {})
    await settle()
    expect(shown('data-backup-lamp-none')).toBe(true)
    expect(shown('data-backup-lamp-some')).toBe(false)
    expect(text('data-backup-last')).toContain(t.backupNever)
    expect(shown('data-backup-none')).toBe(true)
  })

  it('turns the lamp over once one exists', async () => {
    routes.set('/api/backup/list', {
      snapshots: [{ name: 'a.tar.gz', size: 1, createdAt: ISO }], lastRunAt: ISO,
    } satisfies BackupListWire)
    wireLists(root, {})
    await settle()
    expect(shown('data-backup-lamp-some')).toBe(true)
    expect(shown('data-backup-lamp-none')).toBe(false)
  })
})

describe('the MCP token table', () => {
  beforeEach(() => { root.innerHTML = mcpCard(t, s, 'https://example.test/mcp') })

  it('fills every column, in the admin\'s own date format', async () => {
    routes.set('/api/mcp/tokens', [token()] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    expect(root.querySelectorAll('[data-mcp-token-row]').length).toBe(1)
    expect(text('data-mcp-name')).toBe('laptop')
    expect(text('data-mcp-made')).toBe(formatDateTimeShort(ISO))
    expect(text('data-mcp-used')).toBe(formatDateTimeShort(ISO))
    expect(text('data-mcp-expires')).toBe(formatDateTimeShort(ISO))
  })

  it('puts the row IN the table, not in a table of its own', async () => {
    // The one failure on this screen that every assertion about text goes green on. A `<tr>`
    // cannot be a template's first child and survive every parser, so it ships wrapped in a
    // `<table><tbody>` skeleton — and an island that clones the first child clones the SKELETON,
    // nesting a whole table inside the real `<tbody>`. The fields fill, the words read back, and
    // the row's columns no longer line up with the header above them.
    routes.set('/api/mcp/tokens', [token()] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    const tbody = root.querySelector('[data-mcp-rows]')
    expect(tbody?.firstElementChild?.tagName).toBe('TR')
    expect(root.querySelector('[data-mcp-token-row]')?.parentElement).toBe(tbody as HTMLElement)
  })

  it('says never-used with the server\'s word, not one this island holds', async () => {
    routes.set('/api/mcp/tokens', [token({ lastUsedAt: null })] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    expect(shown('data-mcp-never')).toBe(true)
    expect(shown('data-mcp-used')).toBe(false)
    expect(text('data-mcp-never')).toBe(t.mcpNeverUsed)
  })

  it('trusts the server\'s clock about expiry, and hides the date once it has passed', async () => {
    routes.set('/api/mcp/tokens', [token({ expired: true })] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    expect(shown('data-mcp-expired')).toBe(true)
    expect(shown('data-mcp-expires')).toBe(false)
  })

  it('badges only the grants narrower than full', async () => {
    routes.set('/api/mcp/tokens', [token({ scope: 'read' })] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    expect(shown('data-mcp-scope')).toBe(true)
    expect(shown('data-mcp-badge-read')).toBe(true)
    expect(shown('data-mcp-badge-code')).toBe(false)
  })

  it('leaves a full token unbadged', async () => {
    routes.set('/api/mcp/tokens', [token({ scope: 'full' })] satisfies McpTokenWire[])
    wireLists(root, {})
    await settle()
    expect(shown('data-mcp-scope')).toBe(false)
  })
})

describe('a question that broke', () => {
  // The rule three React components got wrong: an empty answer and a refused request are not
  // the same fact, and printing the first for the second tells the owner their rows are gone
  // while all of them are still on the server.
  it('says so on the backups card instead of claiming there is nothing there', async () => {
    root.innerHTML = backupsCard(t, s)
    // No route registered: the stub answers 404, which is `read()` returning null.
    wireLists(root, {})
    await settle()
    expect(shown('data-backup-failed')).toBe(true)
    expect(shown('data-backup-none')).toBe(false)
    expect(shown('data-backup-list')).toBe(false)
  })

  it('says so on the token table too', async () => {
    root.innerHTML = mcpCard(t, s, 'https://example.test/mcp')
    wireLists(root, {})
    await settle()
    expect(shown('data-mcp-failed')).toBe(true)
    expect(shown('data-mcp-none')).toBe(false)
    expect(shown('data-mcp-table')).toBe(false)
  })

  it('asks again in place, and clears itself when the answer arrives', async () => {
    root.innerHTML = backupsCard(t, s)
    wireLists(root, {})
    await settle()
    expect(shown('data-backup-failed')).toBe(true)
    routes.set('/api/backup/list', {
      snapshots: [{ name: 'a.tar.gz', size: 1, createdAt: ISO }], lastRunAt: ISO,
    } satisfies BackupListWire)
    root.querySelector<HTMLButtonElement>('[data-load-retry]')?.click()
    await settle()
    expect(shown('data-backup-failed')).toBe(false)
    expect(root.querySelectorAll('[data-backup]').length).toBe(1)
  })

  it('arms the retry once, however many times the question breaks', async () => {
    // A listener added on every failure fires N times on one click, which on this card means N
    // requests and a box that flickers back after it cleared.
    root.innerHTML = backupsCard(t, s)
    wireLists(root, {})
    await settle()
    const key = root.querySelector<HTMLButtonElement>('[data-load-retry]')
    key?.click()
    await settle()
    expect(shown('data-backup-failed')).toBe(true)
    let calls = 0
    const previous = globalThis.fetch
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => { calls++; return previous(...args) }) as typeof fetch
    key?.click()
    await settle()
    expect(calls).toBe(1)
  })
})

describe('a stamp that is a number', () => {
  it('reads the same instant whether it arrives as epoch or as text', () => {
    // The whole bug in one line: `lastSeenAt` is an integer and every other stamp in the admin
    // is ISO text, so the formatter has to take both or the next caller reaches for `.slice()`.
    expect(formatDateTimeShort(WHEN)).toBe(formatDateTimeShort(ISO))
    expect(formatDateTimeShort(WHEN)).not.toContain('Invalid')
  })

  it('hands back something printable for a stamp it cannot read', () => {
    expect(formatDateTimeShort('not a date')).toBe('not a date')
    expect(formatDateTimeShort(Number.NaN)).toBe('NaN')
  })

  it('is what a session row is typed to carry', () => {
    // A compile-time assertion with a runtime body: if `SessionWire.lastSeenAt` ever goes back
    // to `string`, this file stops building and the reader is told before the browser is.
    const wire: SecurityWire = {
      currentSessionId: 'a', recoveryLeft: 8, totpEnabled: true,
      sessions: [{ id: 'a', device: null, createdAt: WHEN, lastSeenAt: WHEN, current: true }],
    }
    expect(formatDateTimeShort(wire.sessions[0]!.lastSeenAt)).toBe(formatDateTimeShort(ISO))
  })
})
