# Self-hosting Quire Ink

One process, two SQLite files, one uploads directory, behind a reverse proxy. There is no
database server to provision, no container runtime, no migration command, and no
third-party account anywhere in the path.

Commands assume Ubuntu/Debian and `root` (or `sudo`). Adjust the paths. If you would rather
not install Bun on the host, [Docker](#docker-instead-of-systemd) is the same install in
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

Those three lines are also one line, and it is the same three:
[`install.sh`](../install.sh) clones, installs, builds, and starts the blog so the log prints
the claim link. It refuses to run as root, never uses `sudo` and touches nothing outside the
directory you give it, which is why the rest of this guide is still yours to do: the user,
the service, the proxy.

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | QUIREINK_DIR=/home/quire/app NO_RUN=1 bash
```

The variables go in front of `bash`, not in front of `curl`: on this side of a pipe they
would belong to the download and never reach the script.

**Quire Ink runs from source: `bun src/index.ts`.** The checkout is the deployment, not a build
input. `build:assets` produces the island bundles and `build:admin` the admin SPA; both are
read from disk at runtime, so they have to exist before the service starts.

> **`bun run build` builds those two artefacts and nothing else. There is no compiled binary**
> ([ADR 0022](decisions/0022-ship-from-source-not-a-compiled-binary.md), 2026-08-11). It used to
> emit `dist/quireink`, under a note saying not to deploy it "yet"; measured, the binary does not
> come up at all, because `sharp` is reached on the boot path and the process dies before it
> listens. Copying `@img/*` next to it does not help, because `sharp` resolves from the bundle's own
> `/$bunfs/root/…` path, which has no sibling directory. Running the source IS the shipping
> story, and always was: every live instance does it.

## 3. Configure

Environment only, no config file. The full list is in the
[README](../README.md#environment-variables); the five that matter:

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
to listen on every interface, which is what `Bun.serve` does when nobody says otherwise, while
the startup line printed `127.0.0.1`, so the only thing an operator would check said the opposite
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

**`TRUST_PROXY=1`, and only if your proxy is not on this machine or this private network.**
Rate limits and the analytics visitor hash are keyed by the reader's address, and the app
takes it from the socket, which a client cannot forge. `X-Forwarded-For` is believed only
when the connection came from a loopback or private address — which is the layout below, and
every other layout where a proxy sits in front on the same box. Set `TRUST_PROXY=1` when the
hop in front reaches you over a public address (a tunnel, a PaaS router, a load balancer
elsewhere); without it, every reader behind it would be counted as that one hop. Do NOT set
it on an origin the internet can reach directly: it makes the header believable again, and
the header is one line of a request.

**The LAST hop of `X-Forwarded-For` is the one that counts,** not the first. The first is
whatever the client sent, on any proxy that appends rather than overwrites — which is what
nginx's `$proxy_add_x_forwarded_for` does and what Cloudflare does. The last is the view of
the proxy that just handed over the connection, and it is the only entry in the list there is
any reason to believe. Caddy needs none of this: it replaces the header with the peer it saw.

**`CF-Connecting-IP` is believed only once the Cloudflare zone is filled in** under
Settings → Connections. That is not a preference, it is the difference between a header that
means something and one that does not: Cloudflare overwrites it, and no other proxy touches
it. Measured on 2026-09-01 through a real Caddy in front of the app — 45 requests against a
30-per-minute cap, each carrying a different made-up `CF-Connecting-IP`, were refused **zero**
times; the same 45 without the header were refused 16. A default install has no Cloudflare, so
the default is to ignore it, and turning the integration on is what turns it back on.

**`UPDATE_CHECK=0` turns off the one request this software makes on its own** — the daily
question of what the newest release is, which is also how a blog is counted as being used
([`update-check.md`](update-check.md) says exactly what it carries). It is on without this line, and this line beats
the owner's own switch: it is here for an operator running blogs for other people.

Everything else is entered in the admin and stored in the database: SMTP, Turnstile,
Cloudflare, the site's own name and language.

## 4. systemd

```ini
# /etc/systemd/system/quire.service
[Unit]
Description=Quire Ink
After=network.target

[Service]
Type=simple
User=quire
Environment=NODE_ENV=production
WorkingDirectory=/home/quire/app
EnvironmentFile=/home/quire/app/.env
ExecStart=/home/quire/.bun/bin/bun src/index.ts
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/quire

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory` is load-bearing: the app resolves its bundles and static files relative
to the checkout, so the unit must start inside it. Use the absolute path to `bun` —
systemd has no login shell and will not find it on `PATH`.

The five sandbox lines keep a fault in the blog inside the blog. `ReadWritePaths` must name
every directory the app writes, each existing before the first start; a missing one fails on the NEXT restart.

`NODE_ENV=production` is conventional rather than load-bearing: an install without it
behaves identically, including the update check ([`update-check.md`](update-check.md)), which asks whether this looks
like somebody EDITING the software (`bun --watch`, `bun test`) rather than whether a variable
was set. That rule was inverted on 2026-08-22 for exactly this unit, because requiring the
variable would have made every from-source install silent forever while looking perfectly
healthy.

```bash
systemctl daemon-reload && systemctl enable --now quire
curl -s localhost:3000/api/health
```

## 4b. Caddy, in one command

`install.sh` leaves the blog on `127.0.0.1:3000` and stops, because it uses no sudo and
touches no service. This is the step it stops before, made out loud:

```bash
sudo bash deploy/caddy/setup.sh https://example.com
```

It installs Caddy from Caddy's own apt repository, copies the [`Caddyfile`](../Caddyfile) at
the root of this repository to `/etc/caddy/` **byte-identical** — the same file the compose
installs use, so the content security policy is the one the application is tested against —
and writes a systemd drop-in carrying `SITE_URL` and `QUIRE_UPSTREAM`. It validates the
configuration before starting anything. Caddy gets the certificate from Let's Encrypt and
renews it itself; nothing is scheduled.

It refuses rather than guesses: no address, an `http://` address, an address with no scheme,
no root, no systemd, no apt — each stops with what to do instead. The domain has to already
point at the machine before you run it, or no certificate can be issued.

Use section 5 instead when something else already terminates TLS. Two things fighting over
ports 80 and 443 is a worse problem than the one this solves.

## 5. nginx

```nginx
server {
    listen 443 ssl;
    # HTTP/2, which this block did not ask for until 2026-09-01 and therefore did not get.
    # It matters more here than it looks: a reading page fetches the sheet, the pen's two
    # sheets, two font subsets and two scripts, and under HTTP/1.1 nginx answers them down
    # six connections with a queue behind each. On its own directive rather than as
    # `listen ... http2`, which nginx deprecated in 1.25.1; on an older nginx write
    # `listen 443 ssl http2;` instead and delete this line.
    #
    # HTTP/3 is not set up here because it needs a QUIC-capable build, a second `listen` on
    # UDP and an `Alt-Svc` header to advertise itself. Caddy (§4) turns it on by itself, and
    # that is the shorter road to it.
    http2 on;
    server_name example.com;
    ssl_certificate     /etc/nginx/ssl/example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    # Only these two. `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
    # `Permissions-Policy` come from the application itself (`src/web/security-headers.ts`),
    # so repeating them here sends each one TWICE and the browser picks the last by accident
    # rather than by decision. HSTS and CSP stay with the proxy: HSTS is about the hostname
    # and its certificate, and a CSP has to name whatever you embed.
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
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

Note `script-src 'self'` with **no `'unsafe-inline'`**. Quire Ink 2.0 emits no inline script a
browser would RUN, and that property is covered by a test, so the header can finally say so.
The one inline `<script>` a public page carries is the `type="application/ld+json"`
structured-data block, and `script-src` does not govern it: CSP controls execution, and a data
block is never executed. Measured in a real browser under exactly this policy before it was
relied on. Add
`https://challenges.cloudflare.com` to `script-src`, `connect-src` and `frame-src` if you
turn on Turnstile.

`client_max_body_size` has to be at least as large as the biggest file you intend to
upload. nginx rejects the request before the app ever sees it, and the error the browser
shows does not say so.

## 6. Your account

**Read the log.** On a blog nobody owns yet, every start prints the link that claims it:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  This blog has no owner yet. Open the link below to claim it.           │
  └─────────────────────────────────────────────────────────────────────────┘

  https://example.com/setup?token=…
```

`journalctl -u quire | grep -A4 'no owner'`, or `docker logs quire` for a container. Open it
and the rest is a browser: username, email, password, then the QR code for an authenticator
and the ten recovery codes, once. **Store the recovery codes somewhere that is not the
machine.**

The token lives in memory, so a restart mints a new one and the old line stops being a
secret. Reading it proves you have the machine, which is why setup is not simply a page
anyone could find. **No log to read?** Set `SETUP_CODE` (twelve characters or more) in the
environment and `/setup` asks for it instead; a cloud-init paste can carry it.

Prefer the terminal, or automating it? The CLI still does the same job:

```bash
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user create --username you --email you@example.com'
```

It asks for a password and prints nothing else — two-factor enrolment happens in the browser
at first sign-in either way, and the admin is unreachable until it is done.

**Trying it on your own machine?** While no site address is set, the enrolment screen offers
*"Set this up later"*. Before anyone has enrolled, two-factor protects nothing: whoever
reaches that screen with the password enrols their own authenticator, so skipping on a
laptop widens nothing. Set an address and the way out disappears at the next sign-in, which
asks for enrolment again.

⚠ Set `DATA_DIR` when running any CLI command. Without it the CLI opens `./data`, which is
a *different, empty* database, and it will cheerfully tell you there are no accounts.

## 7. Behind a CDN

The app sends `cache-control` for every response: 60 seconds plus
`stale-while-revalidate` for public HTML, `private, no-store` for the admin, sign-in and
API. **Let the CDN honour those headers.** A cache rule that forces a long TTL on HTML
turns a publish into something nobody can see, and hands you a page from two deploys ago while you read source trying to work out why your fix did
nothing.

When verifying anything, request the origin directly (`curl localhost:3000/...` on the
server), not the public URL.

## 8. The ticks — nothing to do, unless you want to

**The process runs its own clock** ([ADR 0031](decisions/0031-the-blog-winds-its-own-clock.md)):
every minute it flips due scheduled posts into the caches in front of them, and hourly it
finalises image variants, purges expired sessions and unconfirmed sign-ups, prunes
`render_cache` and takes the on-server snapshot from [`backups.md`](backups.md). There is
nothing to install and nothing to remember. Skip to section 9.

What it protects you from is not "posts publish late" — a post with a future date is public
the moment its time arrives, because there is no separate `scheduled` status. It is that the
page cache has no TTL: with nothing sweeping it, the front page, the list and the feed go on
serving the version without that post in it, **while the admin shows it published**.

Two minutes after it starts, the log says so once:

```
clock: first sweep done (published 0, variants 0, sessions 3, cached rows 0)
```

That line is how you know the clock is running rather than merely un-disabled. It is printed
once per boot; the sweeps after it are silent.

**Prefer your own scheduler?** Set `CRON_INTERNAL=0` and the process starts no timers, then
call the same two ticks yourself. `/api/cron` answers only a caller holding `CRON_SECRET`:

```cron
*/5 * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" 'http://127.0.0.1:3000/api/cron?publish=1' >/dev/null
17  * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" 'http://127.0.0.1:3000/api/cron' >/dev/null
```

The five-minute tick only flips due posts live; the hourly one does everything else. Set
`CRON_SECRET` in the environment. The route is **closed when it is unset** (it answers 401),
because it is the most expensive lever in the process and the internal clock already covers
an installation that configured nothing. It is rate-limited to 12 calls a minute regardless.

Running both is harmless (every sweep is idempotent) but pointless: pick one, and if you
keep the crontab, set `CRON_INTERNAL=0` so the numbers in your logs mean what you think.

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

## Docker, instead of systemd

Same app, same layout, nothing extra to run beside it, and it replaces sections 1, 2, 4 and
9 of this guide. It has its own page: [`self-host-docker.md`](self-host-docker.md) — the
published image, `docker compose`, bind mounts and the uid/gid question, and a section on
NAS boxes. nginx, your account, the CDN note and **the cron ticks** still come from here.

## 10. What this blog tells us, and how to stop it

One request a day, and it is the only one this software makes on its own behalf. What it
carries, why each field is a step rather than a number, and the one setting that turns it off
for good: [`update-check.md`](update-check.md).

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
