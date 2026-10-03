# Installing Quire Ink: every way in, on one page

> The index of every install path. The README's **Install** section asks one question — what do you
> have? — and this page is the table behind it. Decided in
> [ADR 0065](decisions/0065-every-install-runs-a-release.md): two runtimes, three packages, and every
> place to install is configuration over one of them.

## The packages

Every release is built by CI from the tag's commit into three packages, and each is installed and
upgraded by the release matrix before anything is published (`.github/workflows/release-matrix.yml`).

| Package | What it is | Runtime |
|:--|:--|:--|
| **S** source | the checkout at tag `vX.Y.Z` | Bun |
| **D** image | `quireink/quireink:X.Y.Z`, `amd64` and `arm64` (also `X.Y` and `latest`) | Bun |
| **C** Cloudflare | the Worker and its assets, built by `bun run build:worker` | Cloudflare ([how it differs](runtimes.md)) |

## The places

| Place | Package | The file that is it | Upgrading | Limits | Details |
|:--|:--|:--|:--|:--|:--|
| A blank Ubuntu or Debian server | D | [`server.sh`](../server.sh) | `docker compose pull && docker compose up -d` in `/opt/quireink`; a new release line: run it again | Refuses a machine that already serves anything | [self-host-docker.md](self-host-docker.md) |
| Docker or compose, with a domain | D | [`docker-compose.image.yml`](../docker-compose.image.yml) + [`Caddyfile`](../Caddyfile) | `docker compose pull && docker compose up -d` | You keep Docker | [self-host-docker.md](self-host-docker.md) |
| A NAS (Unraid, Synology, QNAP, Runtipi) | D | the compose file, or Unraid's template | The container app's Update | No Caddy: the NAS's own reverse proxy terminates TLS | [self-host-docker.md](self-host-docker.md#on-a-nas-or-a-home-server) |
| Kubernetes | D | [`deploy/kubernetes/`](../deploy/kubernetes/README.md) | Change the pinned tag | No Caddy: the ingress terminates TLS | [deploy/kubernetes/README.md](../deploy/kubernetes/README.md) |
| A DigitalOcean droplet | D | [`deploy/digitalocean/user-data.sh`](../deploy/digitalocean/user-data.sh), a shell around `server.sh` | As the blank-server row | As the blank-server row | [deploy/digitalocean/README.md](../deploy/digitalocean/README.md) |
| A server you run yourself, with Bun | S | [`install.sh`](../install.sh), then systemd and nginx | `bun run upgrade` (goes back by itself if the new release does not come up) | You keep the machine | [self-host.md](self-host.md) |
| Cloudflare (beta, from G6) | C | [`wrangler.jsonc`](../wrangler.jsonc) | Sync the fork; Workers Builds deploys | Workers Paid only ($5/month) | [runtimes.md](runtimes.md) |

## Rules that keep this table true

- A new place is configuration over one package, never code of its own (ADR 0065, rule 1).
- Each place has its file, a row here and in the README's table, and a cell in the release matrix;
  `check:install-matrix` holds all four, and holds every page that teaches an install to a row here.
- Every environment variable the code reads is named in [environment.md](environment.md).
