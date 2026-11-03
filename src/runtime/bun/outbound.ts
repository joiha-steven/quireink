// Bun: a fetch connected to the address the SSRF guard checked (`server/safe-fetch.ts`), not to
// whatever the name resolves to by the time the socket opens.
//
// The URL is rewritten to the address and the name rides in `Host` and, for https, in
// `tls.serverName`, which is the name Bun sends as SNI and checks the certificate against: measured
// 2026-11-03 against badssl.com, a self-signed and a wrong-host certificate are refused exactly as
// they are by name, and the good one answers 200. Nothing else about the request changes.
import type { OutboundPort } from '@/runtime/ports'

export const fetchAt: OutboundPort['fetchAt'] = async (url, address, init) => {
  if (address === null) return fetch(url, init)
  const at = new URL(url)
  at.hostname = address.includes(':') ? `[${address}]` : address
  const headers = new Headers(init.headers)
  headers.set('host', url.host)
  const tls = url.protocol === 'https:' ? { tls: { serverName: url.hostname } } : {}
  const res = await fetch(at, { ...init, headers, ...tls } as RequestInit)
  // The address is how it was reached, not where it is: a relative link or `Location` on the page
  // is read against the URL the caller asked for, as it would be after a fetch by name.
  Object.defineProperty(res, 'url', { value: url.toString() })
  return res
}
