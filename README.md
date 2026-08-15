<div align="center">

# quire**INK** &nbsp;`2.0.3`

**A blog you host yourself, and an AI agent can run for you.**
One process. Two SQLite files. No cloud account anywhere in the path.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-22c55e)

**English** · [Tiếng Việt](./README.vi.md)

[**Try it**](https://demo.quireink.com) · [**Install**](#install) · [**Speed**](#speed) · [**Let an agent write**](#let-an-ai-agent-write-for-you-mcp) · [**Changelog**](./CHANGELOG.md) · [**License**](#license)

<br/>

<img src="docs/demo.jpg" alt="Two screenshots side by side: a composed front page with a lead story and section rows, and the same site's article page with a contents rail and a meta column" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** is the real thing. No sign-up, nothing to fill in. Use the bar at the bottom to jump between the front page, the list, an article, book mode, light and dark, and the admin. That bar is the only thing added, and it lives outside the code, so the demo is always the latest build.</sub>

</div>

---

## What it is

You write, it publishes, and all of it sits on a server you control.

There is no database to install and nothing to deploy. Point a domain at one command and you have a blog:

```bash
bun src/index.ts
```

Three things shaped it.

**The reading page is the product.** Type, colour, size, spacing, layout: all of it is a setting you change in the admin. Not one size or colour is written into the reader's stylesheet, and the build fails if someone puts one there.

**Readers download between 3.6 KB and 7.8 KB of JavaScript, and nothing from anyone else.** Pages arrive as finished HTML. A few small scripts handle search, the theme switch and book mode. React stays in the admin and never reaches a reader.

**An agent can do the writing.** Connect Claude or any MCP client and it can draft, tag, schedule and publish for you, through exactly the rules the admin follows.

You can read, change, run and fork it under [PolyForm Noncommercial](./LICENSE).

> **2.0.3 came out on 2026-08-15** and runs the demo above plus the author's own blog at
> [manhhung.me](https://manhhung.me). It folds 2.0.2 in, so there is one release to read.
> Thirty-eight commits: an audit that found no upload cap, no storage quota and a server
> listening on every interface under a log line that said otherwise; a rate limit a forged
> header could walk past; and an admin that had been wearing a dashboard framework's clothes
> instead of this product's. Almost all of it was found by measuring the running site rather
> than by reading the source. The [changelog](./CHANGELOG.md) has everything that changed.

---

## What you get

| | |
|:---|:---|
| 🖋️&nbsp;**Writing** | A real editor over Markdown — tables, video, footnotes, callouts, **mathematics**, Spotify. Drop an image in and it is cut for every screen. Saves as you type, keeps three versions, and can hold a post until Tuesday. The Markdown source view dims its own syntax |
| 🏠&nbsp;**Front&nbsp;page** | The post list, a page you wrote, or a composed front: lead story, picks, a row per category, most read. Works with photographs, and with only words. [How it works](./docs/homepage.md) |
| 🎨&nbsp;**Looks** | Six palettes, light and dark. Four reading fonts, or upload your own. Every size comes from a role, so one change moves the page instead of one heading |
| 🖍️&nbsp;**Highlighter** | `==text==` in five inks. Not a coloured box — an SVG stroke with chisel ends that breaks per line, from pigments measured off a photograph of a real pen box. 1.4 KB, and nothing at all if you never use it |
| 💻&nbsp;**Code** | Highlighted on the server, so the reader downloads no highlighter. Twenty-one languages, and the names people type (`typescript`, `sh`) reach them. A fence naming nothing is guessed at — timidly, so program output stays plain |
| 🔍&nbsp;**Reading** | Search that answers as you type. A side rail with your categories and tags, or the contents of the post. Related posts, reading time, a progress bar. And **book mode**: two columns on paper, with a drop cap |
| 📈&nbsp;**Numbers** | Analytics without cookies. Who read what, how far down they got, where they came from. Plus an activity log, a trash you can undo, and a help page |
| 🔎&nbsp;**Search&nbsp;engines** | Sitemap, RSS, `robots.txt`, `llms.txt`, and an OG image drawn per post. Rename a slug and the old URL keeps working on its own |
| 📬&nbsp;**Newsletter** | Sign-ups with a confirmation email, an issue sent when you publish, a note when a comment gets a reply. Your own SMTP, so nothing to sign up for |
| 📚&nbsp;**Series** | Write in parts, number them, and every part shows the others |
| 💾&nbsp;**Backups** | One button downloads the whole install, and a cron script ships it off the server. [Details](./docs/backups.md) |
| 📥&nbsp;**WordPress** | Upload the XML export. Posts and pages come out as Markdown |
| 🌍&nbsp;**Languages** | Six, in the admin and on the site. No CJK webfont ships — they are megabytes — but each of the three names its own face, so 直 is drawn the Japanese way on a Japanese site |
| 🔐&nbsp;**Sign-in** | Your own username and password, hashed with argon2id. An authenticator code every time, and ten recovery codes for the day you lose the phone. No Google in the login path |
| 📱&nbsp;**Phone** | Install it to the home screen and it opens like an app |

**Made for** one person, one server, one blog they mean to keep.
**Not made for** a team that needs roles, approvals and an editorial queue. It has one owner on purpose.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Book mode, a fullscreen two-column reader on paper with a drop cap and a page count, beside an article in the dark theme" width="960">

<sub>Book mode and the dark theme. Neither is a filter dropped over the page. Both are the reading typography itself. The fonts ship with Vietnamese and Central European accents included, so the specimen on the left is set properly instead of falling back to whatever the system has.</sub>

<img src="docs/demo-code.jpg" alt="Three screenshots: a formula bounding the drift of a rounded type scale, rendered as MathML in the reading face; the same site's code, one block highlighted from its language tag and one below it with no language where only the quoted text and a dollar-name are marked; and three highlighter strokes in yellow, green and pink" width="960">

<sub>Mathematics is MathML, drawn by the browser's own layout engine — no script, no stylesheet, no font file, so a post with a formula costs a reader nothing over one without. Code is highlighted on the server for the same reason; the lower block named no language, so nothing invented colours for it and only what is true of any notation is marked. The pen is an SVG stroke that breaks per line, in five inks.</sub>

</div>

---

## Speed

These are off the network, first visit, nothing cached. It is what a stranger on a phone actually waits for.

The CSS and JavaScript rows are build artefacts — the same bytes on every install — and are read off the 2.0.3 build; nothing in 2.0.2 or 2.0.3 moved them. The totals were measured for 2.0.1 against the origin, not through the CDN, and they are this site: Vietnamese, Literata to read and JetBrains Mono for the furniture. They are not a property of the software, because the fonts are cut per script and a browser fetches only the ranges your pages actually use. Fonts fell 86 KB to 67 KB in 2.0.1 without a face being dropped.

| | Home | A post | |
|:---|---:|---:|:---|
| **Requests** | 10 | 10 | |
| **Total&nbsp;transferred** | **106 KB** | **114 KB** | 67 KB of that is the fonts |
| **JavaScript** | **3.6 KB** | **7.8 KB** | written by hand, no framework |
| **CSS** | 8.0 KB | 8.0 KB | one file, minified, cached forever |
| **Third-party&nbsp;requests** | **0** | **0** | no CDN, no font host, no tracker |
| **Coming back** | ~19 KB | ~24 KB | only the HTML is fetched again |

It stays this way because of a few decisions that are hard to walk back.

**Every bundle has a size limit the build enforces.** Go over it and the build fails. A feature cannot quietly start costing every reader a little more forever.

**The page cache is one `Map`, and any write empties all of it.** That is the entire rule, so there is nothing to get subtly wrong. A miss costs a SQLite read and a render, well under a millisecond.

**Rendered Markdown is stored under a hash of its input.** Nothing ever needs invalidating. A long post went from 383 ms to 1 ms.

**Fonts are yours, cut down per language, and only the ones this page needs are preloaded.** Pinning one variable-font axis took that set from 97.6 KB to 46.2 KB.

**The fade-in and the progress bar are pure CSS.** No script, off the main thread, and if the browser is old it just shows the text.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Three phone screens: the post list, an article showing its series contents, and the instant search overlay with a query part-typed and the archive already filtered to the titles that match" width="960">

<sub>None of this is for a benchmark. It is for someone on a four-year-old phone who wanted to read four hundred words.</sub>

</div>

---

## Why not something else

**Instead of a hosted platform.** Your writing is two SQLite files on your own disk. No account, no plan, no export button you have to hope still works in five years.

**Instead of WordPress.** No PHP, no MySQL, no plugins to keep patched. One process, and readers get single-digit kilobytes of JavaScript.

**Instead of a static site generator.** You get a real admin. Write, upload a photo, schedule and publish from a laptop or a phone, with search, comments, a newsletter and stats already there. No rebuild, no deploy, no git push to fix a typo.

**Instead of writing your own.** The boring half is done and tested: sign-in with TOTP, sessions, image resizing, feeds, OG images, redirects, an undo for deletes, revisions, backups, a WordPress importer, six languages.

<div align="center">

<img src="docs/demo-admin.jpg" alt="The Quire Ink admin: the post editor with its attributes panel, and the appearance settings showing six colour palettes and four reading fonts" width="960">

<sub>Palettes, fonts, sizes, layout, menu. All of it is a setting, none of it is code.</sub>

</div>

---

## Install

You need [Bun](https://bun.sh) 1.3 or newer and a machine you can point a domain at. That is the list.

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # the islands, then the admin
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Put a reverse proxy with TLS in front of the port, `3000` by default. Then make your account:

```bash
bun run user create --username <name> --email <address>   # shows the TOTP secret and recovery codes, once
```

That is it. The database sets itself up on first boot, so there is no migration step to remember. If you want the full version with systemd, nginx, cache headers, backups and upgrades, it is in **[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> **Run from source — that is the whole deployment**, and it is what the live site does. There is
> no compiled binary: `bun build --compile` leaves out `sharp`'s native module, and a binary that
> cannot resize an image is not a shipping artefact
> ([ADR 0022](./docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)).

<details>
<summary><b>🐳 &nbsp;Would rather use Docker?</b> &nbsp;Two commands</summary>

<br/>

```bash
cp .env.docker.example .env          # set SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

One service, two volumes, no sidecar. The port only listens on `127.0.0.1`, so a reverse proxy still does TLS. Notes on volumes, ownership and upgrades are in [`docs/self-host.md`](./docs/self-host.md#9-docker-instead-of-systemd).

</details>

<details>
<summary><b>🤖 &nbsp;Or let an agent install it</b></summary>

<br/>

Give an agent SSH to a fresh server and ask it to set the whole thing up: clone, build, write the systemd unit and the nginx vhost, create your account, hand you back the URL. There is no OAuth client to register and no service to sign up for, so it really can finish the job on its own.

</details>

> [!TIP]
> Uploads have no size limit when you host it yourself, because the browser posts straight to
> your server. Put a CDN in front for TLS and edge caching, and let it obey the
> `cache-control` the app already sends instead of forcing its own.

---

## Let an AI agent write for you (MCP)

Quire Ink has an **MCP** server built in, so an assistant can draft, edit, tag and publish straight to your live site. No git, no deploy. It goes through the same code the admin does, with the same rules about slugs, revisions and the trash.

1. **Turn it on.** *Admin → Settings → Connections → MCP*, then create a token. You see it once, it is hashed after that, and it dies in 180 days.
2. **Point your agent** at `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>`. OAuth connectors work too.
3. **Ask for a post.**

```text
Using the Quire Ink MCP server, write a 600-word post titled
"What I learned shipping a blog with an AI agent", give it the tags
"ai" and "writing", set a friendly excerpt, and publish it.
```

The sensitive settings are off limits over MCP, and you stay in charge. Revoke the token in the admin and it stops working immediately.

---

## Environment variables

These are the only things that live outside the admin.

| Variable | Needed | What it does |
|---|:---:|---|
| `DATA_DIR` | ✅ | Where `quire.db` and `analytics.db` go. Defaults to `./data` |
| `SITE_URL` | ✅ | Your public address, used in feeds, OG images and email. Leave it empty and every one of them says `http://localhost:3000` — the site still reads fine, so the only things that notice are crawlers and mail clients. It is deliberately not guessed from the request |
| `STORAGE_LOCAL_DIR` | ◻️ | Where uploads go, served at `/uploads`. Defaults to `./uploads` |
| `PORT` | ◻️ | Defaults to `3000` |
| `HOST` | ◻️ | Which interface to listen on. Defaults to `127.0.0.1`, which is right when a reverse proxy sits in front on the same machine. Set `0.0.0.0` when it does not — another machine, or a container that has to be reachable from outside |
| `MAX_UPLOAD_MB` | ◻️ | Largest single upload the app will store. Defaults to `64`, matching the `client_max_body_size` in the recommended vhost so the two refuse the same file. `0` = no limit |
| `STORAGE_QUOTA_GB` | ◻️ | Largest the uploads folder may grow, counting the smaller copies made from each image. Defaults to `5`; an upload that would go past it is refused. `0` = no limit |
| `CRON_SECRET` | ◻️ | Guards `/api/cron`, which publishes scheduled posts and tidies image variants |
| `MCP_OAUTH_SECRET` | ◻️ | Signs MCP OAuth codes. Leave it out and the server makes its own, which is the recommended way |
| `ANALYTICS_TZ` | ◻️ | The timezone your analytics day starts in. Defaults to UTC |
| `TRUST_PROXY` | ◻️ | Set to `1` only when the proxy in front reaches you over a PUBLIC address. Rate limits key on the socket address; `CF-Connecting-IP`/`X-Forwarded-For` are believed automatically when the connection came from loopback or a private network |

SMTP, Turnstile and CDN credentials go in **Settings → Connections** and stay on the server. Your posts live in `DATA_DIR` and your uploads folder, never in git.

---

## Develop

```bash
bun install
bun run build:admin                 # once, and again whenever src/admin changes
bun run dev                         # http://localhost:3000
bun run user create --username me --email me@example.com   # then sign in at /login
```

Nothing is finished until `bun run check:all` passes. It typechecks, runs the static guards and runs the tests, all offline, with no credentials and no services. Start at [`CONTRIBUTING.md`](./CONTRIBUTING.md), which points to the house rules in [`CLAUDE.md`](./CLAUDE.md).

| Where | What is in it |
|---|---|
| `src/` | The whole thing: Bun, Hono, SQLite. [How the pieces fit](./docs/spec/02-structure.md) |
| `docs/` | How it works and why. [`docs/README.md`](./docs/README.md) indexes it; [`docs/decisions/`](./docs/decisions/README.md) is every decision, including the ones that were reversed |
| `golden/` | The rendering contract. One byte of different output fails the build |
| `scripts/checks/` | The guards. Register a write route outside the owner-only group and the build stops, same as a hardcoded font size in the reader's stylesheet |

What is planned lives with the author's own notes rather than here, because it is one
person's intentions for one blog and not a promise to anybody running the software
([ADR 0017](./docs/decisions/0017-move-state-and-instance-config-private.md)). What has
already shipped is in the [changelog](./CHANGELOG.md).

---

## License

Two different things, and they are not covered by the same terms.

**The code here** is [PolyForm Noncommercial 1.0.0](./LICENSE). Source-available, not open source. Free for anything noncommercial, meant generously: your own blog, a hobby project, study, research, and also charities, schools, public research bodies and government. Read it, change it, host it, fork it, pass it on. Keep the licence text and the `Required Notice:` line with any copy you give someone.

**Using it commercially needs a separate licence.** Running Quire Ink for a business, or selling it, or selling hosting for it, is not covered. Open an issue or reach the owner through [their GitHub profile](https://github.com/joiha-steven).

**What you write stays yours.** Your posts and images are not covered by the code licence and are not in this repository.

> **Everything up to and including v2.0.0 was MIT, and stays MIT forever.** A licence change
> does not reach backwards: a copy taken before this one keeps the rights it came with. See
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
