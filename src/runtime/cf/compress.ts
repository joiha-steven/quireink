// Cloudflare: nothing. The edge compresses every response on its way out, and compressing in the
// Worker as well sent `br(br(html))` to the browser (measured 2026-10-03, G0).
import type { CompressPort } from '@/runtime/ports'

export const compression: CompressPort['compression'] = () => async (_c, next) => { await next() }
