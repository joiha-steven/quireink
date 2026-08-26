---
name: quireink-install
description: Install, upgrade or repair a self-hosted Quire Ink blog on a server the user controls — Docker or a Bun process under systemd, the reverse proxy in front, the one-time link that claims the blog, and the checks that prove it is really serving. Use when the user asks to set up, host, deploy, upgrade or fix a Quire Ink install, or hands you a fresh server and a domain.
---

# Installing Quire Ink

One process, two SQLite files, one uploads directory, behind a reverse proxy. There is no
database server, no migration command and no third-party account in the path. Everything
below is the short form of [`docs/self-host.md`](../../../docs/self-host.md) and
[`docs/self-host-docker.md`](../../../docs/self-host-docker.md) — read those when a step
does not fit the machine in front of you.

## Decide these four before typing anything

| | Ask, or infer | Why it cannot wait |
|---|---|---|
| **The address** | `SITE_URL=https://example.com` | Feeds, OG images and every link in an email are built from it. It is deliberately never guessed from the request, so an install without it emails `http://localhost:3000` to real subscribers |
| **Docker or native** | Docker unless the user has a reason | Docker is two commands and no Bun on the host. Native is right when they already run Bun services or want the source checkout to edit |
| **Where the data lives** | `DATA_DIR`, `STORAGE_LOCAL_DIR` | Neither may sit inside the code directory. An upgrade replaces the code |
| **Who terminates TLS** | Caddy, nginx, or a tunnel | The app listens on loopback by design and speaks plain HTTP |

## The install

**Docker, published image.** Nothing to clone, no build step, `amd64` and `arm64` both exist:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
```

**Native, one command.** [`install.sh`](../../../install.sh) does the mechanical half — clone,
install, build both artefacts, start it so the log prints the claim link — and deliberately
none of the half that has consequences: no `sudo`, no Bun install, no systemd, no proxy. It
refuses to run as root and re-running it on the same directory updates and rebuilds:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | SITE_URL=https://example.com QUIREINK_DIR=/home/quire/app NO_RUN=1 bash
```

Settings go in front of `bash`. In front of `curl` they belong to the download and never
reach the script — a mistake worth catching before you hand the line to somebody's server.

**Native, by hand.** Bun 1.3+, its own unprivileged user, and the checkout IS the deployment:

```bash
git clone https://github.com/joiha-steven/quireink.git /home/quire/app
cd /home/quire/app && bun install && bun run build:assets && bun run build:admin
DATA_DIR=/var/lib/quire/data STORAGE_LOCAL_DIR=/var/lib/quire/uploads \
  SITE_URL=https://example.com bun src/index.ts
```

`bun run build` produces those two artefacts and nothing else. **There is no compiled
binary** ([ADR 0022](../../../docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)) — do not
go looking for one, and do not "helpfully" add a build step that emits one.

## Claiming the blog: read the log, do not open a shell

A blog nobody owns prints a one-time `/setup?token=…` link **every time it starts**:

```bash
docker logs quire | grep -A4 'no owner'      # or: journalctl -u quire | grep -A4 'no owner'
```

Hand that link to the user and stop. The rest is their browser: username, email, password,
then the authenticator QR and ten recovery codes, shown once. **Do not paste their password
anywhere, and do not attempt to enrol two-factor on their behalf.** The token lives in
memory, so a restart invalidates it — if they lose it, restart the service and read the log
again.

## The reverse proxy, and the one trap that keeps biting

Caddy is the shortest route because it gets its own certificate with nothing scheduled.
nginx is documented in full, CSP included, in `docs/self-host.md` §5.

**`/.well-known/*` MUST reach the app.** A CloudPanel or stock nginx vhost ships a
`location ~ /.well-known { … }` block for ACME with no `proxy_pass`. It swallows every
`/.well-known/*` request and answers a disk 404, which silently breaks MCP's OAuth
discovery — the connector shows "server unavailable" and nothing in the app's log explains
why. Narrow it to `location ^~ /.well-known/acme-challenge/`. If a CDN sits in front, purge
once after fixing: a cached 404 outlives the fix.

Other proxy facts that are decisions, not defaults: the container publishes to
`127.0.0.1` on purpose (Docker writes its own iptables rules, so a host firewall showing
"deny" is not protecting a `3000:3000` publish), and `TRUST_PROXY=1` belongs **only** when
the proxy reaches the app over a public address.

## What you do NOT have to set up

**No crontab.** The process runs its own maintenance clock since
[ADR 0031](../../../docs/decisions/0031-the-blog-winds-its-own-clock.md): due posts every
minute, everything else hourly. Do not add a cron entry "to be safe" — set `CRON_INTERNAL=0`
first if the operator wants their own scheduler, or you get two clocks and logs that mean
nothing. `/api/cron` still exists for that case, and for a deploy hook (`?purge=1`).

**No CDN, no Cloudflare account.** Both are optional and unconfigured is a no-op.

## Prove it before saying it works

Never report success from a `docker ps` line or an HTTP 200 through a CDN. Check, in order:

1. `curl -sI https://example.com/` at the **origin**, not through the CDN.
2. The claim link is in the log, or the admin sign-in page renders.
3. `/feed.xml`, `/sitemap.xml` and `/robots.txt` answer 200 and carry the real address.
4. `/.well-known/oauth-protected-resource` answers **from the app** (JSON), not a 404.
5. Upload one image in the admin and see it served from `/uploads`.

If a CDN is in front, every one of those must be re-checked through it once, because the
origin being right proves nothing about what a reader gets.

## Upgrading

Take a backup first ([`docs/backups.md`](../../../docs/backups.md)), always. The schema is applied
at boot inside a transaction, so there is no migration command.

```bash
docker pull quireink/quireink:latest                 # published image: pull, then recreate
docker rm -f quire && docker run -d --name quire ...  # same flags as the install above
git pull && docker compose up -d --build             # a checkout that builds its own image
cd /home/quire/app && git pull && bun install && bun run build:assets && bun run build:admin && systemctl restart quire
```

`docker-compose.yml` in this repository **builds** the image rather than pulling one, so
`docker compose pull` does nothing there — it is `--build` that upgrades it. Native installs
must rebuild both artefacts: they are read from disk at runtime, so a `git pull` without a
rebuild serves the previous release's admin against the new server. Content lives in the
volumes and is untouched by either.

## Do not

- Do not put `DATA_DIR` or the uploads directory inside the app directory.
- Do not run the app as root, and do not `chown` its data to root to "fix" a permission
  error — set `PUID`/`PGID` instead when using bind mounts.
- Do not invent config files. Configuration is environment variables plus the admin;
  there is no config file to write.
- Do not create a second owner account to solve a lost-recovery-code problem. The software
  refuses it by design; the answer is the recovery codes or database access.
