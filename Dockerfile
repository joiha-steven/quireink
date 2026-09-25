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

# What the SERVER never opens, deleted in the layer that produced it. Measured on this repo:
# 95 MB of production dependencies becomes 67 MB, which is 28 MB off the image and off every
# pull of it.
#
# Each of these is dead at runtime for a specific reason, not because it looked like clutter:
# `.map` files are read by a debugger attaching to the process and by nothing else; `.d.ts`
# declarations are consumed by `tsc`, which does not run here (Bun transpiles and does not
# typecheck); the prose is prose. Nothing is deleted for being a test fixture or an example,
# because a package is allowed to read its own files at runtime and there is no way to know
# from the outside which ones do.
#
# PROVED BY RUNNING IT, not by reasoning: the app was booted against a tree pruned exactly
# this way and exercised where these files would be missed — a post with two highlighted code
# blocks rendered (shiki resolves its grammars from `node_modules` at runtime), an image
# variant was served (sharp's native module), the admin answered 200, and the log carried no
# resolution error. The reasoning above is why it is safe; that run is why we know.
#
# THE LICENCES ARE NOT PROSE, and `-iname '*.md'` does not know the difference. Eight packages
# in the production tree carry their copyright notice ONLY as `LICENSE.md` — jose, qs, ms,
# express-rate-limit, @img/colour, @shikijs/vscode-textmate, css-to-react-native,
# json-schema-typed — and MIT, BSD-2 and BSD-3 all require that notice to travel with every
# copy. This image IS a copy, published to two public registries, so deleting them is not a
# size decision anybody gets to make. Keeping every licence file in the tree costs 172 KB
# against the 28 MB above; the eight that would otherwise vanish cost far less than that.
RUN find node_modules -type f \( \
      -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \
      -o -iname 'README*' -o -iname 'CHANGELOG*' -o -iname '*.md' \
    \) \
    ! -iname 'LICENSE*' ! -iname 'LICENCE*' ! -iname 'COPYING*' ! -iname 'NOTICE*' \
    -delete

# The MUSL half of sharp, which this image can never load.
#
# Decision 2 above chose Debian over Alpine because of exactly this split — and then shipped
# both halves anyway. `bun install` resolves sharp's platform packages as optionals and takes
# every libc variant for the architecture, so a glibc image carries
# `@img/sharp-libvips-linuxmusl-*` (18 MB) and `@img/sharp-linuxmusl-*` (1 MB) that the
# dynamic linker could not load if it tried: a `.node` built against musl does not open on
# glibc. Not a size trade-off, then — dead files, 19 MB of them, on every pull.
#
# sharp finds its binary by attempting each candidate and catching the failure, so an absent
# package takes the same path an incompatible one would. PROVED by uploading a real image
# through `/api/media/upload` in this image with these directories gone, and reading back the
# variants sharp produced from it.
RUN rm -rf node_modules/@img/sharp-libvips-linuxmusl-* node_modules/@img/sharp-linuxmusl-*

# --- build: the dev tree, only to produce the bundles --------------------------------------
FROM oven/bun:1-slim AS build
WORKDIR /app

# Dependencies first, so an edit to `src/` does not re-resolve the whole tree.
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY locales ./locales
COPY scripts ./scripts

# Neither output is committed (`.gitignore` ignores every `dist/`), so both are built here:
# the reader's island bundles, and the admin's own with its stylesheet. Both are Bun's bundler
# over this repository's TypeScript and nothing else — React, Tiptap and the Tailwind CLI were
# what this stage used to install for, and all three left in September 2026.
RUN bun run build:assets && bun run build:admin

# WHAT THE SERVER OPENS, and nothing that only the BUILD opened. The runtime stage copies
# `src` whole, so until now it copied the workshop with it. Measured inside the published
# image on 2026-09-20: `src` is 10.9 MB, of which 291 test files are 2.5 MB, the admin's
# browser half is 1.6 MB of TypeScript already bundled into `src/admin/dist`, and the
# reader's islands are 316 KB already bundled into `src/assets/dist`.
#
# None of it is reachable at runtime, and that is three separate facts rather than an
# impression: no file outside those two trees imports `@/admin/...` or `@/assets/js/...`,
# `web/admin/spa.ts` serves `admin/dist`, and `web/assets.ts` imports `assets/dist/*.js` as
# text. `src/admin/admin.css` and `utilities.css` go the same way: `build-admin.ts`
# concatenates them INTO `dist/admin.css`, which is the one the fingerprinted route reads.
#
# Deleted HERE rather than in the runtime stage, because a delete in a later layer does not
# take the bytes out of an earlier one. The COPY below has to never carry them at all.
RUN find src -name '*.test.ts' -delete \
 && find src/admin -mindepth 1 -maxdepth 1 ! -name dist -exec rm -rf {} + \
 && rm -rf src/assets/js

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
COPY --from=build /app/locales ./locales
# THE SCRIPTS A RUNNING BLOG USES, not the whole directory.
#
# `COPY --from=build /app/scripts` shipped 4.1 MB of workshop to every install: 3.2 MB of
# public-domain paintings that only the demo seeder reads, the twelve static guards, the 211
# tour flows, the screenshot drivers. Measured 2026-09-16; the published image is 87 MB
# compressed, and JPEGs do not compress twice, so the paintings alone were about 4% of what
# every person pulls. Nothing in `src/` reads any of it and the entrypoint never seeds.
#
# What stays is what the docs tell an operator to run: the backup and uptime scripts
# (`docs/self-host.md`), the owner-account CLI (`bun run user`), the pen sheet, and — since
# 2.2.14 — `backup-decrypt.ts`, which is the one that has to be here on the worst day. ADR 0035
# keeps the restore a shell act on a STOPPED service, so a tool for opening a sealed archive
# that only existed in a git checkout would be a tool nobody has when they need it.
# The BUILD stage still gets the whole directory, because that is where `build:assets` and
# `build:admin` live.
#
# `ops/` is named file by file rather than copied whole, because two of its six are
# workshop too: `tour.sh` and `shoot-readme.sh` drive a browser and call `seed-showcase.ts`
# and `tour.ts`, none of which is in the image. Shipping a script that cannot run is how an
# operator ends up reporting a bug against a tool nobody meant them to have.
COPY --from=build /app/scripts/ops/quire-backup.sh /app/scripts/ops/quire-uptime.sh ./scripts/ops/
COPY --from=build /app/scripts/user.ts /app/scripts/pen-sheet.ts /app/scripts/backup-decrypt.ts ./scripts/
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

# WHAT THIS IMAGE IS, in the fields every tool reads.
#
# The base image sets nine of these and until 2026-09-20 this one inherited all nine, so a
# published Quire Ink container described itself as title `bun`, version `1.4.2-slim`, source
# `https://github.com/oven-sh/bun`, licence NOASSERTION, and a build date belonging to
# somebody else's build. Read off the published 2.2.12 manifest, both architectures.
#
# Not cosmetic for the audience this image is for. `image.source` is the field a registry
# reads to link a package to its repository, so the GHCR page for this image pointed at Bun's;
# and Watchtower, Diun and a NAS container UI read these same labels to tell an owner what
# they are running and whether it has moved. An upgrade notifier comparing `image.version`
# was comparing Bun's.
#
# `image.version` is now one of the places the release checklist names, and `check:docs`
# holds it to `package.json`. `revision` and `created` are facts about one build rather than
# about the source, so they arrive as build arguments; a local `docker compose up --build`
# leaves them empty, which is honest, where inheriting was not.
ARG SOURCE_COMMIT=""
ARG BUILD_DATE=""
LABEL org.opencontainers.image.title="Quire Ink" \
      org.opencontainers.image.description="A self-hosted blog: one Bun process, two SQLite files, no build step." \
      org.opencontainers.image.version="2.2.15" \
      org.opencontainers.image.url="https://quireink.com" \
      org.opencontainers.image.source="https://github.com/joiha-steven/quireink" \
      org.opencontainers.image.documentation="https://github.com/joiha-steven/quireink#readme" \
      org.opencontainers.image.licenses="PolyForm-Noncommercial-1.0.0" \
      org.opencontainers.image.vendor="Quire Ink" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# How the official MCP registry proves this image is ours: the value must match `name` in
# `server.json`, and the registry reads it off the published manifest. It is a label and
# nothing reads it at runtime, so it costs a layer of metadata and no bytes that run.
LABEL io.modelcontextprotocol.server.name="com.quireink/blog"

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
#
# `--smol` IS NOT A CONCESSION, IT IS FASTER, and this container is the reason it has to be
# here rather than left to the operator: JavaScriptCore sizes its heap from the MACHINE's
# memory and cannot see a cgroup limit, so inside `--memory=128m` on an 8 GB host it believes
# it has 8 GB and lets garbage pile up until the limit stops it. Measured 2026-09-21 on the
# demo fixture, 33 posts and 18 images, `--memory=128m --cpus=0.25`:
#
#   default   121.5 MB of 128, pinned at 100% of its CPU, the boot warm STILL UNFINISHED
#             after twenty minutes, and the home page taking 16.5 seconds
#   --smol     55.1 MB, 0.05% CPU, the warm done in 379 ms, the home page in 5 ms
#
# The failure is worse than a crash: it is never OOM-killed, so nothing restarts it and the
# site is down while the container reports healthy. The same fixture given 512 MB and the same
# quarter CPU warms in 1.6 seconds, which is what says the work was never the problem.
#
# And it costs nothing where there is room. 3,000 requests at 32 concurrent, 2 GB and 2 CPUs:
# 4,995 and 5,115 req/s by default against 5,962 and 6,234 with `--smol`, p50 5.4 ms against
# 4.3 ms. A compact heap collects less and fits in cache; the flag is 20% FASTER here.
#
# Nothing reads it: `clockBlockedBy` and the update check scan `process.execArgv` for
# `--watch` and `--hot` only, so the clock still winds (ADR 0031).
CMD ["bun", "--smol", "src/index.ts"]
