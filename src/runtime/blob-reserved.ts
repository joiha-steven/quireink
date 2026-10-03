// `private/` at the top of the blob store is the runtime's, never an upload's (2026-10-03).
//
// Cloudflare keeps everything in one R2 bucket — the uploads, and beside them what must never be
// served: settings set aside by hand (`cf/snapshot.ts`), the backup archives (`cf/archive.ts`). The
// public route `/uploads/*` reads any key the blob port will read, so the line has to be drawn in
// the port: a pathname whose first segment is `private` is refused for reading, writing and
// deleting alike, and listing skips it. Bun keeps those things outside the uploads directory and
// needs no line — it draws the same one anyway, so an upload that works on one runtime works on
// the other and a backup moving between them never carries a path the far side refuses.
export const isReservedBlobPath = (pathname: string): boolean => /^private(?:\/|$)/.test(pathname.replace(/^\.?\/+/, ''))
