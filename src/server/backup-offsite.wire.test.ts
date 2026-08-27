// The offsite path against a REAL S3 wire: a stub bucket served by Bun.serve, spoken to by
// the actual Bun.S3Client that production uses. The unit tests beside this one inject a
// fake and prove the pruning discipline; this one proves the seams the fake bypasses —
// that the client reaches a custom endpoint, that a PUT carries the bytes, that our
// reading of the list answer (`.contents[].key`) matches what a bucket actually says.
import { describe, it, expect, afterAll } from 'bun:test'
import { replicateSnapshot, offsiteTest } from '@/server/backup-offsite'
import { freshDatabase, dropDatabase } from '@/test/db'
import { saveSettings } from '@/content/settings'

const DIR = './.tmp/test-offsite-wire'
freshDatabase(DIR)

// ---- a bucket in forty lines ----------------------------------------------------------
const held = new Map<string, Uint8Array>()
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url)
    // Path-style: /<bucket>/<key...>. The list call is GET /<bucket>?list-type=2.
    const [, bucket, ...rest] = url.pathname.split('/')
    const key = rest.join('/')
    if (bucket !== 'stub-bucket') return new Response('wrong bucket', { status: 404 })
    if (req.method === 'PUT') {
      held.set(key, new Uint8Array(await req.arrayBuffer()))
      return new Response(null, { status: 200, headers: { etag: '"x"' } })
    }
    if (req.method === 'DELETE') {
      held.delete(key)
      return new Response(null, { status: 204 })
    }
    if (req.method === 'GET' && url.searchParams.has('list-type')) {
      const prefix = url.searchParams.get('prefix') ?? ''
      const keys = [...held.keys()].filter((k) => k.startsWith(prefix))
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult><Name>stub-bucket</Name><IsTruncated>false</IsTruncated>${
        keys.map((k) => `<Contents><Key>${k}</Key><Size>${held.get(k)!.byteLength}</Size></Contents>`).join('')
      }</ListBucketResult>`
      return new Response(xml, { headers: { 'content-type': 'application/xml' } })
    }
    return new Response('unhandled', { status: 400 })
  },
})

afterAll(() => {
  server.stop(true)
  dropDatabase(DIR)
})

const target = () => ({
  client: new Bun.S3Client({
    accessKeyId: 'stub-id',
    secretAccessKey: 'stub-secret',
    bucket: 'stub-bucket',
    region: 'auto',
    endpoint: `http://127.0.0.1:${server.port}`,
  }),
  prefix: 'blog/',
})

describe('the offsite path over a real wire', () => {
  it('ships the archive bytes, lists, and prunes through actual S3 answers', async () => {
    await saveSettings({ backups: { enabled: true, intervalDays: 1, keep: 2 } })
    // Two older snapshots already in the bucket, plus a neighbour that is not ours.
    held.set('blog/quire-2026-08-01T0100.tar.gz', new Uint8Array([1]))
    held.set('blog/quire-2026-08-02T0100.tar.gz', new Uint8Array([2]))
    held.set('blog/not-a-snapshot.txt', new Uint8Array([3]))

    const archive = `${DIR}/quire-2026-08-27T1200.tar.gz`
    await Bun.write(archive, 'archive-bytes')

    expect(await replicateSnapshot(archive, 'quire-2026-08-27T1200.tar.gz', target())).toBe(true)
    // The bytes arrived, not just the name.
    expect(new TextDecoder().decode(held.get('blog/quire-2026-08-27T1200.tar.gz'))).toBe('archive-bytes')
    // keep=2 pruned the oldest of OURS; the neighbour survives.
    expect(held.has('blog/quire-2026-08-01T0100.tar.gz')).toBe(false)
    expect(held.has('blog/quire-2026-08-02T0100.tar.gz')).toBe(true)
    expect(held.has('blog/not-a-snapshot.txt')).toBe(true)
  })

  it('the test button round-trips its marker', async () => {
    await offsiteTest(target())
    expect(held.has('blog/quire-connection-test.txt')).toBe(false)
  })
})
