// The restore from the shell (`scripts/restore.ts`) and what it leaves out: the sign-ins of the
// blog the archive came from. It checks every table it built against the manifest, and a table
// that is empty on purpose has to pass that check rather than read as a short archive.
import { afterAll, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createSession } from '@/auth/sessions'
import { archiveStream } from '@/server/archive'
import { restoreArchive } from '../../scripts/restore-lib'

const DIR = join(process.cwd(), '.tmp/test-restore-sessions')
rmSync(DIR, { recursive: true, force: true })
freshDatabase(`${DIR}/data`)
afterAll(() => {
  dropDatabase(`${DIR}/data`)
  rmSync(DIR, { recursive: true, force: true })
})

it('restores a blog whose archive holds a live session, and signs nobody in', async () => {
  db().exec("insert into users (id, username, email, password_hash, created_at, updated_at) values (1, 'owner', 'o@example.com', 'h', 1, 1)")
  createSession(1)
  db().exec("insert into mcp_tokens (name, token_hash, prefix, created_at, expires_at) values ('Connector', 'hash-1', 'vbmcp_x', 1, 9999999999999)")
  const archive = join(DIR, 'with-a-session.tar.gz')
  await Bun.write(archive, await new Response(await archiveStream()).arrayBuffer())

  const out = join(DIR, 'out')
  await restoreArchive({ archive, dataDir: join(out, 'data'), uploadsDir: join(out, 'uploads') })
  const restored = new Database(join(out, 'data', 'quire.db'), { readonly: true })
  try {
    expect((restored.query('select count(*) as n from sessions').get() as { n: number }).n).toBe(0)
    expect((restored.query('select count(*) as n from users').get() as { n: number }).n).toBe(1)
    expect((restored.query('select count(*) as n from mcp_tokens').get() as { n: number }).n).toBe(1)
  } finally {
    restored.close()
  }
})
