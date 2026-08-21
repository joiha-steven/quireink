<div align="center">

# quire**INK** &nbsp;`2.1.3`

**A blog you host yourself, and an AI agent can run for you.**
No algorithm, no ads, no platform standing between you and your readers.
One process. Two SQLite files. No cloud account anywhere in the path.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial plus paid hosting](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e)

**English** · [Tiếng Việt](./README.vi.md)

[**quireink.com**](https://quireink.com) · [**Try it**](https://demo.quireink.com) · [**Install**](#install) · [**Speed**](#speed) · [**Let an agent write**](#let-an-ai-agent-write-for-you-mcp) · [**Changelog**](./CHANGELOG.md) · [**License**](#license)

<br/>

<img src="docs/demo.jpg" alt="Two screenshots side by side: a composed front page with a lead story and section rows, and the same site's article page with a contents rail, a meta column, a pencil underline, a red ballpoint ring around one word, a blue highlight, and a scanned Van Gogh letter as its first figure" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** is the real thing. No sign-up, nothing to fill in. Use the bar at the bottom to jump between the front page, the list, an article, book mode, light and dark, and the admin. That bar is the only thing added, and it lives outside the code, so the demo is always the latest build.</sub>

</div>

---

## What it is

You write, it publishes, and all of it sits on a server you control.

This section is for a reader who is not technical. The rest of the page is for whoever sets it up.

**It is a blog, in the plain sense of the word.** A front page, posts, categories, a search box, comments, and a newsletter that emails your subscribers whenever you publish. What it does not have: an algorithm deciding who gets to see your writing, ads cutting across it, and a company that can change the rules or close down one day.

**You change it by clicking, not by writing code.** Colour, type, size, the shape of the front page, the menu — all of it lives in the admin, behind your own sign-in, and works from a phone.

**The reading page is unusually light.** Opening a post costs about 114 KB — a photo from your phone is a few dozen times heavier. Someone on a weak signal with an old handset still sees the words almost at once. These are measurements, not claims: [the table](#speed).

**Reading comfort is the point of the whole project.** Six palettes in light and dark, four reading fonts, a book mode set in two columns like paper, and a five-ink highlighter for the lines worth keeping.

**An AI can write and publish for you.** Connect Claude (or another assistant) and say: *"write a 600-word post about today's trip, tag it travel, publish it"*. It drafts and publishes through exactly the rules you use, and you can take its access away at any moment.

**What you need to start.** A domain, and a rented server — the cheapest tier is enough. The first setup is a technical job: ask someone who knows servers, or hand the whole thing to an AI agent ([Install](#install)). After that the daily work — writing, publishing, changing the look, reading the stats — is all in the admin; only upgrading to a new version needs the command line again.

**In return, you keep your own house.** Nobody backs it up for you — there is a button that downloads the entire blog, but pressing it is your job — and the blog lives as long as the server you rent.

**Free, and you may charge for it.** A personal blog costs nothing. Running it inside a business, or selling hosting where every customer gets their own blog, is allowed too — as long as what you run is the version published here. Only a *modified* version used commercially needs to ask first: [License](#license).

**Not for everyone.** A newsroom with roles, approvals and an editorial queue should look elsewhere. Quire Ink has one owner on purpose.

---

## Under the hood

There is no database to install and nothing to deploy. Point a domain at one command and you have a blog:

```bash
bun src/index.ts
```

Three things shaped it.

**The reading page is the product.** Type, colour, size, spacing, layout: all of it is a setting you change in the admin. Not one size or colour is written into the reader's stylesheet, and the build fails if someone puts one there.

**Readers download between 3.8 KB and 8.7 KB of JavaScript, and nothing from anyone else.** Pages arrive as finished HTML. A few small scripts handle search, the theme switch and book mode. React stays in the admin and never reaches a reader.

**An agent can do the writing.** Connect Claude or any MCP client and it can draft, tag, schedule and publish for you, through exactly the rules the admin follows.

You can read, change, run and fork it under [PolyForm Noncommercial](./LICENSE), and run the published version commercially — paid hosting included — under [one additional permission](./LICENSE-EXCEPTION.md).

> **2.1.3 came out on 2026-08-21** and runs the demo above plus the author's own blog at
> [manhhung.me](https://manhhung.me). It is a day of editor fixes on top of 2.1.2, all of them
> found by one person writing one post: pasting a Markdown article now makes a post instead of
> a wall of escaped text, two ways the writing surface could go blank are closed, a page that
> fails now says so instead of unmounting the admin, a table stops losing a formula, an image
> or a column on save, and publishing tells the CDN in about 50ms rather than nine seconds.
> A body link is now underlined by the pen, in dashes, because colour alone measured 1.24:1
> against the words around it. The [changelog](./CHANGELOG.md) has everything that changed.

---

## What you get

| | |
|:---|:---|
| 🖋️&nbsp;**Writing** | A real editor over Markdown — tables, video, footnotes, callouts, **mathematics**, Spotify. Drop an image in and it is cut for every screen. Saves as you type, keeps three versions, and can hold a post until Tuesday. The Markdown source view dims its own syntax |
| 🏠&nbsp;**Front&nbsp;page** | The post list, a page you wrote, or a composed front: lead story, picks, a row per category, most read. Works with photographs, and with only words. [How it works](./docs/homepage.md) |
| 🎨&nbsp;**Looks** | Six palettes, light and dark. Four reading fonts, or upload your own. Every size comes from a role, so one change moves the page instead of one heading |
| 🖍️&nbsp;**The&nbsp;pen** | `==text==` highlights in five inks, `++text++` underlines in pencil, `@@word@@` rings a word in red ballpoint. Not coloured boxes — strokes grown from a seeded hand, so no two on a page share a shape and every phrase keeps its own. Pigments measured off a photograph of a real pen box |
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

<img src="docs/demo-reading.jpg" alt="Book mode, a fullscreen two-column reader on paper with a drop cap, a captioned letter facsimile and a page count, beside the dark theme showing a two-by-two gallery of Van Gogh paintings above a table" width="960">

<sub>Book mode and the dark theme. Neither is a filter dropped over the page. Both are the reading typography itself. The fonts ship with Vietnamese and Central European accents included, so the specimen on the left is set properly instead of falling back to whatever the system has.</sub>

<img src="docs/demo-code.jpg" alt="Three screenshots: a formula bounding the drift of a rounded type scale, rendered as MathML in the reading face; the same site's code, one block highlighted from its language tag and one below it with no language where only the quoted text and a dollar-name are marked; and three highlighter strokes in yellow, green and pink" width="960">

<sub>Mathematics is MathML, drawn by the browser's own layout engine — no script, no stylesheet, no font file, so a post with a formula costs a reader nothing over one without. Code is highlighted on the server for the same reason; the lower block named no language, so nothing invented colours for it and only what is true of any notation is marked. The pen is an SVG stroke that breaks per line, in five inks.</sub>

</div>

---

## Speed

These are off the network, first visit, nothing cached. It is what a stranger on a phone actually waits for.

The CSS and JavaScript rows are build artefacts — the same bytes on every install — and are read off the 2.0.3 build. Nothing between 2.0.1 and 2.1.0 moved them; 2.1.1 grew the stylesheet to 29.3 KB gzipped with the pen's stroke shapes, since split back down ([ADR 0027](docs/decisions/0027-the-pen-ships-only-where-it-wrote.md)): `site.css` is 7.6 KB gzipped, and the pen rides in two further immutable sheets (11.6 + 8.5 KB) that only board the pages carrying a mark or an underline — an inkless page is lighter than it was before the pen existed. The totals were measured for 2.0.1 against the origin, not through the CDN, and they are this site: Vietnamese, Literata to read and JetBrains Mono for the furniture. They are not a property of the software, because the fonts are cut per script and a browser fetches only the ranges your pages actually use. Fonts fell 86 KB to 67 KB in 2.0.1 without a face being dropped.

| | Home | A post | |
|:---|---:|---:|:---|
| **Requests** | 10 | 10 | |
| **Total&nbsp;transferred** | **106&nbsp;KB** | **114&nbsp;KB** | 67&nbsp;KB of that is the fonts |
| **JavaScript** | **3.8&nbsp;KB** | **8.7&nbsp;KB** | written by hand, no framework |
| **CSS** | 7.6&nbsp;KB | 7.6&nbsp;KB | +20&nbsp;KB only on a page carrying the pen |
| **Third&#8209;party&nbsp;requests** | **0** | **0** | no CDN, no font host, no tracker |
| **Coming&nbsp;back** | ~19&nbsp;KB | ~24&nbsp;KB | only the HTML is fetched again |

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

<img src="docs/demo-admin.jpg" alt="The Quire Ink admin: the Write screen with the list of everything written beside the editor's paper — a toolbar with underline and ring buttons, a pencil underline, a ringed word and a highlighted sentence in the post — and the appearance settings as one sheet of panels with six colour palettes and four reading fonts" width="960">

<sub>The admin is built around writing: the list beside the paper, and everything else one sheet per page. Palettes, fonts, sizes, layout, menu — all of it is a setting, none of it is code.</sub>

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
<summary><b>🐳 &nbsp;Would rather use Docker?</b> &nbsp;Pull the image, or build it</summary>

<br/>

**Pull it.** Nothing to clone, no Bun, no build step — `linux/amd64` and `linux/arm64`:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:2.1
docker exec quire bun run user create --username you --email you@example.com
```

Also on GHCR as `ghcr.io/joiha-steven/quireink` — the same image, pushed by the same run and
carrying the same digest, so the two can never drift.

**Or build it from this repository**, which is what `docker-compose.yml` does:

```bash
cp .env.docker.example .env          # set SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

One service, two volumes, no sidecar. The port only listens on `127.0.0.1`, so a reverse proxy still does TLS.

**On a NAS** (Synology, QNAP, Unraid), mount real folders and set `PUID`/`PGID` to whoever owns them — the container adopts them on first boot and never runs as root. Notes on volumes, ownership and upgrades are in [`docs/self-host.md`](./docs/self-host.md#10-docker-instead-of-systemd).

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

**The code here** is [PolyForm Noncommercial 1.0.0](./LICENSE) plus [one additional permission](./LICENSE-EXCEPTION.md). Source-available, not open source. Together they come to one sentence: **run it, and charge for running it, as long as the version you run is the one published here.**

**Noncommercial: everything.** Your own blog, a hobby project, study, research, and also charities, schools, public research bodies and government. Read it, change it, host it, fork it, pass it on. Keep the licence text and the `Required Notice:` line with any copy you give someone.

**Commercial: yes, unmodified.** Run it for a business, run it for a client, sell hosting where each customer gets their own Quire Ink blog. What that asks of you: run a published release with its source unchanged — settings, palettes, fonts and content are not source, and the look of a site is a setting here rather than a fork — keep the notices, say your service runs Quire Ink and link back, and sell the service rather than the software. It is all in [`LICENSE-EXCEPTION.md`](./LICENSE-EXCEPTION.md), which is short.

**A modified version, used commercially, needs a separate licence.** That is the one line the project holds: changing the code and then selling it, or running a changed copy as a service, is the thing to ask about first. Fixing a bug or a security hole in your own deployment is carved out — patch it, and tell the owner within 30 days. Ask by opening an issue or through [the owner's GitHub profile](https://github.com/joiha-steven).

**What you write stays yours.** Your posts and images are not covered by the code licence and are not in this repository.

> **Everything up to and including v2.0.0 was MIT, and stays MIT forever.** A licence change
> does not reach backwards: a copy taken before this one keeps the rights it came with. See
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
