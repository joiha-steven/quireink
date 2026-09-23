<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.14`

**A blog you host yourself, and an AI agent can run it for you.**
No algorithm, no ads, no platform standing between you and your readers.
One process. Two SQLite files. No cloud account anywhere in the path. Your name on it, not ours.

<br/>

![License: PolyForm Noncommercial plus paid hosting](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e) ![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)

**English** · [Tiếng Việt](./README.vi.md)

[**quireink.com**](https://quireink.com) · [**Try it**](https://demo.quireink.com) · [**Install**](#install) · [**Docs**](#where-to-go-next) · [**In full**](./docs/overview.md) · [**Changelog**](./CHANGELOG.md) · [**License**](#license)

<br/>

<img src="docs/demo.jpg" alt="A composed front page with a lead story and section rows, beside the same site's article page with a contents rail, pen marks and a mounted letter facsimile" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** is the real thing. No sign-up, nothing to fill in. The bar at the bottom jumps between the front page, the list, an article, book mode, light and dark, and the admin. That bar is the only thing added, and it lives outside the code, so the demo is always the latest build.</sub>

</div>

## What it is

A blog you write in and publish from, on a server you rent. It has the usual furniture — a front page, posts, categories, search, comments, a newsletter that goes out when you publish — and none of an algorithm deciding who sees your writing, ads across the middle of it, or a company that can change the rules next year.

Colour, type, the shape of the front page and the menu are all settings in the admin, and all of it works from a phone. Setting it up once is a technical job — ask someone who knows servers, or hand it to an AI agent. After that you write, and only an upgrade sends you back to a terminal.

**Made for** one person, one server, one blog they mean to keep. **Not made for** a team that needs roles, approvals and an editorial queue.

## Highlights

- **A real editor over Markdown**, with tables, footnotes, callouts, maths, galleries and video. It saves as you type, keeps versions, and schedules.
- **Four looks, six palettes, four reading fonts**, light and dark, and a book mode that sets a post in two columns like paper.
- **A pen for you and for your readers**: highlight in five inks, underline, ring a word — drawn by hand, never the same stroke twice.
- **Analytics without cookies**, per post and per site, and a newsletter on your own mail server.
- **Moving in and out**: WordPress, Ghost, Substack or Medium in; a ZIP of Markdown out.
- **An AI agent can run it.** A built-in MCP server lets an assistant draft, publish, read your numbers and tidy up, through the same rules the admin follows.
- **Fast on a small box.** One Bun process, two SQLite files, no database server, no cloud account in the path.
- **Eleven languages**, in the admin and on the site.

Every part, in detail and against the alternatives: [**Quire Ink, in full**](./docs/overview.md).

## Install

You need a domain and a machine you can point it at; the cheapest VPS tier is enough. On a VPS with [Bun](https://bun.sh) 1.3 or newer, one command clones, builds and starts it:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

It never uses `sudo` and refuses to run as root; running it again updates the install. Then [`deploy/caddy/setup.sh`](./deploy/caddy/setup.sh) adds the HTTPS certificate. The log prints a one-time `/setup` link: open it, and a short setup — account, authenticator, the look — ends in the editor.

**Would rather use Docker?** Pull `quireink/quireink` (`amd64` and `arm64`); with HTTPS that is [`docker-compose.image.yml`](./docker-compose.image.yml) plus the [`Caddyfile`](./Caddyfile).

It also runs on a DigitalOcean droplet from [one pasted file](./deploy/digitalocean/README.md), on a NAS (Unraid, Synology, QNAP — [step by step](./docs/self-host-docker.md#on-a-nas-or-a-home-server)) and on Kubernetes ([the manifests](./deploy/kubernetes/README.md)). By hand, with systemd and nginx: [self-hosting](./docs/self-host.md).

## Let an AI agent write for you

1. **Admin → Settings → Server & connections → MCP**, and create a token.
2. Point your agent at `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>`.
3. Ask it for a post, a Monday traffic report or a newsletter draft. [The agent cookbook](./docs/agent-cookbook.md) has prompts that do real jobs; [how MCP works here](./docs/mcp.md).

## Where to go next

| You want to | Read |
|---|---|
| Install by hand, put it behind a CDN, upgrade | [Self-hosting](./docs/self-host.md) · [Docker](./docs/self-host-docker.md) · [Environment variables](./docs/environment.md) |
| Change how the site looks, or add your own CSS | [Appearance](./docs/appearance.md) |
| Back it up and restore it | [Backups](./docs/backups.md) |
| Let an agent run it | [MCP](./docs/mcp.md) · [Cookbook](./docs/agent-cookbook.md) |
| Read it from another program | [Content API](./docs/content-api.md) |
| Translate it | [Translations](./docs/translations.md) |
| Know how it is built and why | [docs/](./docs/README.md) · [decisions](./docs/decisions/README.md) |

## Develop

```bash
bun install
bun run build:admin                 # once, and again whenever src/admin changes
bun run dev                         # http://localhost:3000
# the log prints a /setup link to claim it; or: bun run user create --username me --email me@example.com
```

Nothing is finished until `bun run check:all` passes: a typecheck, fourteen static guards and the tests, all offline, with no credentials and no services. `bun run tour` then drives every screen in a real browser and opens the backup it built. Start at [`CONTRIBUTING.md`](./CONTRIBUTING.md), which points to the house rules in [`CLAUDE.md`](./CLAUDE.md).

<details>
<summary><b>Where things live</b></summary>

| Where | What is in it |
|---|---|
| `src/` | The whole thing: Bun, Hono, SQLite. [How the pieces fit](./docs/spec/02-structure.md) |
| `docs/` | How it works and why. [`docs/README.md`](./docs/README.md) indexes it; [`docs/decisions/`](./docs/decisions/README.md) is every decision, including the ones that were reversed |
| `golden/` | The rendering contract. One byte of different output fails the build |
| `scripts/checks/` | The guards. Register a write route outside the owner-only group and the build stops, same as a hardcoded font size in the reader's stylesheet |

What is planned lives with the author's own notes rather than here, because it is one person's intentions for one blog and not a promise to anybody running the software ([ADR 0017](./docs/decisions/0017-move-state-and-instance-config-private.md)).

</details>

## License

**The code here** is [PolyForm Noncommercial 1.0.0](./LICENSE) plus [one additional permission](./LICENSE-EXCEPTION.md). Source-available, not open source. Together they come to one sentence: **run it, and charge for running it, as long as the version you run is the one published here.**

- **Noncommercial: everything.** Your own blog, a hobby project, study, research, and also charities, schools, public research bodies and government. Read it, change it, host it, fork it, pass it on.
- **Commercial: yes, unmodified.** Run it for a business or a client, sell hosting where each customer gets their own blog. Four things are asked in return: run a published release with its source unchanged, keep the notices, say your service runs Quire Ink and link back, and sell the service rather than the software. Settings, palettes, fonts and content are not source, so the look of a site is a setting here rather than a fork.
- **A modified version, used commercially, needs a separate licence.** That is the one line the project holds. Fixing a bug or a security hole in your own deployment is carved out; patch it, and tell the owner within 30 days.
- **What you write stays yours.** Your posts and images are not covered by the code licence and are not in this repository.
- **If the project ever goes quiet, it opens.** Forty-eight months without a release and the code as it then stands is also yours under the Apache License 2.0, by a grant already made today. Nobody has to be reachable for that to happen ([ADR 0050](./docs/decisions/0050-the-licence-opens-by-itself-after-48-months-without-a-release.md)).

> **Everything up to and including v2.0.0 was MIT, and stays MIT forever.** A licence change
> does not reach backwards ([ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md)).

## About this project

**Written by someone who cannot code.** Every line of Quire Ink is Claude Code's work; I have no software background. What I do have is time for it, so updates come often. Every change goes through the test suite and a browser tour of every screen before it ships, and it runs the demo and my own blog. Bugs still happen: [open an issue](https://github.com/joiha-steven/quireink/issues), because being told is how I find out.
