<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.10-beta.1`

**AI-native, self-hosted publishing for one person.**

Own the server, the data and the audience. Let an MCP agent draft, publish and run the routine work. Give readers a fast, distinctive place to read — without a hosted platform in the middle.

[**Live demo**](https://demo.quireink.com) · [**Install**](#install) · [**MCP**](#publish-and-operate-over-mcp) · [**Docs**](./docs/README.md) · [**Changelog**](./CHANGELOG.md) · [**Tiếng Việt**](./README.vi.md)

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-native-7c3aed)
![License](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e)

<br/>

<img src="docs/demo.jpg" alt="Quire Ink front page and article reading experience" width="960">

</div>

## Why Quire Ink

| | |
|---|---|
| **🤖 MCP-native** | Draft, edit, tag, schedule and publish from any MCP client. Agents can also inspect analytics, moderate comments, manage the homepage and take backups — through the same rules as the admin. |
| **🔐 Yours to own** | One process, two SQLite files and your uploads on your server. No Quire Ink cloud account, hosted database or platform lock-in. |
| **⚡ Reader-first speed** | Server-rendered HTML, 3.8 KB JS on the homepage and 6.5 KB on a post. Zero third-party requests by default. |
| **✍️ Built for one publisher** | A complete browser admin for writing, media, scheduling, comments, newsletters, analytics and appearance. No team workflow to configure. |
| **📥 Bring your archive** | Import WordPress XML, Ghost JSON, and Substack or Medium ZIPs. Posts become Markdown; images move into your library; old URLs get redirects. |
| **🖍️ A reading experience with a point of view** | Book mode, carefully set typography, light/dark palettes, and a reader pen for highlights, underlines, notes and clips. |

**Made for:** one person, one server, one publication they intend to keep.

**Not made for:** teams that need roles, approvals and an editorial queue.

## The product

### Write and publish

- Markdown editor with autosave, revisions, scheduling, tables, footnotes, callouts, math, code, video and galleries
- Responsive image processing and optional AI-generated alt text
- Composed homepage, categories, tags, series, search, RSS, sitemap, `robots.txt`, `llms.txt` and per-post OG images
- Comments without reader accounts, confirmed-email newsletters, redirects, trash and activity history
- Cookie-free first-party analytics and per-post reading depth
- Eleven languages across the site and admin

### Read differently

<img src="docs/demo-reading.jpg" alt="Book mode and dark reading theme" width="960">

Quire Ink treats the reading page as the product. Typography, spacing, colour and layout are owner-controlled settings, while the reader stays small and server-rendered.

The optional reader pen lets people highlight in five inks, underline, ring words, attach notes and send passages to a notebook. Marks stay in the browser unless the reader chooses cross-device sync; the owner cannot inspect them. Notes support IndieAuth, Micropub, Webmention and `h-entry`. [How notes work](./docs/features/notes.md)

### Stay independent

The core blog runs without a Quire Ink account or a cloud service. SMTP, an S3-compatible backup target, CDN, Turnstile and AI providers are optional connections you choose. Backups can be downloaded in one click, scheduled locally and copied to your own R2/S3 bucket. [Backup details](./docs/backups.md)

## Measured reader footprint

First visit, nothing cached; measured on the live site described in the [performance notes](./docs/performance.md).

| | Homepage | Post |
|---|---:|---:|
| Total transferred | **100 KB** | **98 KB** |
| JavaScript | **3.8 KB** | **6.5 KB** |
| CSS | 11.5 KB | 11.5 KB |
| Third-party requests | **0** | **0** |

Book mode, comments and the pen load only when used. Bundle-size checks fail the build when the reader grows past its limits.

## Move an existing publication

Upload an export in the admin; Quire Ink detects the source and imports it.

| Source | Import file |
|---|---|
| WordPress | XML |
| Ghost | JSON |
| Substack | ZIP |
| Medium | ZIP |

Content is converted to Markdown, supported images are fetched into local storage, and previous URLs are recorded as redirects. The repository also includes agent skills for assisted installs, MCP operation and migrations. [Agent-ready details](./docs/agent-ready.md)

## Install

Quire Ink needs [Bun](https://bun.sh) 1.3+ or Docker, persistent storage and a reverse proxy for TLS.

### One-command source install

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

Set the public URL and install path when needed:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | SITE_URL=https://example.com QUIREINK_DIR=/srv/blog bash
```

The script clones, installs and builds without `sudo`. Run it again to update. It prints a one-time browser link to claim the blog.

### Docker

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data \
  -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest

docker logs quire
```

The same image is available from `ghcr.io/joiha-steven/quireink`. Images support `linux/amd64` and `linux/arm64`.

To build locally:

```bash
cp .env.docker.example .env   # set SITE_URL
docker compose up -d --build
docker compose logs quire
```

Guides: [VPS/source](./docs/self-host.md) · [Docker and NAS](./docs/self-host-docker.md) · [DigitalOcean](./deploy/digitalocean/README.md) · [Kubernetes](./deploy/kubernetes/README.md)

## Publish and operate over MCP

Quire Ink includes an MCP server at:

```text
https://<your-domain>/api/mcp
```

1. In **Admin → Settings → Server & connections → MCP**, enable MCP and create a token.
2. Connect an MCP client with `Authorization: Bearer <token>` or OAuth.
3. Ask the agent to draft, edit, tag, schedule or publish.

```text
Write a 600-word post titled "What I learned shipping a blog with an AI agent",
tag it "ai" and "writing", add an excerpt, and publish it.
```

Agents can also search the archive, compare traffic, count subscribers without seeing addresses, sweep comments into trash, recompose the homepage, send newsletter tests and take snapshots. Sensitive settings are not exposed over MCP, and revoking the token stops access immediately. See the [agent cookbook](./docs/agent-cookbook.md).

## Configuration

Most settings live in the admin. These are the main process-level variables:

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | `quire.db`, `analytics.db` and local backups |
| `SITE_URL` | `http://localhost:3000` | Canonical public URL for feeds, OG images and email |
| `STORAGE_LOCAL_DIR` | `./uploads` | Uploaded media |
| `HOST` | `127.0.0.1` | Listen address; use `0.0.0.0` when the container/network requires it |
| `PORT` | `3000` | Listen port |
| `MAX_UPLOAD_MB` | `64` | Maximum upload size; `0` disables the limit |
| `STORAGE_QUOTA_GB` | `5` | Upload-library quota; `0` disables the limit |
| `BACKUP_DIR` | `<DATA_DIR>/backups` | Local snapshots |
| `UPDATE_CHECK` | enabled | Set `0` to disable the daily release check |

See [`.env.docker.example`](./.env.docker.example), [self-hosting](./docs/self-host.md), [backups](./docs/backups.md) and the [update-check disclosure](./docs/update-check.md) for the remaining operational options.

## Develop

```bash
bun install
bun run build:admin
bun run dev
```

Before submitting a change:

```bash
bun run check:all
```

Start with [CONTRIBUTING.md](./CONTRIBUTING.md). Architecture and decision records are indexed in [`docs/`](./docs/README.md).

## Release status

`2.2.10-beta.1` is a pre-release. Its Docker tag is `2.2.10-beta.1`; `latest` remains the stable release. Expect beta details to move before `2.2.10`. See the [changelog](./CHANGELOG.md) for shipped changes.

## License

Quire Ink is source-available under [PolyForm Noncommercial 1.0.0](./LICENSE) plus an [additional permission](./LICENSE-EXCEPTION.md).

- Noncommercial use, modification and redistribution are allowed under the licence.
- The published, unmodified version may be run commercially, including paid hosting, under the additional permission.
- Commercial use of a modified version requires a separate licence, except for the documented private-deployment bug/security fix carve-out.
- Your posts and media remain yours.
- Versions through `v2.0.0` remain MIT licensed.

Read both licence files for the complete terms.
