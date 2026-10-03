# 0065 — Every install runs a release: two runtimes, three packages, places are configuration

Date: 2026-10-03
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

Quire Ink can be installed six ways: `install.sh`, systemd and nginx by hand, Docker and compose,
the DigitalOcean user-data file, a NAS (Unraid, Synology, QNAP, Runtipi) and Kubernetes. Read on
2026-10-03, with 2.2.16 current:

- **`install.sh` clones `main` and updates with `git pull --ff-only` on `main`.** An install made
  that way runs whatever was last pushed, released or not, while the Docker image only ever moves
  on a tag. Two installs that both say "2.2.16" were not running the same code.
- **Nothing tests installing or upgrading.** CI proves the code (`check:all`, the tour) and that
  the image boots. Nobody checks "install from nothing by the docs" or "upgrade from the last
  release with the data the last release wrote".
- **Upgrading from source is four commands by hand**, with no copy taken by the upgrade itself and
  no way back if the new version does not come up.
- **A newcomer chooses among six equal paths on six pages.** The one path that goes from a blank
  machine to HTTPS in one step, `deploy/digitalocean/user-data.sh`, only works on DigitalOcean.

A second runtime is coming ([0066](0066-cloudflare-is-a-second-runtime.md)). Multiply six places by
two runtimes and the matrix is too big to keep honest by hand.

## The decision

**Two runtimes, three packages, and every place to install is configuration over one package.**

| Runtime | Package (built by CI from the tag's commit) | Places |
|:--|:--|:--|
| Bun | **S** — the source at tag `vX.Y.Z` | a server you run yourself, systemd + nginx |
| Bun | **D** — the image `quireink/quireink:X.Y.Z`, amd64 + arm64 | a fresh VPS (`server.sh`), Docker, NAS, DigitalOcean, Kubernetes |
| Cloudflare | **C** — the signed Cloudflare bundle | Cloudflare |

1. **A new place is only ever a thin configuration over an existing package**: a compose file, a
   template, a manifest, a provisioning script. No application code exists for one place. Code
   that a place needs belongs to a runtime or a package and is tested like everything else.
2. **The three packages come from the same commit of the same tag, built by CI.** Nobody builds a
   package on their own machine.
3. **Every install follows releases by default, the source install included.** `install.sh`
   resolves the newest non-prerelease tag with `git ls-remote --tags` (no API, no machine of this
   project in the path) and checks it out. `QUIREINK_CHANNEL=main` is the developer's channel and
   has to be asked for. An existing checkout on `main` moves to the newest tag only when its `HEAD`
   is an ancestor of that tag, so **no install ever runs older code than it ran before**.
4. **The app knows which package it came from.** `QUIREINK_PACKAGE` is `source`, `docker` or
   `cloudflare`, set by the package, and the admin uses it to show the upgrade that actually applies.
5. **Every tag is installed and upgraded before anything is published.** For each package: a fresh
   install, and an upgrade from the previous tag on data the previous tag seeded, each followed by
   a smoke run and `restore-check`. One red cell and no package leaves.
6. **`bun run upgrade`** replaces the four manual commands: fetch the tag, install, build, restart,
   wait for `/api/health` to report the new version, and go back to the old ref if it does not.
7. **The default path for a fresh VPS is the image, through `server.sh`.** It is the only script
   here allowed to use `sudo`, and it refuses to run on a machine that already serves anything
   (a listener on 80 or 443, nginx, Apache, Caddy, another container). `install.sh` keeps its rule:
   no `sudo`, never as root.

## What it costs

- Every tag now waits for an install-and-upgrade matrix before the image is pushed. Run in
  parallel and limited to a smoke subset of the tour, not the whole of it.
- An existing source install changes channel. Rule 3 makes that a one-way move forward, and the
  release note that carries it has to say so.
- `server.sh` is a script that runs as root on someone else's machine. The blank-machine refusal is
  what keeps that defensible; it is not a convenience to be relaxed later.
