# Self-hosting Quire Ink

One process, two SQLite files, one uploads directory, behind a reverse proxy. There is no
database server to provision, no container runtime, no migration command, and no
third-party account anywhere in the path.

Commands assume Ubuntu/Debian and `root` (or `sudo`). Adjust the paths. If you would rather
not install Bun on the host, [Docker](#10-docker-instead-of-systemd) is the same install in
two commands, and sections 5 and 7 still apply to it.

```
Internet → CDN (optional) → nginx (TLS) → 127.0.0.1:3000  quire (systemd)
                                                │
                                    DATA_DIR/quire.db + analytics.db
                                    STORAGE_LOCAL_DIR/{media,files}  → served at /uploads
```

## 1. A user and a place to put things

Run it as its own unprivileged user. The process writes to exactly two directories, and
neither of them is the code.

```bash
adduser --system --group --home /home/quire quire
mkdir -p /var/lib/quire/{data,uploads}
chown -R quire:quire /var/lib/quire
```

## 2. Get the code and build the assets

```bash
curl -fsSL https://bun.sh/install | bash        # as the quire user
git clone https://github.com/joiha-steven/quireink.git /home/quire/app
cd /home/quire/app && bun install && bun run build:assets && bun run build:admin
```

**Quire Ink runs from source: `bun src/index.ts`.** The checkout is the deployment, not a build
input. `build:assets` produces the island bundles and `build:admin` the admin SPA; both are
read from disk at runtime, so they have to exist before the service starts.

> **`bun run build` also exists and produces a single `dist/quireink` binary. Do not deploy it
> yet.** `bun build --compile` bundles sharp's JavaScript but not its
> `@img/sharp-<platform>` native module, so the binary comes up fine and then throws on the
> first image resize — an upload, a variant sweep, an OG card. How the binary should ship is
> the one open question left from the rewrite, and it is still open.

## 3. Configure

Environment only, no config file. The full list is in the
[README](../README.md#-environment-variables); the five that matter:

```ini
DATA_DIR=/var/lib/quire/data
STORAGE_LOCAL_DIR=/var/lib/quire/uploads
SITE_URL=https://example.com
MAX_UPLOAD_MB=64
STORAGE_QUOTA_GB=5
HOST=127.0.0.1
```

**`MAX_UPLOAD_MB` and `STORAGE_QUOTA_GB` are the app's own limits, and they default to 64 MB
and 5 GB whether you set them or not.** Until 2026-08-11 there were none: what refused an
oversized image was `client_max_body_size` below, so running the binary behind a tunnel, a
PaaS or nothing at all meant no limit and nothing said so. Keep the proxy's number and this
one in step — the proxy refuses first and more cheaply, this one refuses what never passes
through a proxy at all, including an image the MCP tool fetches from a URL. `0` disables
either. The admin (Settings → System → Storage) can lower them for this blog and can never
raise them, so on a server you run for somebody else these two lines are the ceiling.

**`HOST` defaults to `127.0.0.1`, and the layout below is why.** nginx proxies to
`http://127.0.0.1:<port>`, so the app never needs to be reachable from anywhere else. It used
to listen on every interface — `Bun.serve` does that when nobody says otherwise — while the
startup line printed `127.0.0.1`, so the only thing an operator would check said the opposite
of what was true, and the port was closed by a firewall rule rather than by not being open.
Set `HOST=0.0.0.0` when the proxy is on a different machine, and note that the Docker image
sets it already: inside a container, loopback is the container's own.

There is no secret to generate. 1.x needed `AUTH_SECRET`; 2.0 creates its own signing
secrets on first use and stores them in the database ([`src/auth/secret.ts`](../src/auth/secret.ts)),
because an optional secret is one an install can be left running without.

**`SITE_URL` is not optional in practice, and what happens without it is worse than this
paragraph used to say.** It claimed the app derives the origin from each request. It does not:
the admin field is asked next, and then the answer is the literal `http://localhost:3000`. So
an install with neither set serves a sitemap, a feed, every OG tag and every newsletter link
pointing at localhost — a site that is perfect for a reader and broken for every crawler and
mail client, with nothing on any page to show it.

It is not derived from the request `Host` on purpose, and that is a security choice rather
than an omission: the page cache is keyed by path alone, so one request carrying
`Host: evil.example` would render those URLs and then serve the cached copy to everyone. What
the app does instead is complain — a `[WARN]` line at boot, and the hint under
Settings → Search & URLs → Site address.

**`TRUST_PROXY=1` — only if your proxy is not on this machine or this private network.**
Rate limits and the analytics visitor hash are keyed by the reader's address, and the app
takes it from the socket, which a client cannot forge. `CF-Connecting-IP` and
`X-Forwarded-For` are believed only when the connection came from a loopback or private
address — which is the layout below, and every other layout where a proxy sits in front on
the same box. Set `TRUST_PROXY=1` when the hop in front reaches you over a public address
(a tunnel, a PaaS router, a load balancer elsewhere); without it, every reader behind it
would be counted as that one hop. Do NOT set it on an origin the internet can reach
directly: it makes the header believable again, and the header is one line of a request.

Everything else — SMTP, Turnstile, Cloudflare, the site's own name and language — is
entered in the admin and stored in the database.

## 4. systemd

```ini
# /etc/systemd/system/quire.service
[Unit]
Description=Quire Ink
After=network.target

[Service]
Type=simple
User=quire
WorkingDirectory=/home/quire/app
EnvironmentFile=/home/quire/app/.env
ExecStart=/home/quire/.bun/bin/bun src/index.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory` is load-bearing: the app resolves its bundles and static files relative
to the checkout, so the unit must start inside it. Use the absolute path to `bun` —
systemd has no login shell and will not find it on `PATH`.

```bash
systemctl daemon-reload && systemctl enable --now quire
curl -s localhost:3000/api/health
```

## 5. nginx

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    ssl_certificate     /etc/nginx/ssl/example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob: https:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" always;

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note `script-src 'self'` with **no `'unsafe-inline'`**. Quire Ink 2.0 emits no inline script
anywhere and that property is covered by a test, so the header can finally say so. Add
`https://challenges.cloudflare.com` to `script-src`, `connect-src` and `frame-src` if you
turn on Turnstile.

`client_max_body_size` has to be at least as large as the biggest file you intend to
upload. nginx rejects the request before the app ever sees it, and the error the browser
shows does not say so.

## 6. Your account

```bash
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user create --username you --email you@example.com'
```

It prints a TOTP secret and ten recovery codes **once**. TOTP is required, not optional.
Store the recovery codes somewhere that is not the machine.

⚠ Set `DATA_DIR` when running any CLI command. Without it the CLI opens `./data`, which is
a *different, empty* database, and it will cheerfully tell you there are no accounts.

## 7. Behind a CDN

The app sends `cache-control` for every response: 60 seconds plus
`stale-while-revalidate` for public HTML, `private, no-store` for the admin, sign-in and
API. **Let the CDN honour those headers.** A cache rule that forces a long TTL on HTML
turns a publish into something nobody can see, and — worse when you are debugging — hands
you a page from two deploys ago while you read source trying to work out why your fix did
nothing.

When verifying anything, request the origin directly (`curl localhost:3000/...` on the
server), not the public URL.

## 8. The cron ticks

**Nothing inside the process schedules anything.** `/api/cron` is the entry point and an
external scheduler has to call it, or scheduled posts never go live on time, image variants
are never finalized, expired sessions and `render_cache` rows accumulate, and the on-server
snapshots in [`backups.md`](backups.md) never run.

```cron
*/5 * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" 'http://127.0.0.1:3000/api/cron?publish=1' >/dev/null
17  * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" 'http://127.0.0.1:3000/api/cron' >/dev/null
```

The five-minute tick only flips due posts live; the hourly one does everything else. Set
`CRON_SECRET` in the environment — the route is **open when it is unset**, and it is the most
expensive lever in the process. It is rate-limited to 12 calls a minute regardless.

Add `&purge=1` to a one-off call after a deploy to clear the CDN.

## 9. Upgrading

```bash
cd /home/quire/app && git pull && bun install && bun run build:assets && bun run build:admin
systemctl restart quire
```

Re-run both builds, not just `git pull`: the island bundles and the admin SPA are build
outputs, and a restart that skips them serves yesterday's JavaScript against today's HTML.

Schema changes are applied at boot, inside a transaction. **Take a backup first anyway** —
see [`backups.md`](backups.md), which also covers getting a copy off the server on a schedule.

## 10. Docker, instead of systemd

Same app, same layout, nothing extra to run beside it. This replaces sections 1, 2, 4 and 9;
nginx (section 5), the CDN note (section 7) and **the cron ticks (section 8)** still apply,
and so does taking a backup before an upgrade.

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
cp .env.docker.example .env          # set SITE_URL, and that is the whole of it
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

The image builds from source and runs `bun src/index.ts`, which is what the server in section 4
runs too. It is deliberately NOT the compiled binary: `bun build --compile` does not bundle
sharp's native module, so a compiled image has to keep a binary and a native addon agreed
about libc across every base bump, and this way `bun install` resolves sharp for the
platform like any other package.

Four things worth knowing before you change anything in `docker-compose.yml`:

- **The port is published on `127.0.0.1` on purpose.** Docker writes its own iptables rules,
  so a plain `3000:3000` reaches the internet even when the host firewall says otherwise.
- **`DATA_DIR` and `STORAGE_LOCAL_DIR` are set by compose**, after `.env` and therefore
  winning over it. They are where the volumes are mounted; a `.env` that redefines them
  points the app at an unmounted directory, where the database it writes disappears with the
  container.
- **The volumes are named volumes, not bind mounts.** The container runs unprivileged, and a
  fresh named volume inherits the image's ownership, which is what makes it writable with no
  chown at startup. If you bind-mount host directories instead, create them first and give
  them to UID 1000, or the app comes up reporting degraded storage.
- **Upgrades are `git pull && docker compose up -d --build`.** The schema is applied at boot
  as usual. Your content is in the volumes and is not touched by a rebuild.

To get data out without a bind mount, use the backup button in the admin (it hands you both
databases plus every upload), or `docker compose cp quire:/var/lib/quire/data ./data`.

## Coming from Quire 1.x

**The importer is gone, on purpose.** `scripts/import-v1.ts` read a running 1.x instance
over PostgREST and wrote the whole thing into SQLite, and it was removed with the rest of
the frozen tree ([ADR 0019](decisions/0019-remove-the-frozen-tree-from-the-working-copy.md))
because it described a migration that had already happened and cannot happen again: it
needed a live 1.x instance with PostgREST in front of it, and there is no longer one to
point it at. The `bun run import-v1` script went with it.

If you are still running a 1.x instance of your own, the code that moved it is preserved at
tag `v1-final` — `git worktree add ../quire-v1 v1-final` gets you a tree you can run it
from. Nothing in the current tree will do it for you, and this section would be lying if it
implied otherwise.

Whichever route you take, one thing does not carry over: sessions. The cookie is `__Host-`
prefixed and therefore scoped to a single hostname, so you will sign in again on the new
host.
