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
install, build both artefacts — and deliberately none of the half that has consequences: no
`sudo`, no Bun install, no systemd, no proxy. It refuses to run as root, and re-running it on
the same directory updates and rebuilds. Run it as the blog's own user, made first with
`adduser --system --group --home /home/quire quire` (no login shell, hence `sudo -u`), with Bun
installed for that user by `sudo -u quire -H bash -lc 'curl -fsSL https://bun.sh/install | bash'`
(`docs/self-host.md` §1–2):

```bash
sudo -u quire -H bash -lc 'curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | QUIREINK_DIR=/home/quire/app NO_RUN=1 bash'
```

Settings go in front of `bash`. In front of `curl` they belong to the download and never
reach the script — a mistake worth catching before you hand the line to somebody's server.
**Keep `NO_RUN=1` on a server.** Without it the script starts the blog in the foreground of
that terminal: closing the session stops it, and a reboot does not bring it back. The service
(systemd or Docker) is what should run it.

**Native, by hand.** Bun 1.3+, its own unprivileged user, and the checkout IS the deployment:

```bash
sudo -u quire -H bash -lc 'git clone https://github.com/joiha-steven/quireink.git /home/quire/app'
sudo -u quire -H bash -lc 'cd /home/quire/app && bun install && bun run build:assets && bun run build:admin'
```

Then write the environment into `/home/quire/app/.env`, mode 600, owned by the blog's user
(`DATA_DIR`, `STORAGE_LOCAL_DIR`, `SITE_URL`): the systemd unit in `docs/self-host.md` §4
reads it with `EnvironmentFile=`, and a missing file stops the unit from starting. The unit
runs `bun --smol src/index.ts` from the checkout.

`bun run build` produces those two artefacts and nothing else. **There is no compiled
binary** ([ADR 0022](../../../docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)) — do not
go looking for one, and do not "helpfully" add a build step that emits one.

## Claiming the blog: read the log, do not open a shell

A blog nobody owns prints a one-time `/setup?token=…` link **every time it starts**:

```bash
docker logs quire | grep -A8 'no owner'      # or: journalctl -u quire | grep -A8 'no owner'
```

Hand that link to the user and stop. The rest is their browser: the language, username,
email, password, then the authenticator QR and ten recovery codes, shown once, and four short
questions about the site. **Do not paste their password anywhere, and do not attempt to enrol
two-factor on their behalf.** The token lives in memory, so a restart invalidates it — if they
lose it, restart the service and read the log again. With no `SITE_URL` the link names
`127.0.0.1`, which their browser cannot open on a remote server: the log prints an `ssh -L`
tunnel line under it, or set `SITE_URL` and restart. No log to read at all (some NAS panels)?
`SETUP_CODE` (twelve characters or more) in the environment makes `/setup` ask for it instead.

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
sudo -u quire -H bash -lc 'cd /home/quire/app && bun run upgrade'   # native: release, build, restart, verify, roll back
```

`docker-compose.yml` in this repository **builds** the image rather than pulling one, so
`docker compose pull` does nothing there — it is `--build` that upgrades it. Native installs
use `bun run upgrade`: it moves to the newest release (never `main`, never backwards), rebuilds
both artefacts, restarts, waits for `/api/health` to report the new `version`, and rolls back
if it does not. A `git pull` alone would serve the previous release's admin against the new
server, and on `main` would install unreleased work. Content lives in the
volumes and is untouched by either.

## Do not

- Do not put `DATA_DIR` or the uploads directory inside the app directory.
- Do not run the app as root, and do not `chown` its data to root to "fix" a permission
  error — set `PUID`/`PGID` instead when using bind mounts.
- Do not invent config files. Configuration is environment variables (for systemd, the one
  `.env` its unit reads) plus the admin; there is no other config file to write.
- Do not create a second owner account to solve a lost-password or lost-phone problem. The
  software refuses it by design. The way back in is the recovery codes, or the user CLI run
  at the machine (`set-password`, `reset-2fa`, `rename`, `list`), always with `DATA_DIR` set:
  [`docs/account.md`](../../../docs/account.md). Hand those commands to the owner to run;
  `set-password` reads the new password from their keyboard.
