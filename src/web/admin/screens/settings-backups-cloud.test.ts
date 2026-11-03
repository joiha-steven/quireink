// The Backups card on a blog that runs on Cloudflare. It said restoring was "a shell procedure with
// the service stopped", that snapshots were "kept on this server" and survived "not a lost disk",
// word for word as on a server (2026-11-03). There is no shell, no server and no disk there: the
// snapshots are in the bucket, apart from the database, and a backup goes into a new, empty blog.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { backupsCard } from './settings-server-ops'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'

const before = process.env.QUIREINK_PACKAGE
afterAll(() => { if (before === undefined) delete process.env.QUIREINK_PACKAGE; else process.env.QUIREINK_PACKAGE = before })
const t = adminT('en')

describe('the Backups card', () => {
  beforeAll(() => { process.env.QUIREINK_PACKAGE = 'cloudflare' })
  it('speaks of the bucket and a new blog on Cloudflare, never of a shell or a disk', () => {
    const html = backupsCard(t, { ...DEFAULT_SETTINGS })
    for (const said of [t.exportHint, t.backupAutoDesc, t.exportReplicationNote]) expect(html).not.toContain(said)
    expect(html).toContain(t.exportHintCloud)
    expect(html).toContain(t.backupAutoDescCloud)
    expect(html).toContain(t.exportReplicationNoteCloud)
  })

  it('keeps the server\'s sentences on a server', () => {
    process.env.QUIREINK_PACKAGE = 'docker'
    const html = backupsCard(t, { ...DEFAULT_SETTINGS })
    expect(html).toContain(t.exportHint)
    expect(html).toContain(t.exportReplicationNote)
  })
})
