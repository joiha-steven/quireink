// The other end of `/setup/restore/parts`: a program pushing an archive into an empty blog (G4).
//
// Written for the "Move to Cloudflare" step — a Bun blog sending its own archive into a fresh
// Cloudflare blog with that blog's SETUP_CODE — and used today by `scripts/ops/cloudflare-dev.ts`,
// which moves a blog Bun → Cloudflare → Bun through it. Plain `fetch` and a `Blob`, so it runs on
// either runtime and in a script. The page's own uploader is `assets/js/restore-form.ts`, the
// same protocol in a browser. The protocol is in `docs/backups.md`.
//
// A Blob (or a `Bun.file`) because a part has to be sendable twice: a part that fails is sent again
// from the same bytes, which a stream read once cannot give.

export type PushOptions = {
  /** The bytes per part; the server's suggestion when absent. Never more than it allows. */
  partBytes?: number
  /** For a sealed archive: the key file's line, or the passphrase. */
  identity?: string
  passphrase?: string
  /** An upload begun earlier, to finish rather than start again. */
  resume?: string
  /** Tries per part before giving up. A dropped connection or a 5xx is worth another; a 4xx is not. */
  attempts?: number
  onProgress?: (sent: number, total: number) => void
  fetch?: (url: string, init: RequestInit) => Promise<Response>
}

/** What a part is cut from: a `Blob`, a `File` in a browser, a `Bun.file` read from disk on demand. */
export type Sendable = { readonly size: number; slice: (start?: number, end?: number) => Blob }

export type PushReport = { id: string; version: string; tables: number; uploads: number; parts: number; resent: number }

/** A refusal from the blog, with the API's `code` (`not-empty`, `version`, `needs-key`, …). */
export class PushRefused extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(`${status} ${code}: ${message}`)
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; code?: string; error?: string }

/** Load `archive` into the empty blog at `base`, sent in parts. Throws `PushRefused` when it says no. */
export async function pushArchive(base: string, token: string, archive: Sendable, opts: PushOptions = {}): Promise<PushReport> {
  const go = opts.fetch ?? ((url, init) => fetch(url, init))
  const root = `${base.replace(/\/+$/, '')}/setup/restore/parts`
  const auth = { authorization: `Bearer ${token}` }
  const call = async <T>(url: string, init: RequestInit): Promise<T> => {
    const res = await go(url, { ...init, headers: { ...auth, ...(init.headers as Record<string, string> | undefined) } })
    const body = (await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }))) as Envelope<T>
    if (!body.success) throw new PushRefused(res.status, body.code ?? 'refused', body.error ?? `HTTP ${res.status}`)
    return body.data
  }

  let id = opts.resume ?? ''
  let partBytes = opts.partBytes ?? 0
  let held = new Map<number, number>()
  if (id) {
    const status = await call<{ size: number; parts: { part: number; size: number }[] }>(`${root}/${id}`, { method: 'GET' })
    if (status.size !== archive.size) throw new PushRefused(409, 'size', `that upload is ${status.size} bytes, this archive ${archive.size}`)
    held = new Map(status.parts.map((p) => [p.part, p.size]))
    partBytes ||= status.parts[0]?.size ?? 0
  }
  if (!id || !partBytes) {
    const begun = await call<{ id: string; partBytes: number; maxPartBytes: number }>(root, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: archive.size }),
    })
    id ||= begun.id
    partBytes = Math.min(partBytes || begun.partBytes, begun.maxPartBytes)
  }

  const count = Math.ceil(archive.size / partBytes)
  let sent = 0
  let resent = 0
  for (let part = 1; part <= count; part++) {
    const slice = archive.slice((part - 1) * partBytes, Math.min(part * partBytes, archive.size))
    if (held.get(part) !== slice.size) {
      for (let attempt = 1; ; attempt++) {
        try {
          // The part's bytes, not the slice itself: Bun 1.3.14's `fetch` never sends a body that is
          // a slice of a `Bun.file` past its first megabyte — the request hung until the timeout,
          // with or without a Content-Length (2026-10-03). One part in memory, 16 MB, is the price.
          const body = new Uint8Array(await slice.arrayBuffer())
          await call(`${root}/${id}/${part}`, { method: 'PUT', headers: { 'content-length': String(body.length) }, body })
          break
        } catch (error) {
          const lasting = error instanceof PushRefused && error.status < 500
          if (lasting || attempt >= (opts.attempts ?? 4)) throw error
          resent += 1
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)))
        }
      }
    }
    sent += slice.size
    opts.onProgress?.(sent, archive.size)
  }

  const loaded = await call<{ version: string; tables: number; uploads: number }>(`${root}/${id}/load`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: opts.identity ?? '', passphrase: opts.passphrase ?? '' }),
  })
  return { id, version: loaded.version, tables: loaded.tables, uploads: loaded.uploads, parts: count, resent }
}
