// The snapshot that leaves the machine, proven against a fake bucket: the three verbs are
// injected, so no test touches a network — and the pruning discipline (our prefix, our
// name shape, nothing else) is exactly the part worth proving.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { saveSettings } from '@/content/settings'
import {
  normalizePrefix, replicateSnapshot, offsiteTest, offsiteTarget, type OffsiteClient,
} from '@/server/backup-offsite'
import { saveIntegrationKeys } from '@/store/integration-keys'

const DIR = './.tmp/test-backup-offsite'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  for (const t of ['settings', 'integration_keys', 'activity_log']) db().run(`delete from ${t}`)
})

/** A bucket that remembers. Seed `holding` to shape what list() answers. */
function fakeBucket(holding: string[] = []) {
  const calls = { written: [] as string[], deleted: [] as string[] }
  const client: OffsiteClient = {
    write: async (key) => { calls.written.push(key); holding.push(key); return 1 },
    list: async () => ({ contents: holding.map((key) => ({ key })) }),
    delete: async (key) => { calls.deleted.push(key) },
  }
  return { client, calls }
}

describe('normalizePrefix', () => {
  it('makes a folder name of whatever was pasted', () => {
    expect(normalizePrefix('')).toBe('')
    expect(normalizePrefix('blog')).toBe('blog/')
    expect(normalizePrefix('/a/b/')).toBe('a/b/')
    expect(normalizePrefix('  photos  ')).toBe('photos/')
  })
})

describe('replicateSnapshot', () => {
  it('ships under the prefix and prunes only our own shape past keep', async () => {
    await saveSettings({ backups: { enabled: true, intervalDays: 1, keep: 2 } })
    const holding = [
      'blog/quire-2026-08-01T0100.tar.gz',
      'blog/quire-2026-08-02T0100.tar.gz',
      'blog/somebody-elses-file.tar.gz', // shares the bucket; not ours to count or delete
      'other/quire-2026-08-03T0100.tar.gz', // our shape, someone else's prefix
    ]
    const { client, calls } = fakeBucket(holding)
    const ok = await replicateSnapshot('/tmp/x.tar.gz', 'quire-2026-08-27T0900.tar.gz', { client, prefix: 'blog/' })
    expect(ok).toBe(true)
    expect(calls.written).toEqual(['blog/quire-2026-08-27T0900.tar.gz'])
    // keep=2: the new one + the newest old one stay; only the OLDEST of ours goes.
    expect(calls.deleted).toEqual(['blog/quire-2026-08-01T0100.tar.gz'])
  })

  it('reports a bucket failure without throwing — the local snapshot is already safe', async () => {
    const client: OffsiteClient = {
      write: async () => { throw new Error('SignatureDoesNotMatch') },
      list: async () => ({ contents: [] }),
      delete: async () => {},
    }
    const ok = await replicateSnapshot('/tmp/x.tar.gz', 'quire-2026-08-27T0900.tar.gz', { client, prefix: '' })
    expect(ok).toBe(false)
  })

  it('is a no-op with no bucket configured', async () => {
    expect(await replicateSnapshot('/tmp/x.tar.gz', 'quire-2026-08-27T0900.tar.gz', null)).toBe(false)
  })
})

describe('offsiteTest', () => {
  it('writes one marker and removes it', async () => {
    const { client, calls } = fakeBucket()
    await offsiteTest({ client, prefix: 'blog/' })
    expect(calls.written).toEqual(['blog/quire-connection-test.txt'])
    expect(calls.deleted).toEqual(['blog/quire-connection-test.txt'])
  })

  it('names the problem when nothing is configured', async () => {
    expect(offsiteTest(null)).rejects.toThrow('not configured')
  })
})

describe('offsiteTarget', () => {
  it('needs bucket + both keys; endpoint and region stay optional', async () => {
    expect(await offsiteTarget()).toBeNull()
    await saveIntegrationKeys({ s3Bucket: 'b', s3AccessKeyId: 'id', s3SecretAccessKey: 's', s3Prefix: '/blog/' })
    const target = await offsiteTarget()
    expect(target).not.toBeNull()
    expect(target!.prefix).toBe('blog/')
  })
})
