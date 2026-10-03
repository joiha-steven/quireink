# Installing Quire Ink: every way in, on one page

> The index of every install path. The README's **Install** section asks one question — what do you
> have? — and this page is the table behind it. Decided in
> [ADR 0065](decisions/0065-every-install-runs-a-release.md): two runtimes, three packages, and every
> place to install is configuration over one of them.

## The packages

Every release is built by CI from the tag's commit into three packages, and the release matrix
(`.github/workflows/release-matrix.yml`) tries them before anything is published: S and D in a fresh
install and an upgrade from the release before, `server.sh` on a blank machine, and C under
`wrangler dev` — a fresh install, every page compared with Bun's, and a backup moved Bun → Cloudflare
→ Bun. C is also installed and upgraded on a real Cloudflare account by hand before the tag (L10,
[releases.md](conventions/releases.md)). The NAS and Kubernetes rows run D's compose file and image.

| Package | What it is | Runtime |
|:--|:--|:--|
| **S** source | the checkout at tag `vX.Y.Z` | Bun |
| **D** image | `quireink/quireink:X.Y.Z`, `amd64` and `arm64` (also `X.Y` and `latest`) | Bun |
| **C** Cloudflare | the Worker and its assets, attached to the release as `quireink-cf-X.Y.Z.tar` (what *Move to Cloudflare* and the one-key update install); the Deploy button builds the same from the `release` branch | Cloudflare ([how it differs](runtimes.md)) |

## The places

| Place | Package | The file that is it | Upgrading | Limits | Details |
|:--|:--|:--|:--|:--|:--|
| A blank Ubuntu or Debian server | D | [`server.sh`](../server.sh) | `docker compose pull && docker compose up -d` in `/opt/quireink`; a new release line: run it again | Refuses a machine that already serves anything | [self-host-docker.md](self-host-docker.md) |
| Docker or compose, with a domain | D | [`docker-compose.image.yml`](../docker-compose.image.yml) + [`Caddyfile`](../Caddyfile) | `docker compose pull && docker compose up -d` | You keep Docker | [self-host-docker.md](self-host-docker.md) |
| A NAS (Unraid, Synology, QNAP, Runtipi) | D | the compose file, or Unraid's template | The container app's Update | No Caddy: the NAS's own reverse proxy terminates TLS | [self-host-docker.md](self-host-docker.md#on-a-nas-or-a-home-server) |
| Kubernetes | D | [`deploy/kubernetes/`](../deploy/kubernetes/README.md) | Change the pinned tag | No Caddy: the ingress terminates TLS | [deploy/kubernetes/README.md](../deploy/kubernetes/README.md) |
| A DigitalOcean droplet | D | [`deploy/digitalocean/user-data.sh`](../deploy/digitalocean/user-data.sh), a shell around `server.sh` | As the blank-server row | As the blank-server row | [deploy/digitalocean/README.md](../deploy/digitalocean/README.md) |
| A server you run yourself, with Bun | S | [`install.sh`](../install.sh), then systemd and nginx | `bun run upgrade` (goes back by itself if the new release does not come up) | You keep the machine | [self-host.md](self-host.md) |
| Cloudflare (beta) | C | [`wrangler.jsonc`](../wrangler.jsonc), read by the Deploy to Cloudflare button with [`.dev.vars.example`](../.dev.vars.example) and the `cloudflare` section of `package.json`; or, from a blog already running, Settings → Server → Run on Cloudflare | Button: the copy's *Update Quire Ink* workflow, which Workers Builds deploys. Moved from a server: one key in Settings. Command line: `bun run deploy` from the newer release | Workers Paid only ($5/month); beta. The button does not check the plan | [self-host-cloudflare.md](self-host-cloudflare.md) · [runtimes.md](runtimes.md) |

## Rules that keep this table true

- A new place is configuration over one package, never code of its own (ADR 0065, rule 1).
- Each place has its file, a row here and in the README's table, and a cell in the release matrix;
  `check:install-matrix` holds the file, the README link and the cell for the blank server, source,
  the image, Kubernetes, DigitalOcean and Cloudflare, and holds every page that teaches an install to
  a row here. The NAS row has no file of its own: it is the image's compose file.
- Every environment variable the code reads is named in [environment.md](environment.md).
