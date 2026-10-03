# Environment variables

Everything that configures Quire Ink from outside the admin, in one place. Two matter; the rest have working defaults, and a last group only stands in for keys the admin holds.

| Variable | What it does |
|---|---|
| `DATA_DIR` | Where `quire.db` and `analytics.db` go. Defaults to `./data` |
| `SITE_URL` | Your public address, used in feeds, OG images and email. Left empty, all of them say `http://localhost:3000`, so the site still reads fine and only crawlers and mail clients notice. It is deliberately not guessed from the request |

<details>
<summary><b>The other twenty-four</b> &nbsp;ports, limits, storage, cron, mail, proxying, the package, Cloudflare</summary>

| Variable | What it does |
|---|---|
| `STORAGE_LOCAL_DIR` | Where uploads go, served at `/uploads`. Defaults to `./uploads` |
| `PORT` | Defaults to `3000` |
| `HOST` | Which interface to listen on. Defaults to `127.0.0.1`, right when a reverse proxy sits in front on the same machine. Set `0.0.0.0` when it does not |
| `SETUP_CODE` | Twelve characters or more; then `/setup` asks for it instead of the log link. For installs where nobody reads a log: cloud-init, a hosting panel |
| `MAX_UPLOAD_MB` | Largest single upload. Defaults to `64`, matching the `client_max_body_size` in the recommended vhost so the two refuse the same file. The whole request may carry this or 100 MB, whichever is larger, plus 1 MB; a raised value is no longer stopped at Bun's own 128 MB. Routes a stranger can write to (sign-in, comments, subscribe) take 64 KB whatever this says. `0` = no limit |
| `STORAGE_QUOTA_GB` | Largest the uploads folder may grow, counting the smaller copies of each image. Defaults to `5`, and an upload that would go past it is refused. `0` = no limit |
| `PAGE_CACHE_MB` | How much rendered HTML this process keeps in memory. Defaults to `8`, which is chosen for the smallest box this runs on: an ordinary blog fits its whole archive inside it and never notices, and a 1,000-post archive stops at about 330 pages instead of holding all of them. Raise it if you have memory to spare; `0` = no cache kept in memory |
| `CRON_SECRET` | Guards `/api/cron`, which publishes scheduled posts and tidies image variants |
| `CRON_INTERNAL` | `0` stops the process running its own maintenance clock, for when you would rather schedule `/api/cron` yourself. On by default since [ADR 0031](./decisions/0031-the-blog-winds-its-own-clock.md) |
| `PURGE_WEBHOOK_URL` | A URL the blog POSTs to whenever it flushes its own cache, for a CDN that is not Cloudflare ([ADR 0033](./decisions/0033-purging-an-edge-that-is-not-cloudflare.md)). Normally a setting instead |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+`S3_ENDPOINT`, `S3_REGION`, `S3_PREFIX`) | An S3-compatible bucket every snapshot is also shipped to ([ADR 0035](./decisions/0035-the-snapshot-leaves-the-machine.md)). Normally a setting instead |
| `BACKUP_DIR` | Where snapshots are written. Defaults to `<DATA_DIR>/backups` ([backups](./backups.md)) |
| `MCP_OAUTH_SECRET` | Signs MCP OAuth codes. Leave it out and the server makes its own, which is the recommended way |
| `ANALYTICS_TZ` | Default timezone until the owner picks one in **Settings → Blog → Timezone**, which is the site's whole clock: post dates, month markers, the day a chart starts on. Defaults to UTC |
| `CSP` | A Content-Security-Policy to send on every response. Empty by default, and leave it that way behind the shipped `Caddyfile` or the documented nginx block: both send one already, and a browser enforces the intersection, so a second could only narrow theirs. Set it where neither is in front, such as a NAS proxy, a PaaS, or a Kubernetes ingress |
| `SMTP_OFF` | Stops this machine sending mail at all: the newsletter, the confirmation, the comment notice. For a staging or development copy of a real blog: copy the `.env`, set this, and nothing reaches a real address. It fails SAFE, so any value other than `0`, `false`, `no` or empty means off. The subscribe form disappears from the reader's page with it, on purpose: a form that can never send its confirmation leaves somebody waiting for an email that was never coming |
| `TRUST_PROXY` | Set to `1` only when the proxy in front reaches you over a PUBLIC address. Rate limits key on the socket address; `CF-Connecting-IP`/`X-Forwarded-For` are believed automatically from loopback or a private network |
| `QUIRE_INSTALL` | Where this install lives, as an install template names itself (`unraid`, `synology`, …), read only by the daily update check to count installs by kind ([what it sends](./update-check.md)). Set by the template, not by you; unset, it is the package's own name (`QUIREINK_PACKAGE`: `source`, `docker` or `cloudflare`) |
| `QUIREINK_PACKAGE` | Which package this install came from: `source`, `docker` or `cloudflare` ([ADR 0065](./decisions/0065-every-install-runs-a-release.md)). **Set by the package, not by you:** the image carries `docker`, `install.sh` writes `source` into `.env`, and unset means `source`. The admin uses it to show the upgrade that applies, and `/api/health` reports it. Anything else stops the boot |
| `QUIREINK_CF_PACKAGE_URL` | Where *Move to Cloudflare* fetches the Cloudflare package from, instead of this version's GitHub Release. For trying the move from a working tree before a release exists: build with `bun run build && bun run build:worker && bun scripts/pack-worker.ts`, serve `dist/` locally and point this at `quireink-cf-<version>.tar`. Unset in every real install |
| `QUIREINK_SCRIPT`, `QUIREINK_BUCKET` | **Cloudflare only, set by *Move to Cloudflare* (and by the one-click update, which keeps them):** the Worker's own name and its R2 bucket, which Settings needs to replace the Worker it runs in, or to delete it and the bucket when you leave |
| `QUIREINK_UPDATES` | **Cloudflare only, set by whatever deployed the blog:** how it takes a newer release — `api` (*Move to Cloudflare*: Settings updates it with one key), `git` (the Deploy button: Workers Builds deploys its GitHub copy, updated by the copy's *Update Quire Ink* workflow) or `cli` (`bun run deploy` from a machine, and what unset means). Settings shows the way that applies |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (as Worker secrets) | **Cloudflare only:** present when the owner let the blog update itself during *Move to Cloudflare*, and used by Settings' one-key update and by *Delete this blog from Cloudflare*; without them, both ask for a token. On a Bun install `CLOUDFLARE_API_TOKEN` is instead the CDN purge token (Connections) |
| `UPDATE_CHECK` | `0` stops the one request this software makes on its own: once a day it asks what the newest release is, and by asking is counted as a blog in use. It sends the version you run, a token that changes daily and a few coarse facts, never your address, posts, readers or an exact number. Also a switch in Settings. [The whole call](./update-check.md) |

</details>

**And a fallback for keys the admin normally holds.** Each of these is read only when the
matching field in the admin is empty, so a key typed into Settings always wins. They exist for
an install that is configured before anyone signs in, such as a container built from a
template: mail (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`), the comment
challenge (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), the cache purge
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `PURGE_WEBHOOK_URL`), Google sign-in
(`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) and the assistant (`AI_PROVIDER`, `AI_API_KEY`,
`AI_MODEL`). A value set this way lives in the environment, not in the database, so a backup
does not carry it.

**What installs and upgrades read is not here.** `install.sh` (`QUIREINK_VERSION`,
`QUIREINK_CHANNEL`, `QUIREINK_SOURCE`, …), `bun run upgrade` (`QUIREINK_RESTART`,
`QUIREINK_SERVICE`, …) and `server.sh` take their own options, listed at the top of each file; the
compose files read `QUIREINK_TAG` and the image's entrypoint `PUID` and `PGID`
([Docker](self-host-docker.md)). None of them reaches the running blog.

SMTP, Turnstile and CDN credentials go in **Settings → Comments & mail** and **Server & connections**, and stay on the server. Your posts live in `DATA_DIR` and your uploads folder, never in git.
