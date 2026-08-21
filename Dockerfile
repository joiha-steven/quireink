# syntax=docker/dockerfile:1

# The self-host image: one Bun process, two SQLite files, one uploads directory. There is
# no database service to link, no migration step and no entrypoint script, because the app
# applies its own schema at boot and reads its whole configuration from the environment.
#
# Three decisions here are deliberate and each one exists to stop this file needing edits
# later. Read them before "simplifying" any of them away.
#
# 1. It runs FROM SOURCE (`bun src/index.ts`), not from the `bun build --compile` binary
#    that `docs/self-host.md` uses. The binary is smaller, but it is also the one thing in
#    this project that is fragile across base images: `--compile` bundles sharp's
#    JavaScript and NOT its native module (see the note in `src/media/files.ts`), so the
#    image would carry a binary pinned to one libc and a native addon that has to match it,
#    and every base bump becomes an investigation. From source, sharp stays an ordinary
#    entry in `node_modules` that `bun install` resolved for this platform. It is also
#    exactly how the live box runs (see `src/server/build-info.ts`), so the container is
#    not a second, separately-broken deployment shape.
#
# 2. Debian slim, not Alpine. sharp ships prebuilt binaries for glibc and musl separately,
#    and the musl ones are the less travelled path for no gain that survives a rebuild.
#    `tar` matters too: `src/server/backup.ts` spawns it for real, so an image without it
#    has a backup button that fails at the moment you need it. It is part of Debian's
#    essential set, which is why nothing here installs it.
#
# 3. The data directories are created and chowned IN THE IMAGE. Docker seeds a fresh named
#    volume from the image's own directory, ownership included, so `docker compose up` gives
#    the unprivileged user a writable volume on first boot with nothing else running. That
#    part is unchanged and still carries the common case.
#
#    What it never covered is a BIND mount, which keeps the host's ownership — and that is
#    the normal shape on the NAS boxes this image is meant to be easy on, because their
#    container UIs mount a real folder and their backup jobs need to see it. Measured on a
#    Linux daemon on 2026-08-21, a root-owned bind mount does not degrade, it kills the
#    container on boot with `SQLITE_CANTOPEN` and a `bun:sqlite` stack trace — a diagnosis
#    nobody should have to make from a NAS web UI. So there IS an entrypoint now
#    (`docker-entrypoint.sh`): it adopts PUID/PGID, chowns only when ownership is actually
#    wrong, and drops privileges with `setpriv` from util-linux, which Debian already has.
#    `docker run --user 1000:1000` still bypasses all of it and behaves exactly as before.
#
# 4. The PRODUCTION dependencies are their own stage, and the two installs share BuildKit's
#    cache mount. Measured on this repo: the dev tree is 186 MB and the production one 94 MB,
#    and the old shape resolved BOTH inside the build stage — so `rm -rf node_modules &&
#    bun install --production` sat AFTER `COPY src`, and every one-line edit to the app
#    re-ran a full production install that nothing about the edit had changed. Now the
#    production set depends on `package.json` and `bun.lock` alone: an upgrade that only
#    moves source code reuses it, and the two installs stream from one warm package cache
#    instead of two cold downloads.

# --- deps: what the SERVER needs, and nothing the build needed -----------------------------
#
# Its own stage rather than a prune at the end of the build, so it depends on the manifest
# and the lockfile alone. A source-only upgrade — which is most of them — reuses this layer
# whole. Installing into an EMPTY directory is still what makes it a production set:
# `bun install --production` over a dev `node_modules` that already matches the lockfile
# reports "no changes" and removes nothing, which is how the image once shipped React,
# Tiptap, Tailwind and TypeScript and weighed 535 MB.
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --production

# --- build: the dev tree, only to produce the bundles --------------------------------------
FROM oven/bun:1-slim AS build
WORKDIR /app

# Dependencies first, so an edit to `src/` does not re-resolve the whole tree.
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Neither output is committed (`.gitignore` ignores every `dist/`), so both are built here:
# the public island bundles, and the admin SPA with its stylesheet. `build:admin` needs
# React, Tiptap and the Tailwind CLI, which is the only reason this stage installs them.
RUN bun run build:assets && bun run build:admin

# --- runtime -----------------------------------------------------------------------------
FROM oven/bun:1-slim
WORKDIR /app

# HOST=0.0.0.0 is REQUIRED here and is the one place it is right by default. The app defaults
# to 127.0.0.1 (`src/env.ts`), which is correct for a native install with nginx on the same
# machine and completely wrong inside a container: loopback there is the container's own, so
# nothing outside it could ever connect and the published port would answer refused. What
# keeps that from meaning "exposed to the internet" is the PUBLISH side — compose binds
# 127.0.0.1:3000:3000 on the host, for the reasons written beside it in docker-compose.yml.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/var/lib/quire/data \
    STORAGE_LOCAL_DIR=/var/lib/quire/uploads

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY package.json bun.lock tsconfig.json ./

# See note 3 above. Both paths are ENV defaults, so overriding them in compose without
# mounting something writable there is the one way to get this wrong.
RUN mkdir -p "$DATA_DIR" "$STORAGE_LOCAL_DIR" && chown -R bun:bun /var/lib/quire

# NO `USER bun` HERE, and that is the entrypoint's whole reason for existing: a process that
# is already unprivileged cannot fix the ownership of a bind mount it cannot write to. The
# container starts as root, spends one shell script adopting PUID/PGID (1000:1000 by
# default, which is `bun` — so the default is byte-for-byte the old behaviour), and execs
# the app as that user. The app itself never runs as root, and compose keeps
# `no-new-privileges` on top of that.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

EXPOSE 3000

# The probe lives HERE rather than in `docker-compose.yml`, so `docker run` gets it too and
# there is one definition to keep true. `/api/health` checks the two things that actually
# stop this app serving — the database answers, and the upload store is writable — and it
# reports 503 rather than failing, which is the whole point of probing it.
#
# It costs a Bun start per tick, so the interval is 60s rather than 30: this app dies by
# disk or by database, not by hanging, and on a 1 GB box a second runtime every half minute
# is a real slice of a small machine. `--smol` runs that probe in the low-memory heap mode.
# curl is not in the image and does not need to be.
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD bun --smol --eval "process.exit((await fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health')).ok ? 0 : 1)"

# `bun:sqlite` is synchronous and single-threaded by design (one writer by construction),
# so this is one process and never a cluster. Scale the box, not the process count.
CMD ["bun", "src/index.ts"]
