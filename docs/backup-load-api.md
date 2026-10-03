# Loading a backup into an empty blog, from a program

> The HTTP side of **Start from a backup** ([backups.md](backups.md#starting-a-new-blog-from-a-backup)),
> for an archive of any size: the archive in parts, then one call to load it. The page's own script
> ([`src/assets/js/restore-form.ts`](../src/assets/js/restore-form.ts)) speaks it past 48 MB; the
> routes are [`src/web/setup-restore-parts.ts`](../src/web/setup-restore-parts.ts) and the rules
> [`src/server/restore-parts.ts`](../src/server/restore-parts.ts).

A program loads a backup into an empty blog through the same door: the "Move to Cloudflare" step
pushes a Bun blog's archive into a fresh Cloudflare blog with that blog's `SETUP_CODE`, and
[`src/server/restore-push.ts`](../src/server/restore-push.ts) is a client for it, used by
[`scripts/ops/cloudflare-dev.ts`](../scripts/ops/cloudflare-dev.ts). Every request is guarded
exactly like the form: refused with `409 claimed` once the blog has an owner, and it carries the
setup token or `SETUP_CODE` as `Authorization: Bearer <code>` (a header, so it is never written
into an access log, and no other site's page can send it without a CORS preflight this blog does
not answer). A wrong code is `403 bad-token` and is charged to the same budget as the claim: ten
misses per address per quarter hour, then `429 too-many` for everything from that address.

Answers are JSON: `{ "success": true, "data": … }`, or `{ "success": false, "code": "…", "error":
"…" }` with the sentence in the blog's language.

| Request | Body | Answer |
|:--|:--|:--|
| `POST /setup/restore/parts` | `{ "size": <archive bytes> }` | `201`, `{ id, size, partBytes, maxPartBytes, parts }`. Refused with `409 not-empty` or `409 busy` before anything is sent |
| `PUT /setup/restore/parts/<id>/<n>` | part *n* (from 1), the raw bytes, with `Content-Length` | `{ part, size }`. Parts may arrive in any order, and one sent again replaces itself |
| `GET /setup/restore/parts/<id>` | — | `{ id, size, held, parts: [{ part, size }] }`: what is held, to resume |
| `POST /setup/restore/parts/<id>/load` | `{ "identity"?: "…", "passphrase"?: "…" }` | `{ loaded: true, location: "/login", version, tables, uploads }` |
| `DELETE /setup/restore/parts/<id>` | — | `{ dropped }`, and the parts are gone |

The rules a client meets:

- A part is 1 byte to `maxPartBytes` (64 MB); every part but the last should be `partBytes` (16 MB)
  so that part *n* starts at `(n − 1) × partBytes`, which is what the resume reads back. The parts
  may not come to more than `size`: `413 too-much`, `413 part-size`, `411 length`.
- `load` refuses with `409 incomplete`, naming the first missing part, until parts 1 to *n* are all
  held and add up to exactly `size`. After that its refusals are the form's: `422 version` (with
  the version to upgrade the old blog to), `422 old-format`, `422 needs-key`, `422 no-matching-key`
  (`bad-identity` and `bad-kdf` for a key that will not parse), `422 bad-archive`, `409 not-empty`,
  `409 busy`, `500 failed`. The parts are kept after a refusal and dropped after a
  load.
- An id lives for a day from `POST`. After that, or for an id the blog never made, `404 unknown`.
- Retry a part on a dropped connection or a `5xx`; a `4xx` is an answer, and sending again changes
  nothing.

On Cloudflare the load is one request, served by the blog's Durable Object for as long as it takes;
nothing in it waits on `blockConcurrencyWhile`, which resets the object after 30 seconds. Measured
under `wrangler dev` (2026-10-03, [`cloudflare-dev.ts`](../scripts/ops/cloudflare-dev.ts) with
`BIG=1`): a 123.7 MB archive went up in 8 parts and loaded in 4.5 s with the isolate's live heap
at 63 MB throughout; the same blog's archive back into a fresh Bun blog, 8 parts, 0.5 s. Every
upload in the archive is one write to the bucket inside that request, so an archive of tens of
thousands of pictures is tens of thousands of R2 writes in one request.
