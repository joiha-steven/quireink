<div align="center">

# **quire**blog &nbsp;`2.0.0`

**An AI-operated personal blog platform. Self-hosted, no cloud lock-in.**
Write and publish from a clean multilingual admin — or hand the keys to an AI agent and let it write, publish, and even deploy for you.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-22c55e)

[**🌐 Live demo**](https://manhhung.me) · [**Get your own copy**](#-get-your-own-copy) · [**Speed, measured**](#-fast-and-here-are-the-numbers) · [**Let an AI run it**](#-let-an-ai-agent-write--publish-mcp) · [**How it works**](./docs/spec/02-structure.md) · [**Changelog**](./CHANGELOG.md) · [**License**](#-license)

<sub>The demo at **manhhung.me** is the author's personal blog — a live instance to see the *platform* in action, not a content showcase (ignore what it says, look at how it works).</sub>

<br/>

<img src="docs/demo.jpg" alt="A Quire post open in the reading view, the same post in the admin editor, and the blog's index on a phone" width="900">

<sub>The reading view, the editor, and the same site on a phone.</sub>

</div>

---

## ✨ What it is

A **source-available** (PolyForm Noncommercial), single-owner blog built for people who just want to **write** — and to **own the whole stack**. Free for personal, hobby, educational and nonprofit use; read it, change it, run it, share it. Commercial use needs a separate licence. No SaaS, no vendor lock-in, and as of 2.0, **no infrastructure either**: one process, two SQLite files, a directory of uploads.

A reading page ships **4.4 KB of JavaScript and no third-party requests at all** ([the rest of the numbers](#-fast-and-here-are-the-numbers)), because the public site is server-rendered HTML with a few hand-written islands and a cache that lives in the process. The whole thing is tuned around **readable typography** — the reading experience is the product — and everything is **adjustable from the admin** (palettes, type scale, menu, fonts) with **no hardcoded values** anywhere, so you make it yours without touching code.

All the writing happens in a polished `/admin` (or over MCP). No git push to publish, no CMS to wrangle.

> **2.0.0 is stable**, released 2026-07-30 and running the demo above. It followed a full audit of design, performance and correctness done by *measuring the running site* rather than reading the source — the findings, and everything that changed since 1.x, are in the [changelog](./CHANGELOG.md).

| Area | What you get |
|:---|:---|
| 🖋️&nbsp;**Editor** | TipTap 3 + Markdown · sticky one-row toolbar · optional typewriter caret + key feedback · drag-drop / paste image upload (JPG · PNG · WebP · AVIF · GIF · SVG) with responsive `sharp` variants · captioned figures (left/center/right, column / large / full-bleed / gallery grid) · tables · video · Spotify · Apple Music embeds · footnotes (`[^1]`) · callouts (`> [!NOTE]`) · copy-code button · 3-version time machine · offline local autosave · one-click draft preview · scheduled publishing |
| 🎨&nbsp;**Look** | a calm, editorial admin · 6 customizable light+dark palettes (+ an accent) · one tunable type system (per-role size/leading/tracking, no hardcoded sizes) · four built-in reading fonts (or upload a custom font per weight), scoped to reading text |
| 🌍&nbsp;**i18n** | Admin + site in `en · vi · de · ja · zh · ko` |
| 🔍&nbsp;**Reading** | instant search over SQLite FTS · a left sidebar rail (categories + tags, or a post's ToC) · related posts · reading time · progress bar · full-bleed images on mobile · **book reading mode** — an opt-in fullscreen two-column "book" reader (paper + grain, drop cap, shareable `#read` link) |
| 📈&nbsp;**Built-in** | cookieless analytics (views / visitors / top pages, no PII) with engagement, audience & traffic-source drill-downs · activity log · soft-delete Trash (nothing auto-purges) · in-app Help / Guide |
| 🔎&nbsp;**SEO** | sitemap · RSS · `robots.txt` · `llms.txt` · dynamic OG images · 301/302 redirects (auto-301 on slug rename) · per-post SEO title/description · cover image · real last-modified date — all toggleable |
| 📚&nbsp;**Series** | group posts into an ordered series · a series box on each part · `/series/[slug]` listing · admin **Series manager** |
| 💾&nbsp;**Backups** | one-click download of the whole install (both databases + every upload) · plus an off-box cron script — [`docs/backups.md`](./docs/backups.md) |
| 📥&nbsp;**Import** | one-click **WordPress import** from the admin — upload your WXR export, posts + pages land as Markdown |
| 🤖&nbsp;**MCP** | a remote endpoint that lets an AI agent write & manage the blog with the same rules as the admin |
| 📬&nbsp;**Newsletter** | own-SMTP sign-up (double opt-in) · unsubscribe · subscriber admin · broadcast new posts on publish · comment-reply notifications — Nodemailer, no lock-in |
| 📱&nbsp;**PWA** | installable, launches standalone |
| 🔐&nbsp;**Auth** | your own username + password (argon2id) · **TOTP required** · 10 single-use recovery codes · host-scoped `__Host-` session cookie · no third-party identity provider in the login path |
| 🚀&nbsp;**Deploy** | **one process** behind any reverse proxy — `bun src/index.ts`, or Docker if you prefer. No database server, no sidecar, no cloud account |

> Built on **Bun** + **Hono**, content in **SQLite**, binaries on the **local filesystem**. The admin is a React 19 SPA; the public site ships **no framework at all** — server-rendered HTML plus a few small islands.

**Who it's for** — one person who wants a fast, good-looking, **fully self-owned** blog on their own server, and likes the idea of letting an AI agent help run it.
**Not for** — multi-author teams needing roles and editorial workflows. Quire is single-owner by design.

<div align="center">

<img src="docs/demo-reading.jpg" alt="A post in book mode, laid out in two columns on paper with a drop cap, beside the same post in the dark theme" width="900">

<sub>**Book mode** — an opt-in, fullscreen two-column reader — and the dark theme. Both are the reading typography, not a filter laid over it.</sub>

</div>

---

## ⚡ Fast, and here are the numbers

Not adjectives. Recorded from the network on a **cold load of the live site**, which is what a first-time reader on a phone actually pays:

| | Home | A post | |
|:---|---:|---:|:---|
| **Requests** | 11 | 12 | |
| **Total&nbsp;transferred** | **139 KB** | **140 KB** | of which 86 KB is the reading fonts |
| **JavaScript** | **4.4 KB** | **9.7 KB** | hand-written islands, no framework |
| **CSS** | 7.6 KB | 7.6 KB | one hashed, minified, immutable sheet |
| **Third-party&nbsp;requests** | **0** | **0** | no CDN script, no font host, no tracker |
| **Repeat&nbsp;visit** | ~23 KB | ~23 KB | everything but the HTML is cached for a year |

- **Every bundle has a byte budget the build enforces.** A feature that overruns it fails the build instead of quietly costing every reader forever.
- **The page cache is one `Map`, cleared entirely on any write** — so the invalidation rule is one line and cannot rot. A miss is a sub-millisecond SQLite read plus a render.
- **Markdown and syntax highlighting are content-addressed in SQLite**: the input *is* the key, so there is nothing to invalidate. Long-post rendering went from 383 ms to 1 ms.
- **Fonts are self-hosted and subset per language**, preloaded only for the language you're serving. Pinning the `opsz` axis took this site's preload set from 97.6 KB to **46.2 KB**.
- **Scroll-driven CSS** does the reveal and the reading progress bar — no script, off the main thread, and it degrades to "visible" rather than blank.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="The blog index, a post, and the sidebar drawer, all on a phone" width="900">

<sub>None of that is for a benchmark. It is for the reader on a four-year-old phone who wanted four hundred words.</sub>

</div>

---

## 🤔 Why this, and not the obvious alternatives

| | |
|:---|:---|
| **vs.&nbsp;a&nbsp;hosted&nbsp;platform** | Your writing lives in two SQLite files on your disk. No account, no plan, no export button to hope still works. The source is yours to read and change, so nobody can take it away |
| **vs.&nbsp;WordPress** | No PHP, no MySQL, no plugin surface to patch. One process and one binary. The whole reader path ships 4 KB of JavaScript |
| **vs.&nbsp;a&nbsp;static&nbsp;site&nbsp;generator** | You get an actual admin: write, upload, schedule and publish from the browser or your phone, with search, comments, a newsletter and analytics built in. No rebuild, no deploy, no git push to publish a typo fix |
| **vs.&nbsp;rolling&nbsp;your&nbsp;own** | The unglamorous parts are done and tested: TOTP auth, sessions, image variants, feeds, OG images, redirects, soft-delete, revisions, backups, WordPress import, i18n in six languages |

**And the part that is genuinely unusual:** Quire ships a remote **MCP** server, so an AI agent can write and publish to your live site through the same rules the admin uses — and the whole project is built to be *operated* by one. Every rule that matters is a check the build enforces, not a convention someone has to remember.

<div align="center">

<img src="docs/demo-admin.jpg" alt="The Quire admin dashboard, and the appearance settings showing six colour palettes and four reading fonts" width="900">

<sub>Palettes, reading fonts, type scale, layout, menu — settings, not code. There are **no hardcoded sizes or colours** in the reader's stylesheet, and a build check fails if one appears.</sub>

</div>

---

## 🚀 Get your own copy

**You need:** [Bun](https://bun.sh) 1.3 or newer, and a machine you can point a domain at. That is the whole list — no database server, no Node, no Docker unless you want it.

```bash
git clone https://github.com/joiha-steven/quire-blog.git && cd quire-blog
bun install
bun run build:assets                # bundles the islands + the admin
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Then point a reverse proxy with TLS at the port (default `3000`) and create your account:

```bash
bun run user create --username <name> --email <address>   # prints the TOTP secret + recovery codes, once
```

That is the whole install. There is no database to provision, no migration step to run
(the schema is applied at boot, inside a transaction), and no third-party account to
create. Full walkthrough — systemd unit, nginx, cache headers, backups, upgrades — in
**[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> `bun run build` also produces a single compiled executable at `dist/quire`, and it is
> genuinely one file — but `bun build --compile` does not bundle `sharp`'s native module, so
> that binary throws the first time it resizes an image. Until that is solved, **run from
> source**, which is what the live site does. Same command either way, and nothing else about
> the deployment changes.

<details>
<summary><b>🐳 &nbsp;Prefer Docker?</b> &nbsp;— same install, two commands, nothing to link it to</summary>

<br/>

```bash
cp .env.docker.example .env          # set SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

One service, two named volumes, no sidecar. The port is published on `127.0.0.1` so a reverse proxy still terminates TLS. Notes on volumes, ownership and upgrades: [`docs/self-host.md`](./docs/self-host.md#9-docker-instead-of-systemd).

</details>

<details>
<summary><b>🤖 &nbsp;Hand it to an AI agent</b> &nbsp;— Claude, OpenAI Codex, …</summary>

<br/>

Give an agent **SSH to your server** (and GitHub access), then ask it to deploy: clone the repo, build the binary, write the systemd unit and the nginx vhost, create your account, and return the live URL. There is no OAuth client to register and no managed service to sign up for, so it can genuinely do the whole thing end to end.

</details>

> [!TIP]
> Large uploads have **no size cap** on a self-host — the browser posts straight to the server. Put **Cloudflare (or any CDN)** in front for global edge caching + TLS; the app sends its own `cache-control`, so let the CDN honour it rather than forcing a TTL.

---

## 🤖 Let an AI agent write & publish (MCP)

Quire ships a remote **MCP** server, so a second AI agent can run your blog — drafting, editing, tagging, and **publishing straight to the live site**. No git, no deploy: content goes through the same data layer, and the same slug / revision / soft-delete rules, that the admin uses.

1. **Turn it on** — *Admin → Settings → Advanced → MCP*, generate a named token (shown **once**, hashed at rest, expires in 180 days).
2. **Connect your agent** to `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>` (OAuth connectors are supported too).
3. **Prompt it**, e.g.:

```text
Using the Quire MCP server, write a 600-word post titled
"What I learned shipping a blog with an AI agent", give it the tags
"ai" and "writing", set a friendly excerpt, and publish it.
```

The post is live in seconds. Sensitive settings are blocked over MCP, and you stay the sole authority — revoke any token from the admin and it's gone.

---

## 🔑 Environment variables

Everything else is configured **in the admin**, not in the environment.

| Variable | Required | What it is |
|---|:---:|---|
| `DATA_DIR` | ✅ | Directory holding `quire.db` + `analytics.db`. Defaults to `./data` |
| `SITE_URL` | ✅ | Canonical public URL — feeds, OG images, emails. Empty means "derive per request", which is wrong behind a proxy |
| `STORAGE_LOCAL_DIR` | ◻️ | Where uploads live (`media/`, `files/`), served at `/uploads`. Defaults to `./uploads` |
| `PORT` | ◻️ | Defaults to `3000` |
| `CRON_SECRET` | ◻️ | Protects `/api/cron` (scheduled publishing sweep, variant sweep) |
| `MCP_OAUTH_SECRET` | ◻️ | Signs MCP OAuth codes. Falls back to a secret the server generates for itself, which is the recommended setting |
| `ANALYTICS_TZ` | ◻️ | IANA zone the analytics day boundary uses. Defaults to UTC |

SMTP, Turnstile and Cloudflare credentials are entered in **Admin → Settings → Integrations** and stored server-side. Your content lives in `DATA_DIR` + the uploads directory, never in git.

---

## 🧑‍💻 Run locally (dev)

```bash
git clone https://github.com/joiha-steven/quire-blog.git && cd quire-blog
bun install
bun run dev                         # http://localhost:3000
bun run user create --username me --email me@example.com   # then sign in at /login
```

`bun run check:all` must pass before any change is done — typecheck, the static guards, and
the test suite; offline, no credentials, no services. Start at
[`CONTRIBUTING.md`](./CONTRIBUTING.md), which routes to the house rules in
[`CLAUDE.md`](./CLAUDE.md).

---

## 🗂️ What's in this repository

| Path | |
|---|---|
| `src/` | The live implementation: Bun + Hono + SQLite |
| `docs/` | How it works, and why. [`docs/spec/`](./docs/spec/README.md) is the build plan, [`docs/decisions/`](./docs/decisions/README.md) the decision record — including the ones that were reversed, and why |
| `state/` | Where things stand now: roadmap, tasks, worklog, audits |
| `golden/` | The rendering contract: fixtures plus 1.x's output for each. One differing byte fails the build |
| `scripts/checks/` | The six guards `bun run check:all` runs. A write route registered outside the owner-gated group fails the build, and so does a hardcoded font size in the reader's stylesheet |
| `v1/` | **Quire 1.5.0**, the Next.js + PostgreSQL implementation this replaced on 2026-07-28 and shut down on 2026-07-31. Retired and unsupported, kept as a readable record of the old behaviour |

---

## 🗺️ Roadmap

See [`state/ROADMAP.md`](./state/ROADMAP.md).

---

## 📄 License

Two separate layers — keep them distinct:

- **Code (this repo) — [PolyForm Noncommercial 1.0.0](./LICENSE).** Source-available, not open source. **Free for any noncommercial purpose**, and that is meant broadly: personal blogs, hobby projects, study and research, plus charities, schools, public research bodies and government. You may read it, modify it, self-host it, fork it and redistribute it. Keep the licence text and the `Required Notice:` line with any copy you pass on.
- **Commercial use needs a separate licence.** Running Quire for a business, or selling it or hosting of it, is not covered. Ask and it is usually cheap or free: open an issue, or contact the owner through [their GitHub profile](https://github.com/joiha-steven).
- **Content — © all rights reserved.** The writing published *with* Quire (articles, images on an operator's site, e.g. manhhung.me) belongs to its author, is **not** covered by the code licence, does not live in this repo, and may not be reused without permission.

> In short: the **software** is free for anyone not making money with it; the **author's writing** is not free at all.
>
> **Everything published up to and including v2.0.0 was MIT, and stays MIT forever.** A licence change is not retroactive: any copy taken before this one keeps the rights it was given. The new terms apply from this commit onward. See [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
