# Docker, instead of systemd

> Split out of [`self-host.md`](self-host.md) on 2026-08-25, when that file reached its
> 400-line cap. `check:docs` says a file at the cap gets split rather than squeezed, and
> this was the section that could leave: it is a complete alternative to the native install
> rather than a step inside it.

The native guide's sections **1, 2, 4 and 9** are replaced by what follows. Still yours to
do from [`self-host.md`](self-host.md): **nginx** (section 5), **your account** (section 6 —
a link the log prints, not a shell command), **the CDN note** (section 7), **the cron ticks**
(section 8), and taking a backup before an upgrade.

There are two ways in. **Pull the published image** if you just want it running — nothing to
clone, no Bun on the host, no build step, and `linux/amd64` and `linux/arm64` both exist:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
docker logs quire            # prints the link that claims the blog
```

**That second line is the account step**, and it is a log read rather than a shell: a blog
nobody owns prints a one-time `/setup` link every time it starts, so a NAS with a log panel
and no TTY can finish the install in a browser. Section 6 of
[`self-host.md`](self-host.md#6-your-account) has the whole of it, the CLI included.

Two registries carry it and they are the same bytes: `quireink/quireink` on Docker Hub,
which is what a NAS search box looks in, and `ghcr.io/joiha-steven/quireink`. One workflow
run builds once and copies the finished manifest to the second, so a version number cannot
mean two different images.

`:latest` is the tag to install and the one the documentation now uses everywhere: the
newest release is the one with the fixes in it, and a blog left on an old tag is a blog left
with the bugs that release fixed. Nothing moves under a running container either way, because
Docker only changes the image when you pull. The two-part tag (`:2.2`) still takes fixes
within a line for anyone who wants to step up a major version deliberately, and the
three-part one (`:2.2.0`) pins one exact release forever.

**Or take HTTPS with it.** [`docker-compose.caddy.yml`](../docker-compose.caddy.yml) is the
same service with Caddy in front, which gets a certificate from Let's Encrypt and renews it
by itself: no certbot, nothing scheduled, and section 5's nginx block is not needed at all.
Point the domain at the machine first, then:

```bash
cp .env.docker.example .env       # set SITE_URL and CADDY_DOMAIN
docker compose -f docker-compose.caddy.yml up -d
docker compose -f docker-compose.caddy.yml logs quire     # the link that claims the blog
```

The [`Caddyfile`](../Caddyfile) beside it carries the same security headers the nginx block
does, including the content security policy the app is tested against. Use the plain compose
file instead when something else already terminates TLS — an existing nginx, a tunnel, a
load balancer — because two of them fighting over ports 80 and 443 is a worse problem than
the one this solves.

**Or build it yourself** from this repository, which is what `docker-compose.yml` does and
what you want if you have changed anything:

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
cp .env.docker.example .env          # set SITE_URL, and that is the whole of it
docker compose up -d --build
docker compose logs quire            # the claim link, same as above
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
- **The volumes are named volumes by default, and bind mounts now work too.** A fresh named
  volume inherits the image's ownership, which is what makes it writable with nothing else
  running. A bind mount keeps the HOST's ownership instead, and that used to be fatal rather
  than degraded: measured on 2026-08-21, a root-owned host directory killed the container on
  boot with `SQLITE_CANTOPEN` and a `bun:sqlite` stack trace. The image now starts as root,
  adopts `PUID`/`PGID` (1000:1000 by default), chowns the two directories **only when the
  ownership is actually wrong**, and drops to that user before the app starts — so the app
  itself never runs as root. `docker run --user 1000:1000` skips all of it and behaves as it
  always did.
- **Upgrades are `git pull && docker compose up -d --build`.** The schema is applied at boot
  as usual. Your content is in the volumes and is not touched by a rebuild.

To get data out without a bind mount, use the backup button in the admin (it hands you both
databases plus every upload), or `docker compose cp quire:/var/lib/quire/data ./data`.

## On a NAS or a home server

Every box below runs the same published image and none of them needs a shell. What they
share is one trap, so it comes first.

Their container UIs mount real folders rather than named volumes, because that is what their
own backup jobs can see. Point both mounts at a folder you created, and set the UID and GID
that own it — on a Synology, look under Control Panel → User & Group; 1026 and 100 are
typical for the first non-admin user:

```yaml
    environment:
      PUID: 1026
      PGID: 100
    volumes:
      - /volume1/docker/quireink/data:/var/lib/quire/data
      - /volume1/docker/quireink/uploads:/var/lib/quire/uploads
```

Nothing else changes. The first boot prints one `entrypoint: adopting …` line per directory
and later boots print none, because the check is one `stat` and the walk only happens when
the answer is wrong — a re-chown of a large uploads tree on every restart would turn a
restart into an outage.

### Unraid

**Apps → search `QuireInk`.** The template is in Community Applications, so the image, the
icon, the WebUI link and both paths arrive filled in; what you set is where the two paths
point and, if you are reaching the blog from outside, `SITE_URL`.

### Synology (DSM 7.2 and later)

Container Manager is Synology's own Docker, and it reads a compose file directly, so there
is nothing here that is Synology-shaped.

1. In **File Station**, make the folder the blog will live in — say
   `docker/quireink`, with `data` and `uploads` inside it.
2. In **Container Manager → Project**, create a project, point it at that folder, and choose
   to write a `docker-compose.yml`. Paste the compose from the top of this file, with the
   two bind mounts and the `PUID`/`PGID` above.
3. Build it, then open the project's **log**. The claim link is in there — that is the
   account step, and it is why this install needs no terminal.
4. To reach it from outside, put it behind **Control Panel → Login Portal → Advanced →
   Reverse Proxy** and set `SITE_URL` to the address you gave it. Feeds, the sitemap, share
   images and newsletter links are all built from that one value.

Older DSM has **Docker** rather than Container Manager, and no compose UI; use the
`docker run` at the top of this file over SSH instead.

### QNAP

**Container Station → Applications → Create**, and paste the same compose. The mount and
`PUID`/`PGID` advice above applies unchanged; QNAP's first non-admin user is usually
`1000:100`, which you can confirm under Control Panel → Privilege.

### Runtipi

Runtipi's official app store [stopped accepting new
applications](https://github.com/runtipi/runtipi/issues/2317), so there is no Quire Ink
entry to search for and there is not going to be one. Use **Add custom app** and give it the
compose above — the result is the same container, managed by Runtipi like any other app.

## Kubernetes

Same image, four manifests, `kubectl apply -k deploy/kubernetes`:
[`deploy/kubernetes/README.md`](../deploy/kubernetes/README.md).

Read the first section of that page before you scale anything. The workload is a
**StatefulSet with one replica** and that is a correctness requirement rather than a starting
point: the blog is one Bun process over two SQLite files, and a second pod on the same volume
is a corrupted blog that nothing warns you about. What the manifests carry beyond the compose
file is a probe, a security context that passes the `restricted` Pod Security Standard, and
the one ingress annotation without which every upload over 1 MB is rejected before it reaches
the app.
