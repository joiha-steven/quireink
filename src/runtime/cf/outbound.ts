// Cloudflare: a fetch BY NAME. A Worker cannot choose the address it connects to, so the address
// the SSRF guard checked is not used here, and the platform resolves the name again when it
// connects.
//
// ⚠️ SO DNS REBINDING IS NOT STOPPED BY THIS CODE ON CLOUDFLARE. A name that answers a public
// address to the guard and an inward one a moment later is followed. What a Worker can reach is the
// platform's network, which has no loopback, private network or metadata service of this blog
// behind it: that is the platform's property, not something this function checks.
import type { OutboundPort } from '@/runtime/ports'

export const fetchAt: OutboundPort['fetchAt'] = (url, _address, init) => fetch(url, init)
