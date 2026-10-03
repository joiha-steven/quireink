// The parts of "Move to Cloudflare" that do not need a Cloudflare account: what the Worker is
// called, and the checks a downloaded package has to pass before anything is created. The move
// end to end runs against a real account (see the commit that added this file).
import { describe, expect, it } from 'bun:test'
import { scriptNameFor } from './move'
import { fetchPackage, PackageError } from './package'
import { APP_VERSION } from '@/version'

describe('the Worker’s name', () => {
  it('is quireink- and the host, as Cloudflare allows names', () => {
    expect(scriptNameFor('https://stevensdesk.com')).toBe('quireink-stevensdesk-com')
    expect(scriptNameFor('https://Blog.Example.co.uk/path')).toBe('quireink-blog-example-co-uk')
    expect(scriptNameFor('not a url')).toBe('quireink-blog')
    const long = scriptNameFor(`https://${'a'.repeat(80)}.com`)
    expect(long.length).toBeLessThanOrEqual(63)
    expect(long.endsWith('-')).toBe(false)
  })
})

/** A tar holding one manifest, built the way `pack-worker.ts` writes it (ustar). */
function tarOf(name: string, body: Uint8Array): Uint8Array {
  const header = new Uint8Array(512)
  const put = (s: string, at: number) => header.set(new TextEncoder().encode(s), at)
  put(name, 0); put('0000644', 100); put('0000000', 108); put('0000000', 116)
  put(body.length.toString(8).padStart(11, '0'), 124); put('00000000000', 136); put('        ', 148)
  header[156] = 0x30; put('ustar', 257); put('00', 263)
  const sum = header.reduce((n, b) => n + b, 0)
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  const pad = new Uint8Array((512 - (body.length % 512)) % 512)
  const out = new Uint8Array(512 + body.length + pad.length + 1024)
  out.set(header, 0); out.set(body, 512)
  return out
}

const hex = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b)))].map((x) => x.toString(16).padStart(2, '0')).join('')

function fakeRelease(tar: Uint8Array, sum: string | null): typeof fetch {
  return (async (url: string) => {
    if (String(url).endsWith('.sha256')) return sum === null ? new Response('', { status: 404 }) : new Response(`${sum}  quireink-cf.tar\n`)
    return new Response(tar)
  }) as typeof fetch
}

describe('a downloaded package', () => {
  const manifest = (version: string) => new TextEncoder().encode(JSON.stringify({ format: 'quireink-cf/1', version, files: [] }))

  it('opens when it matches its checksum and names this version', async () => {
    const tar = tarOf('manifest.json', manifest(APP_VERSION))
    const pkg = await fetchPackage(APP_VERSION, fakeRelease(tar, await hex(tar)))
    expect(pkg.manifest.version).toBe(APP_VERSION)
  })

  it('is refused when it does not match the published checksum', async () => {
    const tar = tarOf('manifest.json', manifest(APP_VERSION))
    await expect(fetchPackage(APP_VERSION, fakeRelease(tar, 'f'.repeat(64)))).rejects.toThrow('checksum')
  })

  it('is refused when its checksum is missing', async () => {
    const tar = tarOf('manifest.json', manifest(APP_VERSION))
    await expect(fetchPackage(APP_VERSION, fakeRelease(tar, null))).rejects.toThrow(PackageError)
  })

  it('is refused when it is another version, because the backup would be refused at the far end', async () => {
    const tar = tarOf('manifest.json', manifest('0.0.1'))
    await expect(fetchPackage(APP_VERSION, fakeRelease(tar, await hex(tar)))).rejects.toThrow('not ' + APP_VERSION)
  })

  it('says so when the version has no Cloudflare package', async () => {
    const none = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    await expect(fetchPackage(APP_VERSION, none)).rejects.toThrow('has no Cloudflare package')
  })
})
