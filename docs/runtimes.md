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
| `imageEngine` | `sharp`: libvips, one child process per display variant (ADR 0061) | `cloudflare-images`: the Images binding | The same widths and formats at the same qualities; the bytes of a variant can differ slightly. Images bills past 5,000 distinct transformations a month |
| `cardRenderer` | `sharp` draws the social card's SVG | `resvg`, compiled to WASM | The same 2400×1260 card from the same SVG; antialiasing may differ by a pixel |
| `passwordHash` | Bun's own argon2id | argon2id in plain JS (`@noble/hashes`, ADR 0069) | The same hash strings: a password set on one verifies on the other |
| `preMigrationCopy` | `file`: `VACUUM INTO` a copy in `data/backups/` (ADR 0063) | `bookmark`: a point in the Durable Object's history, restorable for 30 days | Both are taken before a migration runs; restoring a bookmark is a Cloudflare dashboard or API action |
| `clock` | `timer` in the process (ADR 0031) | `alarm` on the Durable Object | Scheduled posts go out within a minute either way |
| `store` | `disk`: `STORAGE_LOCAL_DIR` | `r2`: the bucket bound as `BLOBS` | The same pathnames, so a backup moves between them unchanged |

## What only Bun has, and why

- **`bun run upgrade`, `install.sh`, `server.sh`** — installing onto a machine. A Cloudflare install
  upgrades by syncing its fork (Workers Builds deploys it) or from the admin.
- **The PRAGMAs** (`journal_mode`, `cache_size`, …) — a Durable Object manages its own SQLite and
  refuses them.

## What only Cloudflare has

- **Point-in-time restore** of the whole blog to any moment in the last 30 days, outside the app.
- **No machine to keep**: certificates, disks and operating-system updates are the platform's.
