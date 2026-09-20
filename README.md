<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.13`

**A blog you host yourself, and an AI agent can run it for you.**
No algorithm, no ads, no platform standing between you and your readers.
One process. Two SQLite files. No cloud account anywhere in the path. Your name on it, not ours.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white) ![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white) ![ProseMirror](https://img.shields.io/badge/ProseMirror-6d5aca) ![MCP](https://img.shields.io/badge/MCP-ready-7c3aed) ![License: PolyForm Noncommercial plus paid hosting](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e)

**English** · [Tiếng Việt](./README.vi.md)

[**quireink.com**](https://quireink.com) · [**Try it**](https://demo.quireink.com) · [**What you get**](#what-you-get) · [**Install**](#install) · [**Speed**](#speed) · [**Let an agent write**](#let-an-ai-agent-write-for-you-mcp) · [**Changelog**](./CHANGELOG.md) · [**License**](#license)

<br/>

<img src="docs/demo.jpg" alt="A composed front page with a lead story and section rows, beside the same site's article page with a contents rail, pen marks and a mounted letter facsimile" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** is the real thing. No sign-up, nothing to fill in. The bar at the bottom jumps between the front page, the list, an article, book mode, light and dark, and the admin. That bar is the only thing added, and it lives outside the code, so the demo is always the latest build.</sub>

</div>

> **It runs the demo above and the author's own blog.** Every push goes through the test suite
> and a browser tour of every screen, and a release is cut only when both are green. Bugs still
> ship: [tell the issue tracker](https://github.com/joiha-steven/quireink/issues) what broke.
> What this release deliberately does **not** do is [listed below](#this-release).

> **Written by someone who cannot code.** Every line of Quire Ink is Claude Code's work; I have
> no software background at all. What I do have is time for it, so updates come often — and if
> something breaks, [open an issue](https://github.com/joiha-steven/quireink/issues). Being told
> is the only way I find out, and I fix what I can as soon as I can.

## What it is

A blog you write in and publish from, on a server you rent. It has the usual furniture: a front page, posts, categories, a search box, comments, a newsletter that goes out when you publish. What it has none of is an algorithm deciding who sees your writing, ads across the middle of it, or a company that can change the rules next year.

Colour, type, size, the shape of the front page, the menu: all of it is a setting in the admin, behind your own sign-in, and all of it works from a phone. Reading comfort is the point, so six palettes in light and dark, four reading fonts, a book mode set in two columns like paper and a five-ink pen come with it rather than as themes you go shopping for.

To start you need a domain and a rented server, and the cheapest tier is enough. That first setup is a technical job, so ask someone who knows servers or hand it to an agent ([Install](#install)). After that the writing, the look and the stats all live in the admin, and only an upgrade sends you back to a terminal. The trade is that you keep your own house: nobody backs it up for you, and the blog lives as long as the server you rent.

### Four things nothing else does together

**An agent can run the blog, not just write in it.** The MCP server is built in and goes through the same code the admin does. An assistant drafts, tags, schedules and publishes; it also reads your traffic, counts subscribers without ever seeing an address, sweeps spam into the trash rather than out of existence, recomposes the front page around what people actually read, and takes a snapshot before anything big. Plenty of blogs let a robot post. This one hands it the desk.

**Your readers get the pen too.** Select a sentence and a bar offers five inks, a pencil underline, a ballpoint ring, a note and the quote, drawn with the site's own hand. Marks anchor to the words rather than to a position, live in the reader's browser, and travel between devices by a twenty-character code rather than an account. It costs a reader 4.5 KB, only on a post, and one switch turns it off.

**The reading page is the product.** Type, colour, size, spacing and layout are settings, not code. Not one size or colour is written into the reader's stylesheet, and the build fails if somebody puts one there.

**Nothing of ours is forced onto your pages.** No "powered by" line: the footer is your own line or nothing, and the admin's wordmark and version line each have a switch.

<details>
<summary><b>Against the usual alternatives</b></summary>

- **Instead of a hosted platform.** Your writing is two SQLite files on your own disk, and one button turns it into a folder of Markdown any editor can read. No account, no plan, no export you have to hope still works in five years.
- **Instead of WordPress.** No PHP, no MySQL, no plugins to keep patched. One process, and readers get single-digit kilobytes of JavaScript.
- **Instead of a static site generator.** You get a real admin: write, upload a photo, schedule and publish from a laptop or a phone, with search, comments, a newsletter and stats already there. No rebuild, no deploy, no git push to fix a typo.
- **Instead of writing your own.** The boring half is done and tested: sign-in with TOTP, sessions, image resizing, feeds, OG images, redirects, an undo for deletes, revisions, backups, importers for WordPress, Ghost, Substack and Medium, eleven languages.

</details>

Nothing to deploy and no database to install:

```bash
bun src/index.ts
```

## What you get

| The part | What it does |
|:---|:---|
| 🖋️&nbsp;**Writing** | A real editor over Markdown, and the Markdown engine is ours: one parse renders the page, opens the editor, saves it back and cuts the excerpt. Tables, video, footnotes, callouts, mathematics. A link alone on its own line becomes a preview card — the page's title, what it is about, its picture kept as your own copy — or, for one of your own uploads, a card naming the file and its size. A dropped image is cut for every screen and can hold the column, float, join a gallery or wear a paper mat. Saves as you type, keeps three versions, holds a post until Tuesday |
| 🏠&nbsp;**Front&nbsp;page** | The post list, a page you wrote, or a composed front: lead story, picks, a row per category, most read. [How it works](./docs/homepage.md) |
| 🎨&nbsp;**Looks** | Four: plain paper, source code, a newspaper that numbers its own sections, a notebook ruled at your leading. Over that, six palettes in light and dark and four reading fonts. Every size comes from a role, so one change moves the whole page |
| 🖍️&nbsp;**The&nbsp;pen** | `==text==` highlights in five inks, `++text++` underlines in pencil, `@@word@@` rings a word in red ballpoint, from a seeded hand that inks unevenly so no two strokes share a shape. Any site may link `/pen.css` and write with your inks |
| 📓&nbsp;**Notebook** | Notes and clips as a third kind of writing, keeping where a passage came from. Speaks IndieAuth, Micropub and Webmention. [How it works](./docs/features/notes.md) |
| 💻&nbsp;**Code** | Highlighted on the server, so the reader downloads no highlighter. 346 languages loaded on demand. A fence naming nothing is guessed at timidly, so program output stays plain |
| 🔍&nbsp;**Reading** | Search that answers as you type and respects the accents you typed. A rail with your categories, or the contents of the post. Related posts, reading time, a progress bar. Book mode sets a post in two columns and keeps your place |
| 📈&nbsp;**Numbers** | Analytics without cookies: who read what, how far they got, where they came from, per post as well as per site. Nothing is ever deleted. Plus an activity log and a trash you can undo |
| 💬&nbsp;**Comments** | Readers comment without an account. The page signs its own spam challenge, so no third party sees them; Turnstile takes over only if you add its keys |
| 🔎&nbsp;**Search&nbsp;engines** | Sitemap, `robots.txt`, `llms.txt`, and an OG image drawn per post. RSS and JSON Feed, for the blog and for the notebook. Rename a slug and the old URL keeps working |
| 🔌&nbsp;**Read&nbsp;by&nbsp;a&nbsp;program** | A read-only JSON API at `/api/v1`: posts, pages, notes and your categories, each with the Markdown it was written in — enough to build a second front end, a search index or a static export without scraping pages. Off until you switch it on, and it shows only what is already public. [How it works](./docs/content-api.md) |
| 🐘&nbsp;**Followable** | People can follow your blog from Mastodon and anywhere else that speaks ActivityPub, and new posts land in their timeline. Off until you switch it on and choose a handle — that handle plus your address are your identity out there, so it asks you to choose once. It publishes; replies and likes are not comments yet. [How it works](./docs/fediverse.md) |
| 📬&nbsp;**Newsletter** | Sign-ups with a confirmation email, an issue sent when you publish, a note when a comment gets a reply. Your own SMTP |
| 💾&nbsp;**Backups** | One button downloads the whole install. Scheduled snapshots stay on the server and are shipped to your own R2 or S3 bucket. [Details](./docs/backups.md) |
| 📥&nbsp;**Moving&nbsp;in,&nbsp;and&nbsp;out** | A WordPress XML, a Ghost JSON, or the ZIP Substack or Medium emailed you; the server works out whose it is. Old URLs answer with redirects, images land in your library. Out is a ZIP of Markdown with YAML front matter, which this blog also reads back |
| 🌍&nbsp;**Languages** | Eleven, in the admin and on the site, and one more is one file. A post or a page can also name the language IT is written in and point at its own translations, so one English essay on a Vietnamese blog is announced as English. No CJK webfont ships, because they run to megabytes, but each of the three names its own face |
| 🔐&nbsp;**Sign-in** | Username and password hashed with argon2id, an authenticator code every time, ten recovery codes, every signed-in device listed with a button to end it. No Google in the login path |
| 🤖&nbsp;**Assistant** | Your own model key: Claude, GPT, Gemini or DeepSeek. Answers arrive as they are written, conversations are kept, each carries a receipt of what it cost. It also writes alt text and sorts spam into the trash |
| ⌨️&nbsp;**The&nbsp;admin** | Server-rendered HTML with islands of hand-written JavaScript, no framework. ⌘⇧K finds any named setting and jumps to it. Nine chords in the editor, find and replace among them. Series, drafts, scheduling, and it all works from a phone |

**Made for** one person, one server, one blog they mean to keep.
**Not made for** a team that needs roles, approvals and an editorial queue. It has one owner on purpose.

<div align="center">

<img src="docs/demo-looks.jpg" alt="The same article in four looks: plain paper, source code with bracketed furniture and line numbers, a newspaper with a masthead and a numbered section, and a notebook sheet ruled behind the text" width="960">

<sub>One post, four looks, one palette. The look decides shape, type and marks; every colour on all four comes from the palette, so changing it moves all of them together.</sub>

<img src="docs/demo-reading.jpg" alt="Book mode, a two-column reader on paper with a drop cap, beside the dark theme showing a gallery of paintings above a table" width="960">

<sub>Book mode and the dark theme. Neither is a filter dropped over the page; both are the reading typography itself. The fonts ship with Vietnamese and Central European accents included, so the specimen on the left is set properly instead of falling back to whatever the system has.</sub>

<img src="docs/demo-code.jpg" alt="A MathML formula in the reading face, a highlighted code block beside an unlabelled one, and three highlighter strokes" width="960">

<sub>Mathematics is MathML, laid out by the browser itself: no script, no stylesheet, no font file, so a post with a formula costs a reader nothing over one without. Code is highlighted on the server for the same reason. The lower block named no language, so nothing invented colours for it.</sub>

</div>

## Your readers get a pen

<img src="docs/demo-reader-pen.jpg" alt="Left: a post with a reader's yellow highlight and a pencil underline, and the pen bar open over a selected sentence offering five inks, underline, ring, note and copy quote. Right: the card over a highlight, with a note box, Send to my notebook, and a twenty-character notebook code under Kept on every device" width="960">

The mark is anchored to the words rather than to a position, so it survives the author fixing a typo three paragraphs up. It lives in the reader's browser and nothing is sent anywhere, until they press *Keep on every device*: then the marks travel, by the Google sign-in commenters already have or by a twenty-character code for anyone who would rather not sign in to anything. The server keeps a hash and one row per page, never an address, and you as the owner see none of it. *Send to my notebook* opens a page on the reader's own Quire Ink, or any site that speaks Micropub, with the passage already filled in.

On from the first install, one switch turns it off. Try it on [the demo](https://demo.quireink.com).

## Speed

Off the network, first visit, nothing cached. It is what a stranger on a phone actually waits for.

**A DEFAULT install, with nothing switched off.** Measured on the demo fixture, which is what `bun run tour` seeds, so anyone with the repository can take these numbers again. Compressed body bytes from the origin; the blog's own pictures are counted separately, because they are your content rather than the software. Book mode and the reader's pen are ON out of the box and are priced here as what they are; the last column is what a blog gets back by turning them off.

| | Home | A post | Turning those two off |
|:---|---:|---:|:---|
| **Requests** | 10 | 16 | 14 |
| **Total&nbsp;transferred** | **118.9&nbsp;KB** | **122.8&nbsp;KB** | 114.9&nbsp;KB |
| **JavaScript** | **3.7&nbsp;KB** | **15.9&nbsp;KB** | **8.7&nbsp;KB**; written by hand, no framework |
| **CSS** | 12.4&nbsp;KB | 31.9&nbsp;KB | unchanged: the two pen sheets ride where the author's own marks are |
| **Fonts** | 91.5&nbsp;KB | 65.3&nbsp;KB | cut per script, so this is the one row your own content decides: the demo's titles run to three alphabets |
| **Third&#8209;party&nbsp;requests** | **0** | **0** | no CDN, no font host, no tracker |
| **Coming&nbsp;back** | **0&nbsp;bytes** | **0&nbsp;bytes** | the same page answers `304` |

The CSS and JavaScript rows are build artefacts, the same bytes on every install, brotli from the origin since 2.2.5. The font row is not a property of the software at all: faces are cut per script and a browser fetches only the ranges your pages use, so an English-only blog pays for one subset where the demo pays for three. The pen's stroke shapes ride in two further immutable sheets that board only a page carrying a mark ([ADR 0027](docs/decisions/0027-the-pen-ships-only-where-it-wrote.md)), and none of these sheets is fetched twice: the second page a reader opens pays for its HTML and nothing else.

<details>
<summary><b>Five decisions keep it there, and all five are hard to walk back</b></summary>

- **Every bundle has a size limit the build enforces.** Going over it fails the build, so a feature cannot quietly start costing every reader a little more forever.
- **The page cache is one `Map`, and any write empties all of it.** That is the whole rule, which leaves nothing to get subtly wrong. A miss costs a SQLite read and a render, well under a millisecond.
- **Rendered Markdown is stored under a hash of its input**, so nothing ever needs invalidating. A long post went from 383 ms to 1 ms.
- **The fonts are yours, cut down per language**, and only the ones a page actually paints with get preloaded. Pinning one variable-font axis took that set from 97.6 KB to 46.2 KB.
- **The fade-in and the progress bar are pure CSS**: no script, off the main thread, and an old browser simply shows the text.

</details>

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Four phone screens: the post list, an article with its series contents, book mode set on paper and scrolled like a page, and the search panel filtering as it is typed" width="960">

<sub>None of this is for a benchmark. It is for someone on a four-year-old phone who wanted to read four hundred words.</sub>

<img src="docs/demo-admin.jpg" alt="The Quire Ink admin: a post open in the editor with a pencil underline, a red ring and a highlighted sentence, beside the Appearance settings showing the four looks, the reading fonts, the shape controls and the colour presets" width="960">

<sub>The admin as 2.2.13 draws it: server-rendered pages, no framework. Everything on the right, the four looks included, is a setting rather than code, and the chrome on both screens is wearing one of them.</sub>

</div>

## This release

**2.2.13** lets the writing out: the blog can be followed from Mastodon, read by a program, and downloaded as Markdown that another tool can open, and a piece can say what language it is written in. It runs the demo above and the author's own blog at [manhhung.me](https://manhhung.me); the [changelog](./CHANGELOG.md) has all of it, measurement by measurement.

- **The blog can be followed from anywhere that speaks ActivityPub.** A reader on Mastodon follows it where they already read, and every post published, changed or withdrawn reaches them. **Off at install and off on this upgrade** (Settings, Server and connections): switching it on gives the blog an identity in a network of other people's servers, with a keypair and a list of strangers who asked to hear from it, and the handle cannot change afterwards. It publishes and does not read, so replies, likes and boosts are dropped.
- **The blog can be read by a program.** `/api/v1` answers with posts, pages, notes and the terms as JSON, carrying the Markdown each piece was written in, so a second front end or a search index no longer means scraping every page. **Off at install and off on this upgrade**, 404 rather than 403 while off, read only, no key, and it serves the owner byte for byte what it serves a stranger.
- **A piece can say what language it is written in**, and link to its translations: the right `lang`, an hreflang set, sitemap alternates, and a Korean headline in a Vietnamese feed set in the right face and read aloud in the right voice. A piece that names no language is untouched, because that means "nobody has said" rather than English.
- **The writing leaves as Markdown and comes back.** A ZIP beside the backup: every post, page and note with front matter, the uploads file for file, the settings whole, and a README for whoever opens it in ten years. There is an importer for it, so "everything survives the round trip" is a test rather than a hope.
- **A paragraph holding nothing but a link becomes a card**, with a title, a description and a picture brought home rather than hotlinked, and a link to an uploaded PDF looks like a download. **On for a new blog, off for one that already exists** (Settings, Posts), because the bookmark card is the one that reaches out.
- **Several pieces at once**: publish, draft or bin a selection in one request where fifty ticks were fifty requests, fifty cache flushes and fifty CDN purges. The notebook can be subscribed to as well, and both feeds now come as RSS and as JSON Feed.
- **The Docker image says what it is.** Every OCI label was the base image's, so a published container called itself `bun`, version `1.4.2-slim`, source `github.com/oven-sh/bun`, which is what a registry reads to link a package to its repository and what an upgrade notifier compares. It also carries 4.1 MB less: 291 test files and two browser halves that were shipping beside the bundles built from them.
- **Three things that were losing readers.** A footnote id could put a working event handler on a reader's page; the second factor could be guessed at about eighty tries a second, measured at 645 guesses in 8 seconds with no 429; and one post's title carrying a stray control character took the whole RSS feed off the air for every subscriber while its own page looked perfect.

**2.2.10 to 2.2.12, the four days before,** are where the subtraction landed. Twenty-two declared packages left and twelve arrived, React and the seven `@tiptap/*` among them, and a clean install went from 194 MB on disk to 138. The admin is server-rendered HTML again and time to the heading went from 1,038ms to 285 on the activity log; the editor stands on ProseMirror directly and is ready to type in about 107ms; the Markdown engine is ours, at 648 of 652 CommonMark examples and 24 of 24 GFM; readers get the pen; the notebook speaks IndieAuth, Micropub and Webmention; and a post is 122.8 KB where 2.2.9 sent 131.


**What it does not do.** ActivityPub publishes and does not read, so the blog follows nobody and a reply is not a comment. The Content API is all or nothing, with no per-client key. A piece names its language but the site does not follow it: there is no per-language route, listing, feed or front page, and a piece can only name one of the eleven languages the interface speaks. The Markdown bundle is an export rather than a sync, and a link card is fetched once and never refreshed. There is no multi-user mode: one blog, one owner, one process, and comments have accounts where the writing side does not. A NAS and a Kubernetes cluster get no Caddy, deliberately, because both already terminate TLS somewhere else. Two devices marking the same page at once overwrite each other, last save wins. Nothing in the admin shows which passages readers keep most; only the `list_mentions` MCP tool answers that. Webmention verifies its source and rate-limits but has no spam judgement. Typing straight after a link puts the characters inside it, found and left alone on purpose, pinned by a test so it cannot drift without somebody deciding. There are four looks and no fifth, a look dresses the published site only, and going further is still custom CSS. The STARTTLS upgrade is proved against a real relay at deploy time and nowhere else, since Bun cannot turn an open socket into a TLS one on the server side. The library's name search narrows the page it is on rather than the whole library, which is what a pager costs. The Help screens are still English only, a few counts still read "1 words", the Motion switch is the owner's rather than per-reader, an install that rewrites its own HTML with nginx `sub_filter` loses the origin's compression and validator, and an origin with no CDN makes a reader on the far side of the planet pay a round trip that saved bytes cannot buy back.

## Install

**Where can it live?** Any of these, and the blog is the same on all of them.

- **A rented VPS**, cheapest tier. The one command below, then one more for the certificate ([`deploy/caddy/setup.sh`](./deploy/caddy/setup.sh)); or Docker, where the certificate comes with it.
- **A DigitalOcean droplet**: paste [one file](./deploy/digitalocean/user-data.sh) into the droplet-create page and it is serving three minutes after boot ([how and why](./deploy/digitalocean/README.md)).
- **A NAS in your house**: **Unraid** has it in Community Applications; **Synology** (DSM 7.2+) and QNAP take the compose file in Container Manager. No shell on any of them, since the blog prints its claim link to the container log. [Step by step, per box](./docs/self-host-docker.md#on-a-nas-or-a-home-server).
- **Any machine with Docker**: pull `quireink/quireink`, `amd64` and `arm64` both. With HTTPS that is [`docker-compose.image.yml`](./docker-compose.image.yml) plus the [`Caddyfile`](./Caddyfile), so two files and no checkout.
- **A Kubernetes cluster**: `kubectl apply -k deploy/kubernetes`. One pod and one volume, because one blog is one SQLite writer ([the manifests, and why a StatefulSet](./deploy/kubernetes/README.md)).

**Two of those bring no Caddy, both on purpose.** A NAS already holds ports 80 and 443 behind its own certificate UI, and a Kubernetes cluster terminates TLS at its ingress. Everywhere else the certificate comes with the install.

For the first path you need [Bun](https://bun.sh) 1.3 or newer and a machine you can point a domain at. That is the list.

**One command**, which clones, installs, builds and starts it:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

It never uses `sudo`, never installs Bun behind your back and never touches systemd; it refuses to run as root, and running it again on the same directory updates and rebuilds instead of failing. Settings go in front of `bash`, on the far side of the pipe:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | SITE_URL=https://example.com QUIREINK_DIR=/srv/blog bash
```

`NO_RUN=1` stops it short of starting the blog, and [the script itself](./install.sh) is 136 readable lines if you would rather look before you pipe.

<details>
<summary><b>Or the same thing by hand</b>, &nbsp;which is all the script does</summary>

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # the islands, then the admin
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Put a reverse proxy with TLS in front of the port, `3000` by default.

</details>

**Then read the log.** A blog nobody owns yet prints the link that claims it, every time it starts:

```
  https://example.com/setup?token=…
```

Open it and the rest is a browser: username, email, password, then the QR code for an authenticator and ten recovery codes, once. The token lives in memory, so a restart mints a new one and the old line stops being a secret, and `/setup` answers 404 the moment an account exists. Prefer the terminal? `bun run user create --username <name> --email <address>` does the same job.

<div align="center">

<img src="docs/demo-setup.jpg" alt="Three first-run screens: claiming the blog with the language asked first, naming the site with the time zone and address already filled in, and choosing between a list front page and a composed one" width="960">

<sub>Setup after the log line. The language is the first field on the first screen, because the two screens after it are no use to somebody who does not read English. The time zone and the address arrive already filled in, because the browser knows both and both are wrong by default without saying so. A fourth question follows these three: which of the four looks the site wears, which is the one thing you know before writing a word.</sub>

</div>

The database sets itself up on first boot, so there is no migration step to remember. The full version with systemd, nginx, cache headers, backups and upgrades is in **[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> **Run from source. That is the whole deployment**, and it is what the live site does. There is
> no compiled binary: `bun build --compile` leaves out `sharp`'s native module, and a binary that
> cannot resize an image is not a shipping artefact
> ([ADR 0022](./docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)).

<details>
<summary><b>🐳 &nbsp;Would rather use Docker?</b> &nbsp;Pull the image, or build it</summary>

**Pull it.** Nothing to clone, no Bun, no build step, on `linux/amd64` and `linux/arm64`:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
docker logs quire            # prints the link that claims the blog
```

`:latest` on purpose: the newest release is the one with the fixes in it. Version tags exist
for anyone who wants to move by hand instead. Also on GHCR as `ghcr.io/joiha-steven/quireink`,
the same image from the same run, carrying the same digest, so the two can never drift.

**Or build it from this repository**, which is what `docker-compose.yml` does:

```bash
cp .env.docker.example .env          # set SITE_URL
docker compose up -d --build
docker compose logs quire            # the claim link, same as above
```

**No `docker exec` and no interactive terminal anywhere in that**, which is the point: a NAS container UI gives you a log panel and no TTY. One service, two volumes, no sidecar. The port listens on `127.0.0.1` only, so a reverse proxy still does TLS.

**On a NAS** (Synology, QNAP, Unraid), mount real folders and set `PUID`/`PGID` to whoever owns them: the container adopts them on first boot and never runs as root. Volumes, ownership and upgrades are in [`docs/self-host-docker.md`](./docs/self-host-docker.md).

</details>

<details>
<summary><b>🤖 &nbsp;Or let an agent install it</b></summary>

Give an agent SSH to a fresh server and ask it to set the whole thing up: clone, build, write the systemd unit and the nginx vhost, create your account, hand you back the URL. There is no OAuth client to register and no service to sign up for, so it really can finish the job on its own.

</details>

> [!TIP]
> Uploads have no size limit when you host it yourself, because the browser posts straight to
> your server. Put a CDN in front for TLS and edge caching, and let it obey the
> `cache-control` the app already sends instead of forcing its own.

## Let an AI agent write for you (MCP)

Quire Ink has an **MCP** server built in, so an assistant can draft, edit, tag and publish straight to your live site. No git, no deploy. It goes through the same code the admin does, with the same rules about slugs, revisions and the trash.

1. **Turn it on.** *Admin → Settings → Server & connections → MCP*, then create a token. You see it once, it is hashed after that, and it dies in 180 days.
2. **Point your agent** at `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>`. OAuth connectors work too.
3. **Ask for a post.**

```text
Using the Quire Ink MCP server, write a 600-word post titled
"What I learned shipping a blog with an AI agent", give it the tags
"ai" and "writing", set a friendly excerpt, and publish it.
```

Writing is half of it. The agent can also read your traffic and compare it to last week, count subscribers without seeing their addresses, sweep spam into the trash, search the whole archive, and tell you whether a newer release is out. It can steward, too: recompose the front page around what people actually read, restyle the site from the curated palettes and fonts, reply to a comment under your name, send the next newsletter issue as a test to you alone, and take a snapshot before anything big. Free-form colour is the one thing it cannot touch, because an agent has no eyes. The [agent cookbook](./docs/agent-cookbook.md) collects prompts that do real jobs: a Monday report, a newsletter draft, an archive audit.

The sensitive settings are off limits over MCP, and you stay in charge: revoke the token in the admin and it stops working immediately.

The repository also teaches the agent. Three skills ship in `.claude/skills/`, so an assistant that has just cloned this repo already knows how to install a blog, run one over MCP, and move an existing blog in from WordPress, Ghost, Substack or Medium. Nothing to install: clone it and ask. [What they cover](./docs/agent-ready.md#skills-that-ship-in-the-repository).

## Environment variables

These are the only things that live outside the admin. Two matter; the rest have working defaults.

| Variable | What it does |
|---|---|
| `DATA_DIR` | Where `quire.db` and `analytics.db` go. Defaults to `./data` |
| `SITE_URL` | Your public address, used in feeds, OG images and email. Left empty, all of them say `http://localhost:3000`, so the site still reads fine and only crawlers and mail clients notice. It is deliberately not guessed from the request |

<details>
<summary><b>The other seventeen</b> &nbsp;ports, limits, storage, cron, mail, proxying</summary>

| Variable | What it does |
|---|---|
| `STORAGE_LOCAL_DIR` | Where uploads go, served at `/uploads`. Defaults to `./uploads` |
| `PORT` | Defaults to `3000` |
| `HOST` | Which interface to listen on. Defaults to `127.0.0.1`, right when a reverse proxy sits in front on the same machine. Set `0.0.0.0` when it does not |
| `SETUP_CODE` | Twelve characters or more; then `/setup` asks for it instead of the log link. For installs where nobody reads a log: cloud-init, a hosting panel |
| `MAX_UPLOAD_MB` | Largest single upload. Defaults to `64`, matching the `client_max_body_size` in the recommended vhost so the two refuse the same file. `0` = no limit |
| `STORAGE_QUOTA_GB` | Largest the uploads folder may grow, counting the smaller copies of each image. Defaults to `5`, and an upload that would go past it is refused. `0` = no limit |
| `CRON_SECRET` | Guards `/api/cron`, which publishes scheduled posts and tidies image variants |
| `CRON_INTERNAL` | `0` stops the process running its own maintenance clock, for when you would rather schedule `/api/cron` yourself. On by default since [ADR 0031](./docs/decisions/0031-the-blog-winds-its-own-clock.md) |
| `PURGE_WEBHOOK_URL` | A URL the blog POSTs to whenever it flushes its own cache, for a CDN that is not Cloudflare ([ADR 0033](./docs/decisions/0033-purging-an-edge-that-is-not-cloudflare.md)). Normally a setting instead |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+`S3_ENDPOINT`, `S3_REGION`, `S3_PREFIX`) | An S3-compatible bucket every snapshot is also shipped to ([ADR 0035](./docs/decisions/0035-the-snapshot-leaves-the-machine.md)). Normally a setting instead |
| `BACKUP_DIR` | Where snapshots are written. Defaults to `<DATA_DIR>/backups` ([backups](./docs/backups.md)) |
| `MCP_OAUTH_SECRET` | Signs MCP OAuth codes. Leave it out and the server makes its own, which is the recommended way |
| `ANALYTICS_TZ` | Default timezone until the owner picks one in **Settings → Blog → Timezone**, which is the site's whole clock: post dates, month markers, the day a chart starts on. Defaults to UTC |
| `CSP` | A Content-Security-Policy to send on every response. Empty by default, and leave it that way behind the shipped `Caddyfile` or the documented nginx block: both send one already, and a browser enforces the intersection, so a second could only narrow theirs. Set it where neither is in front, such as a NAS proxy, a PaaS, or a Kubernetes ingress |
| `SMTP_OFF` | Stops this machine sending mail at all: the newsletter, the confirmation, the comment notice. For a staging or development copy of a real blog: copy the `.env`, set this, and nothing reaches a real address. It fails SAFE, so any value other than `0`, `false`, `no` or empty means off. The subscribe form disappears from the reader's page with it, on purpose: a form that can never send its confirmation leaves somebody waiting for an email that was never coming |
| `TRUST_PROXY` | Set to `1` only when the proxy in front reaches you over a PUBLIC address. Rate limits key on the socket address; `CF-Connecting-IP`/`X-Forwarded-For` are believed automatically from loopback or a private network |
| `UPDATE_CHECK` | `0` stops the one request this software makes on its own: once a day it asks what the newest release is, and by asking is counted as a blog in use. It sends the version you run and four coarse facts, never your address, posts, readers or an exact number. Also a switch in Settings. [The whole call](./docs/update-check.md) |

</details>

SMTP, Turnstile and CDN credentials go in **Settings → Comments & mail** and **Server & connections**, and stay on the server. Your posts live in `DATA_DIR` and your uploads folder, never in git.

## Translations

**Eleven languages** on the reader's side and in the admin: English, Tiếng Việt, Deutsch, 日本語, 简体中文, 한국어, Français, Español, Português (Brasil), Italiano and Русский. The first question setup asks is which one this blog speaks.

Adding a twelfth is two files and a registered code, and the compiler refuses to build a half-done one. [How to](./docs/translations.md).

## Develop

```bash
bun install
bun run build:admin                 # once, and again whenever src/admin changes
bun run dev                         # http://localhost:3000
# the log prints a /setup link to claim it; or: bun run user create --username me --email me@example.com
```

Nothing is finished until `bun run check:all` passes: a typecheck, twelve static guards and the tests, all offline, with no credentials and no services. `bun run tour` then drives every screen in a real browser and opens the backup it built. Start at [`CONTRIBUTING.md`](./CONTRIBUTING.md), which points to the house rules in [`CLAUDE.md`](./CLAUDE.md).

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
