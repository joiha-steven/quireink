# Two runtimes: what differs between Bun and Cloudflare

> Read when touching anything under `src/runtime/`, or when a feature behaves differently on a
> Cloudflare install. The decision is [ADR 0066](decisions/0066-cloudflare-is-a-second-runtime.md);
> the seam is described at the top of [`src/runtime/ports.ts`](../src/runtime/ports.ts).

Quire Ink is one codebase that runs on two runtimes: **Bun** — a process, from the source checkout
or the image — and **Cloudflare** — a Worker and one Durable Object per blog. Everything a reader or
an owner can do is the same on both, page for page; that is held by the port contracts running on
both sides (`bun test` and `bun run test:cf`) and, from G2, by a crawl that serves the same backup
from both and compares every page.

What differs is HOW a few things are done. Each is a key of `CAPABILITIES` in
`src/runtime/<runtime>/capabilities.ts`, and `check:install-matrix` fails when a key has no row here
or a row has no key. A difference that is not in this table is a bug.

| Key | Bun | Cloudflare | What it means for an owner |
|:--|:--|:--|:--|
| `compression` | `origin`: brotli and gzip in the process, with a content-addressed cache | `edge`: Cloudflare compresses on the way out | Nothing. Compressing twice sent `br(br(html))`, so the Worker does not |
| `imageEngine` | `sharp`: libvips, one child process per display variant (ADR 0061) | `cloudflare-images`: the Images binding | The same widths and formats at the same qualities; the bytes of a variant can differ slightly. Both turn a photo upright by its EXIF orientation and keep a logo's transparency (measured on Cloudflare 2026-10-03; a 12 MP photo to a 1600 px AVIF in 540 ms) — but `wrangler dev`'s local Images ignores the orientation, so a sideways photo there is the emulator, not the code. Images bills past 5,000 distinct transformations a month |
| `cardRenderer` | `sharp` draws the social card's SVG | `resvg`, compiled to WASM | The same 2400×1260 card from the same SVG; antialiasing may differ by a pixel |
| `passwordHash` | Bun's own argon2id | argon2id in plain JS (`@noble/hashes`, ADR 0069) | The same hash strings: a password set on one verifies on the other |
| `preMigrationCopy` | `file`: `VACUUM INTO` a copy in `data/backups/` (ADR 0063) | `bookmark`: a point in the Durable Object's history, restorable for 30 days | Both are taken before a migration runs; restoring a bookmark is a Cloudflare dashboard or API action |
| `clock` | `timer` in the process (ADR 0031) | `alarm` on the Durable Object | Scheduled posts go out within a minute either way |
| `store` | `disk`: `STORAGE_LOCAL_DIR` | `r2`: the bucket bound as `BLOBS` | The same pathnames, so a backup moves between them unchanged. Kept backups beside them: `BACKUP_DIR` on Bun, `private/backups/` in the bucket on Cloudflare, which `/uploads` refuses to serve |
| `clientAddress` | `peer`: the socket, and `CF-Connecting-IP` only once Cloudflare is configured in front | `edge`: `CF-Connecting-IP` and `CF-IPCountry`, which the platform writes on every request | Rate limits and the analytics country count readers one by one on both. A Worker has no socket, so before this key every reader on Cloudflare shared one limit |
| `bodyLimits` | `machine`: uploads up to `MAX_UPLOAD_MB` (64 MB by default), imports up to 100 MB | `isolate`: 25 MB and 30 MB by default | A request body is held whole in a Worker's 128 MB, plus a copy of the one file being worked on (a batch is read a file at a time, and a picture goes to the Images binding without another copy), so the defaults are smaller there; `MAX_UPLOAD_MB` still sets the upload limit on either |

## What only Bun has, and why

- **`bun run upgrade`, `install.sh`, `server.sh`** — installing onto a machine. A Cloudflare install
  upgrades the way it was installed: the *Update Quire Ink* workflow in its GitHub copy (the Deploy
  button), one key in Settings (*Move to Cloudflare*), or `bun run deploy` again.
- **The PRAGMAs** (`journal_mode`, `cache_size`, …) — a Durable Object manages its own SQLite and
  refuses them.

## What only Cloudflare has

- **Point-in-time restore** of the whole blog to any moment in the last 30 days, outside the app.
- **No machine to keep**: certificates, disks and operating-system updates are the platform's.
