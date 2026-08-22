import { describe, it, expect, vi, afterEach } from '@/test/vitest'
import { isBlockedAddress, isBlockedUrl, safeFetch, BlockedUrlError } from '@/server/safe-fetch'

// Resolve every hostname to a public IP so the redirect tests exercise the hop
// loop without real DNS. Blocked targets in these tests are literal IPs, which
// are rejected by the pre-DNS check and never reach this mock.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}))

// The address/url classifiers are pure → tested with no network. safeFetch's
// scheme + literal-IP rejection paths also short-circuit before any DNS/fetch.

describe('isBlockedAddress', () => {
  it('blocks the cloud metadata IP 169.254.169.254', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true)
  })

  it('blocks IPv4 loopback 127.0.0.1', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
  })

  it('blocks the 10.0.0.0/8 private range', () => {
    expect(isBlockedAddress('10.1.2.3')).toBe(true)
  })

  it('blocks 172.16/12, 192.168/16, 100.64/10 (CGNAT), 0.0.0.0', () => {
    expect(isBlockedAddress('172.16.0.1')).toBe(true)
    expect(isBlockedAddress('172.31.255.255')).toBe(true)
    expect(isBlockedAddress('192.168.1.1')).toBe(true)
    expect(isBlockedAddress('100.64.0.1')).toBe(true)
    expect(isBlockedAddress('0.0.0.0')).toBe(true)
  })

  it('blocks IPv6 loopback ::1, unspecified ::, link-local, unique-local', () => {
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedAddress('::')).toBe(true)
    expect(isBlockedAddress('fe80::1')).toBe(true)
    expect(isBlockedAddress('fc00::1')).toBe(true)
    expect(isBlockedAddress('fd12:3456::1')).toBe(true)
  })

  it('blocks IPv4-mapped IPv6 equivalents of private ranges', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true)
  })

  it('allows ordinary public addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    expect(isBlockedAddress('1.1.1.1')).toBe(false)
    expect(isBlockedAddress('172.15.0.1')).toBe(false) // just outside 172.16/12
    expect(isBlockedAddress('172.32.0.1')).toBe(false)
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false) // public IPv6
  })
})

describe('isBlockedUrl', () => {
  it('rejects non-http(s) schemes', () => {
    expect(isBlockedUrl(new URL('ftp://example.com/x'))).toBe(true)
    expect(isBlockedUrl(new URL('file:///etc/passwd'))).toBe(true)
    expect(isBlockedUrl(new URL('gopher://example.com'))).toBe(true)
  })

  it('rejects literal private-IP hosts directly (before DNS)', () => {
    expect(isBlockedUrl(new URL('http://127.0.0.1/x'))).toBe(true)
    expect(isBlockedUrl(new URL('http://169.254.169.254/latest/meta-data'))).toBe(true)
    expect(isBlockedUrl(new URL('http://[::1]/x'))).toBe(true)
  })

  it('allows a normal public https URL through the pre-DNS check', () => {
    expect(isBlockedUrl(new URL('https://example.com/image.png'))).toBe(false)
    expect(isBlockedUrl(new URL('https://cdn.example.net/media/a.jpg'))).toBe(false)
  })
})

describe('safeFetch (block paths, no network reached)', () => {
  it('throws BlockedUrlError on a non-http scheme', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it('throws BlockedUrlError on a literal metadata IP', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it('throws BlockedUrlError on loopback ::1', async () => {
    await expect(safeFetch('http://[::1]:8080/x')).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it('throws BlockedUrlError on an unparseable URL', async () => {
    await expect(safeFetch('not a url')).rejects.toBeInstanceOf(BlockedUrlError)
  })
})

// Redirect handling: each hop's Location is re-validated by the full guard
// BEFORE it is followed, so a public URL that 3xx-redirects to an internal
// target can't bypass the guard. We mock global fetch (a literal-IP Location is
// rejected by the pre-DNS check, so no real network is reached).
describe('safeFetch redirect re-validation', () => {
  afterEach(() => vi.restoreAllMocks())

  // Build a minimal Response-like stub: 302 with a Location, or 200 final.
  const redirectTo = (location: string): Response =>
    ({ status: 302, headers: new Headers({ location }) }) as unknown as Response
  const finalOk = (): Response =>
    ({ status: 200, headers: new Headers() }) as unknown as Response

  it('rejects a redirect Location pointing at a literal blocked IP', async () => {
    const fetchMock = vi.fn(async () => redirectTo('http://169.254.169.254/'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(safeFetch('https://example.com/r')).rejects.toBeInstanceOf(BlockedUrlError)
    // Only the first (public) hop was fetched; the blocked target was never hit.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a redirect Location pointing at loopback 127.0.0.1', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => redirectTo('http://127.0.0.1:9000/admin')))
    await expect(safeFetch('https://example.com/r')).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it('rejects a non-http(s) redirect scheme (e.g. file:)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => redirectTo('file:///etc/passwd')))
    await expect(safeFetch('https://example.com/r')).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it('follows a public→public redirect and returns the final response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://cdn.example.org/image.png'))
      .mockResolvedValueOnce(finalOk())
    vi.stubGlobal('fetch', fetchMock)
    const res = await safeFetch('https://example.com/r')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Every hop is fetched with manual redirect handling.
    expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe('manual')
  })

  it('throws BlockedUrlError when the redirect hop cap is exceeded', async () => {
    // Always redirect to a fresh public URL → never terminates → cap trips.
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => redirectTo(`https://example.com/r${n++}`)))
    await expect(safeFetch('https://example.com/r')).rejects.toBeInstanceOf(BlockedUrlError)
  })
})
