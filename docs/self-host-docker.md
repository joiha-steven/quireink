# Docker, instead of systemd

> Split out of [`self-host.md`](self-host.md) on 2026-08-25, when that file reached its
> 400-line cap. `check:docs` says a file at the cap gets split rather than squeezed, and
> this was the section that could leave: it is a complete alternative to the native install
> rather than a step inside it.

The native guide's sections **1, 2, 4 and 9** are replaced by what follows. Still yours to
do from [`self-host.md`](self-host.md): **nginx** (section 5), **your account** (section 6),
**the CDN note** (section 7), **the cron ticks** (section 8), and taking a backup before an
upgrade.

There are two ways in. **Pull the published image** if you just want it running — nothing to
clone, no Bun on the host, no build step, and `linux/amd64` and `linux/arm64` both exist:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
docker exec quire bun run user create --username you --email you@example.com
```

Two registries carry it and they are the same bytes: `quireink/quireink` on Docker Hub,
which is what a NAS search box looks in, and `ghcr.io/joiha-steven/quireink`. One workflow
run builds once and copies the finished manifest to the second, so a version number cannot
mean two different images.

`:latest` is the tag to install and the one the documentation now uses everywhere: the
newest release is the one with the fixes in it, and a blog left on an old tag is a blog left
with the bugs that release fixed. Nothing moves under a running container either way, because
Docker only changes the image when you pull. The two-part tag (`:2.1`) still takes fixes
within a line for anyone who wants to step up a major version deliberately, and the
three-part one (`:2.1.4`) pins one exact release forever.

**Or build it yourself** from this repository, which is what `docker-compose.yml` does and
what you want if you have changed anything:

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

## On a NAS (Synology, QNAP, Unraid)

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
