<div align="center">

# quire**INK** &nbsp;`2.0.0`

**A self-hosted blog platform an AI agent can run for you.**
One process, two SQLite files, no cloud account anywhere in the path.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-22c55e)

**English** · [Tiếng Việt](./README.vi.md)

[**Live demo**](https://demo.quireink.com) · [**Install**](#install) · [**The numbers**](#fast-and-here-are-the-numbers) · [**Let an agent run it**](#let-an-ai-agent-write-and-publish-mcp) · [**How it works**](./docs/spec/02-structure.md) · [**Changelog**](./CHANGELOG.md) · [**License**](#license)

<br/>

<img src="docs/demo.jpg" alt="Two screenshots side by side: a composed front page with a lead story and section rows, and the same site's article page with a contents rail and a meta column" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** runs this build, reset monthly, with no sign-in and nothing to fill in. A bar along the bottom switches between the front page, the list, an article, book mode, both palettes and the admin. That bar is not part of the product: the demo runs the code below unmodified, so it is always the latest build and there is no preview branch to keep in step.</sub>

</div>

---

## What it is

A blog for **one person who wants to write and to own the whole stack**. No SaaS, no vendor
lock-in, and since 2.0 no infrastructure either: `bun src/index.ts` behind a reverse proxy,
and the install is done. No database server, no migration step, no container runtime.

Three things make it different from the obvious alternatives:

- **The reading page is the product.** Typography, palettes, type scale, layout and fonts are
  all settings. There are no hardcoded sizes or colours in the reader's stylesheet, and a
  build check fails if one appears.
- **A reader downloads 4.4 KB of JavaScript and zero third-party requests.** The public site
  is server-rendered HTML with a few hand-written islands. React never reaches a reader.
- **An AI agent can run it.** A remote MCP endpoint lets an assistant draft, tag, schedule and
  publish to the live site through the same rules the admin uses.

**Source-available**, under [PolyForm Noncommercial](./LICENSE): free for personal, hobby,
educational and nonprofit use. Read it, change it, run it, fork it. Commercial use needs a
separate licence, and it is usually cheap or free, so ask.

> **2.0.0 is stable**, released 2026-07-30, running the demo above and the author's own blog
> at [manhhung.me](https://manhhung.me). It followed a full
> audit of design, performance and correctness done by measuring the running site rather than
> reading the source. Everything that changed is in the [changelog](./CHANGELOG.md).

| Area | What you get |
|:---|:---|
| 🖋️&nbsp;**Editor** | TipTap 3 + Markdown · sticky one-row toolbar · drag-drop / paste image upload (JPG · PNG · WebP · AVIF · GIF · SVG) with responsive `sharp` variants · captioned figures (column / large / full-bleed / gallery) · tables · video · Spotify and Apple Music embeds · footnotes · callouts · 3-version time machine · offline autosave · draft preview · scheduled publishing |
| 🏠&nbsp;**Homepage** | the post list, a page of your own, or a **composed front page**: a lead story, featured picks, per-category rows and most-viewed, tuned for a site with pictures or one without ([`docs/homepage.md`](./docs/homepage.md)) |
| 🎨&nbsp;**Look** | 6 light+dark palettes · one tunable type system (per-role size, leading, tracking) · four reading fonts, or upload your own per weight |
| 🔍&nbsp;**Reading** | instant search over SQLite FTS · a sidebar rail of categories and tags, or a post's contents · related posts · reading time · progress bar · **book mode**, an opt-in two-column reader on paper with a drop cap |
| 📈&nbsp;**Built-in** | cookieless analytics with engagement, audience and traffic-source drill-downs · activity log · soft-delete trash · in-app help |
| 🔎&nbsp;**SEO** | sitemap · RSS · `robots.txt` · `llms.txt` · dynamic OG images · redirects, with an auto-301 on slug rename · per-post SEO fields, all toggleable |
| 📬&nbsp;**Newsletter** | own-SMTP sign-up with double opt-in · broadcast on publish · comment-reply notifications. Nodemailer, no lock-in |
| 📚&nbsp;**Series** | ordered multi-part posts, a series box on each part, and a series manager |
| 💾&nbsp;**Backups** | one-click download of the whole install, plus an off-box cron script ([`docs/backups.md`](./docs/backups.md)) |
| 📥&nbsp;**Import** | upload a WordPress WXR export and your posts and pages land as Markdown |
| 🌍&nbsp;**i18n** | admin and site in `en · vi · de · ja · zh · ko` |
| 🔐&nbsp;**Auth** | your own username and password (argon2id) · **TOTP required** · 10 single-use recovery codes · host-scoped session cookie · no third-party identity provider in the login path |
| 📱&nbsp;**PWA** | installable, launches standalone |

**Who it is for:** one person, one server, one blog they intend to keep.
**Not for:** multi-author teams needing roles and editorial workflow. Quire Ink is single-owner by design.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Book mode, a fullscreen two-column reader on paper with a drop cap and a page count, beside an article in the dark theme" width="960">

<sub>Book mode and the dark theme. Both are the reading typography itself, not a filter laid over it. The bundled fonts are subset for latin, latin-ext and vietnamese, so the specimen on the left is set in the reading face rather than falling back.</sub>

</div>

---

## Fast, and here are the numbers

Recorded from the network on a cold load of the live site, which is what a first-time reader
on a phone actually pays:

| | Home | A post | |
|:---|---:|---:|:---|
| **Requests** | 11 | 12 | |
| **Total&nbsp;transferred** | **139 KB** | **140 KB** | of which 86 KB is the reading fonts |
| **JavaScript** | **4.4 KB** | **9.7 KB** | hand-written islands, no framework |
| **CSS** | 7.6 KB | 7.6 KB | one hashed, minified, immutable sheet |
| **Third-party&nbsp;requests** | **0** | **0** | no CDN script, no font host, no tracker |
| **Repeat&nbsp;visit** | ~23 KB | ~23 KB | everything but the HTML is cached for a year |

- **Every bundle has a byte budget the build enforces.** A feature that overruns it fails the
  build instead of quietly costing every reader forever.
- **The page cache is one `Map`, cleared entirely on any write**, so the invalidation rule is
  one line and cannot rot. A miss is a sub-millisecond SQLite read plus a render.
- **Markdown and highlighting are content-addressed in SQLite:** the input is the key, so
  there is nothing to invalidate. Long-post rendering went from 383 ms to 1 ms.
- **Fonts are self-hosted and subset per language**, preloaded only for the language being
  served. Pinning the `opsz` axis took the preload set from 97.6 KB to 46.2 KB.
- **Scroll-driven CSS** does the reveal and the progress bar: no script, off the main thread,
  and it degrades to "visible" rather than blank.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Three phone screens: the post list, an article, and the instant search overlay showing seven matching titles" width="960">

<sub>None of that is for a benchmark. It is for the reader on a four-year-old phone who wanted four hundred words.</sub>

</div>

---

## Why this, and not the obvious alternatives

| | |
|:---|:---|
| **vs.&nbsp;a&nbsp;hosted&nbsp;platform** | Your writing lives in two SQLite files on your disk. No account, no plan, no export button to hope still works |
| **vs.&nbsp;WordPress** | No PHP, no MySQL, no plugin surface to patch. One process and one binary, and the reader path ships 4 KB of JavaScript |
| **vs.&nbsp;a&nbsp;static&nbsp;site&nbsp;generator** | You get a real admin: write, upload, schedule and publish from a browser or a phone, with search, comments, a newsletter and analytics built in. No rebuild, no deploy, no git push to fix a typo |
| **vs.&nbsp;rolling&nbsp;your&nbsp;own** | The unglamorous parts are done and tested: TOTP auth, sessions, image variants, feeds, OG images, redirects, soft-delete, revisions, backups, WordPress import, six languages |

<div align="center">

<img src="docs/demo-admin.jpg" alt="The Quire Ink admin: the post editor with its attributes panel, and the appearance settings showing six colour palettes and four reading fonts" width="960">

<sub>Palettes, reading fonts, type scale, layout, menu. Settings, not code.</sub>

</div>

---

## Install

You need [Bun](https://bun.sh) 1.3 or newer and a machine you can point a domain at. That is
the whole list.

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # the islands, then the admin SPA
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Point a reverse proxy with TLS at the port (default `3000`), then create your account:

```bash
bun run user create --username <name> --email <address>   # prints the TOTP secret + recovery codes, once
```

That is the whole install. The schema is applied at boot inside a transaction, so there is no
migration step. Full walkthrough (systemd, nginx, cache headers, backups, upgrades) in
**[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> `bun run build` also produces a single compiled executable at `dist/quireink`, but
> `bun build --compile` does not bundle `sharp`'s native module, so that binary throws the
> first time it resizes an image. Until that is solved, **run from source**, which is what the
> live site does. Same command either way.

<details>
<summary><b>🐳 &nbsp;Prefer Docker?</b> &nbsp;Same install, two commands</summary>

<br/>

```bash
cp .env.docker.example .env          # set SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

One service, two named volumes, no sidecar. The port is published on `127.0.0.1` so a reverse
proxy still terminates TLS. Notes on volumes, ownership and upgrades:
[`docs/self-host.md`](./docs/self-host.md#9-docker-instead-of-systemd).

</details>

<details>
<summary><b>🤖 &nbsp;Hand the install to an AI agent</b></summary>

<br/>

Give an agent SSH to your server and ask it to deploy: clone the repo, build, write the
systemd unit and the nginx vhost, create your account, return the live URL. There is no OAuth
client to register and no managed service to sign up for, so it can genuinely do the whole
thing end to end.

</details>

> [!TIP]
> Uploads have no size cap on a self-host: the browser posts straight to the server. Put a CDN
> in front for edge caching and TLS, and let it honour the `cache-control` the app already
> sends rather than forcing a TTL.

---

## Let an AI agent write and publish (MCP)

Quire Ink ships a remote **MCP** server, so an agent can draft, edit, tag and publish straight to
the live site. No git, no deploy: content goes through the same data layer, and the same slug,
revision and soft-delete rules, that the admin uses.

1. **Turn it on:** *Admin → Settings → Connections → MCP*, and generate a named token. It is shown
   once, hashed at rest, and expires in 180 days.
2. **Connect your agent** to `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>`.
   OAuth connectors work too.
3. **Prompt it:**

```text
Using the Quire Ink MCP server, write a 600-word post titled
"What I learned shipping a blog with an AI agent", give it the tags
"ai" and "writing", set a friendly excerpt, and publish it.
```

Sensitive settings are blocked over MCP and you stay the sole authority: revoke a token in the
admin and it is gone.

---

## Environment variables

Everything else is configured in the admin, not in the environment.

| Variable | Required | What it is |
|---|:---:|---|
| `DATA_DIR` | ✅ | Directory holding `quire.db` + `analytics.db`. Defaults to `./data` |
| `SITE_URL` | ✅ | Canonical public URL, used by feeds, OG images and email. Empty means "derive per request", which is wrong behind a proxy |
| `STORAGE_LOCAL_DIR` | ◻️ | Where uploads live, served at `/uploads`. Defaults to `./uploads` |
| `PORT` | ◻️ | Defaults to `3000` |
| `CRON_SECRET` | ◻️ | Protects `/api/cron` (scheduled publishing, variant sweep) |
| `MCP_OAUTH_SECRET` | ◻️ | Signs MCP OAuth codes. Falls back to a secret the server generates for itself, which is the recommended setting |
| `ANALYTICS_TZ` | ◻️ | IANA zone for the analytics day boundary. Defaults to UTC |

SMTP, Turnstile and CDN credentials are entered in **Settings → Connections** and stored
server-side. Your content lives in `DATA_DIR` and the uploads directory, never in git.

---

## Develop

```bash
bun install
bun run build:admin                 # once, and again whenever src/admin changes
bun run dev                         # http://localhost:3000
bun run user create --username me --email me@example.com   # then sign in at /login
```

`bun run check:all` must pass before any change is done: typecheck, the static guards, and the
test suite. Offline, no credentials, no services. Start at
[`CONTRIBUTING.md`](./CONTRIBUTING.md), which routes to the house rules in
[`CLAUDE.md`](./CLAUDE.md).

| Path | |
|---|---|
| `src/` | The implementation: Bun + Hono + SQLite |
| `docs/` | How it works and why. [`docs/spec/`](./docs/spec/README.md) is the build plan, [`docs/decisions/`](./docs/decisions/README.md) the decision record, including the ones that were reversed |
| `state/` | Where things stand: roadmap, tasks, worklog, audits |
| `golden/` | The rendering contract: fixtures plus 1.x's output for each. One differing byte fails the build |
| `scripts/checks/` | The guards `check:all` runs. A write route registered outside the owner-gated group fails the build, and so does a hardcoded font size in the reader's stylesheet |
| `v1/` | Quire 1.5.0, the Next.js + PostgreSQL implementation this replaced. Retired, unsupported, kept as a readable record |

Roadmap: [`state/ROADMAP.md`](./state/ROADMAP.md).

---

## License

Two separate layers, and they are not the same:

- **Code, this repository:** [PolyForm Noncommercial 1.0.0](./LICENSE). Source-available, not
  open source. Free for any noncommercial purpose, meant broadly: personal blogs, hobby
  projects, study and research, plus charities, schools, public research bodies and
  government. You may read, modify, self-host, fork and redistribute it. Keep the licence text
  and the `Required Notice:` line with any copy you pass on.
- **Commercial use needs a separate licence.** Running Quire Ink for a business, or selling it or
  hosting of it, is not covered. Open an issue or contact the owner through
  [their GitHub profile](https://github.com/joiha-steven).
- **Content: © all rights reserved.** The writing published *with* Quire Ink belongs to its
  author, is not covered by the code licence, and does not live in this repository.

> **Everything published up to and including v2.0.0 was MIT, and stays MIT forever.** A licence
> change is not retroactive: any copy taken before this one keeps the rights it was given. See
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
