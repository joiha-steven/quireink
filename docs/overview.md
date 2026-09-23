# Quire Ink, in full

The [README](../README.md) is the short version: what it is, how to install it, where to go
next. This is the long one — what every part does, how it compares, why it is fast, and what
this release deliberately leaves out.

## What it is

A blog you write in and publish from, on a server you rent. It has the usual furniture: a front page, posts, categories, a search box, comments, a newsletter that goes out when you publish. What it has none of is an algorithm deciding who sees your writing, ads across the middle of it, or a company that can change the rules next year.

Colour, type, size, the shape of the front page, the menu: all of it is a setting in the admin, behind your own sign-in, and all of it works from a phone. Reading comfort is the point, so six palettes in light and dark, four reading fonts, a book mode set in two columns like paper and a five-ink pen come with it rather than as themes you go shopping for.

To start you need a domain and a rented server, and the cheapest tier is enough. That first setup is a technical job, so ask someone who knows servers or hand it to an agent ([Install](../README.md#install)). After that the writing, the look and the stats all live in the admin, and only an upgrade sends you back to a terminal. The trade is that you keep your own house: nobody backs it up for you, and the blog lives as long as the server you rent.

### Four things nothing else does together

**An agent can run the blog, not just write in it.** The MCP server is built in and goes through the same code the admin does. An assistant drafts, tags, schedules and publishes; it also reads your traffic, counts subscribers without ever seeing an address, sweeps spam into the trash rather than out of existence, recomposes the front page around what people actually read, and takes a snapshot before anything big. Plenty of blogs let a robot post. This one hands it the desk.

**Your readers get the pen too.** Select a sentence and a bar offers five inks, a pencil underline, a ballpoint ring, a note and the quote, drawn with the site's own hand. Marks anchor to the words rather than to a position, live in the reader's browser, and travel between devices by a twenty-character code rather than an account. It costs a reader 4.5 KB, only on a post, and one switch turns it off.

**The reading page is the product.** Type, colour, size, spacing and layout are settings, not code. Not one size or colour is written into the reader's stylesheet, and the build fails if somebody puts one there.

**Nothing of ours is forced onto your pages.** A new blog's footer ends in one "powered by Quire Ink" link. It is an ordinary line in Settings → Home & menu, so you rewrite it or clear it; the admin's wordmark and version line each have a switch.

<details>
<summary><b>Against the usual alternatives</b></summary>

- **Instead of a hosted platform.** Your writing is two SQLite files on your own disk, and one button turns it into a folder of Markdown any editor can read. No account, no plan, no export you have to hope still works in five years.
- **Instead of WordPress.** No PHP, no MySQL, no plugins to keep patched. One process, and readers get single-digit kilobytes of JavaScript.
- **Instead of a static site generator.** You get a real admin: write, upload a photo, schedule and publish from a laptop or a phone, with search, comments, a newsletter and stats already there. No rebuild, no deploy, no git push to fix a typo.
- **Instead of writing your own.** The boring half is done and tested: sign-in with TOTP, sessions, image resizing, feeds, OG images, redirects, an undo for deletes, revisions, backups, importers for WordPress, Ghost, Substack and Medium, eleven languages.

</details>

Nothing to deploy and no database to install:

```bash
bun --smol src/index.ts
```

## What you get

| The part | What it does |
|:---|:---|
| 🖋️&nbsp;**Writing** | A real editor over Markdown, and the Markdown engine is ours: one parse renders the page, opens the editor, saves it back and cuts the excerpt. Tables, video, footnotes, callouts, mathematics. A link alone on its own line becomes a preview card — the page's title, what it is about, its picture kept as your own copy — or, for one of your own uploads, a card naming the file and its size. A dropped image is cut for every screen and can hold the column, float, join a gallery or wear a paper mat. Saves as you type, keeps three versions, holds a post until Tuesday |
| 🏠&nbsp;**Front&nbsp;page** | The post list, a page you wrote, or a composed front: lead story, picks, a row per category, most read. [How it works](./homepage.md) |
| 🎨&nbsp;**Looks** | Four: plain paper, source code, a newspaper that numbers its own sections, a notebook on dot-grid paper. Over that, six palettes in light and dark and four reading fonts. Every size comes from a role, so one change moves the whole page |
| 🖍️&nbsp;**The&nbsp;pen** | `==text==` highlights in five inks, `++text++` underlines in pencil, `@@word@@` rings a word in red ballpoint, from a seeded hand that inks unevenly so no two strokes share a shape. Any site may link `/pen.css` and write with your inks |
| 📓&nbsp;**Notebook** | Notes and clips as a third kind of writing, keeping where a passage came from. Speaks IndieAuth, Micropub and Webmention. [How it works](./features/notes.md) |
| 💻&nbsp;**Code** | Highlighted on the server, so the reader downloads no highlighter. 346 languages loaded on demand. A fence naming nothing is guessed at timidly, so program output stays plain |
| 🔍&nbsp;**Reading** | Search that answers as you type and respects the accents you typed. A rail with your categories, or the contents of the post. Related posts, reading time, a progress bar. Book mode sets a post in two columns and keeps your place |
| 📈&nbsp;**Numbers** | Analytics without cookies: who read what, how far they got, where they came from, per post as well as per site. Nothing is ever deleted. Plus an activity log and a trash you can undo |
| 💬&nbsp;**Comments** | Readers comment without an account. The page signs its own spam challenge, so no third party sees them; Turnstile takes over only if you add its keys |
| 🔎&nbsp;**Search&nbsp;engines** | Sitemap, `robots.txt`, `llms.txt`, and an OG image drawn per post. RSS and JSON Feed, for the blog and for the notebook. Rename a slug and the old URL keeps working |
| 🔌&nbsp;**Read&nbsp;by&nbsp;a&nbsp;program** | A read-only JSON API at `/api/v1`: posts, pages, notes and your categories, each with the Markdown it was written in — enough to build a second front end, a search index or a static export without scraping pages. Off until you switch it on, and it shows only what is already public. [How it works](./content-api.md) |
| 🐘&nbsp;**Followable** | People can follow your blog from Mastodon and anywhere else that speaks ActivityPub, and new posts land in their timeline. Off until you switch it on and choose a handle — that handle plus your address are your identity out there, so it asks you to choose once. It publishes; replies and likes are not comments yet. [How it works](./fediverse.md) |
| 📬&nbsp;**Newsletter** | Sign-ups with a confirmation email, an issue sent when you publish, a note when a comment gets a reply. Your own SMTP |
| 💾&nbsp;**Backups** | One button downloads the whole install. Scheduled snapshots stay on the server and are shipped to your own R2 or S3 bucket. [Details](./backups.md) |
| 📥&nbsp;**Moving&nbsp;in,&nbsp;and&nbsp;out** | A WordPress XML, a Ghost JSON, or the ZIP Substack or Medium emailed you; the server works out whose it is. Old URLs answer with redirects, images land in your library. Out is a ZIP of Markdown with YAML front matter, which this blog also reads back |
| 🌍&nbsp;**Languages** | Eleven, in the admin and on the site, and one more is one file. A post or a page can also name the language IT is written in and point at its own translations, so one English essay on a Vietnamese blog is announced as English. No CJK webfont ships, because they run to megabytes, but each of the three names its own face |
| 🔐&nbsp;**Sign-in** | Username and password hashed with argon2id, an authenticator code every time, ten recovery codes, every signed-in device listed with a button to end it. No Google in the login path |
| 🤖&nbsp;**Assistant** | Your own model key: Claude, GPT, Gemini or DeepSeek. Answers arrive as they are written, conversations are kept, each carries a receipt of what it cost. It also writes alt text and sorts spam into the trash |
| ⌨️&nbsp;**The&nbsp;admin** | Server-rendered HTML with islands of hand-written JavaScript, no framework. ⌘⇧K finds any named setting and jumps to it. Nine chords in the editor, find and replace among them. Series, drafts, scheduling, and it all works from a phone |

**Made for** one person, one server, one blog they mean to keep.
**Not made for** a team that needs roles, approvals and an editorial queue. It has one owner on purpose.

<div align="center">

<img src="demo-looks.jpg" alt="The same article in four looks: plain paper, source code with bracketed furniture and line numbers, a newspaper with a masthead and a numbered section, and a notebook sheet ruled behind the text" width="960">

<sub>One post, four looks, one palette. The look decides shape, type and marks; every colour on all four comes from the palette, so changing it moves all of them together.</sub>

<img src="demo-reading.jpg" alt="Book mode, a two-column reader on paper with a drop cap, beside the dark theme showing a gallery of paintings above a table" width="960">

<sub>Book mode and the dark theme. Neither is a filter dropped over the page; both are the reading typography itself. The fonts ship with Vietnamese and Central European accents included, so the specimen on the left is set properly instead of falling back to whatever the system has.</sub>

<img src="demo-code.jpg" alt="A MathML formula in the reading face, a highlighted code block beside an unlabelled one, and three highlighter strokes" width="960">

<sub>Mathematics is MathML, laid out by the browser itself: no script, no stylesheet, no font file, so a post with a formula costs a reader nothing over one without. Code is highlighted on the server for the same reason. The lower block named no language, so nothing invented colours for it.</sub>

</div>

## Your readers get a pen

<img src="demo-reader-pen.jpg" alt="Left: a post with a reader's yellow highlight and a pencil underline, and the pen bar open over a selected sentence offering five inks, underline, ring, note and copy quote. Right: the card over a highlight, with a note box, Send to my notebook, and a twenty-character notebook code under Kept on every device" width="960">

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

The CSS and JavaScript rows are build artefacts, the same bytes on every install, brotli from the origin since 2.2.5. The font row is not a property of the software at all: faces are cut per script and a browser fetches only the ranges your pages use, so an English-only blog pays for one subset where the demo pays for three. The pen's stroke shapes ride in two further immutable sheets that board only a page carrying a mark ([ADR 0027](./decisions/0027-the-pen-ships-only-where-it-wrote.md)), and none of these sheets is fetched twice: the second page a reader opens pays for its HTML and nothing else.

<details>
<summary><b>Five decisions keep it there, and all five are hard to walk back</b></summary>

- **Every bundle has a size limit the build enforces.** Going over it fails the build, so a feature cannot quietly start costing every reader a little more forever.
- **The page cache is one `Map`, and any write empties all of it.** That is the whole rule, which leaves nothing to get subtly wrong. A miss costs a SQLite read and a render, well under a millisecond.
- **Rendered Markdown is stored beside a hash of its input**, so nothing ever needs invalidating. A long post went from 383 ms to 1 ms.
- **The fonts are yours, cut down per language**, and only the ones a page actually paints with get preloaded. Pinning one variable-font axis took that set from 97.6 KB to 46.2 KB.
- **The fade-in and the progress bar are pure CSS**: no script, off the main thread, and an old browser simply shows the text.

</details>

<div align="center">

<img src="demo-mobile.jpg" alt="Four phone screens: the post list, an article with its series contents, book mode set on paper and scrolled like a page, and the search panel filtering as it is typed" width="960">

<sub>None of this is for a benchmark. It is for someone on a four-year-old phone who wanted to read four hundred words.</sub>

<img src="demo-admin.jpg" alt="The Quire Ink admin: a post open in the editor with a pencil underline, a red ring and a highlighted sentence, beside the Appearance settings showing the four looks, the reading fonts, the shape controls and the colour presets" width="960">

<sub>The admin as 2.2.13 draws it: server-rendered pages, no framework. Everything on the right, the four looks included, is a setting rather than code, and the chrome on both screens is wearing one of them.</sub>

</div>

## This release

**2.2.14** is about the machine underneath. It runs in 192 MB where it needed 256, the backup archive can leave sealed, and an upgrade copies your database before it changes it. It runs the demo above and the author's own blog at [manhhung.me](https://manhhung.me); the [changelog](../CHANGELOG.md) has all of it, measurement by measurement.

- **It fits on a small machine.** Each picture size is encoded in a child process, so libvips can no longer climb the server to 136 MB and keep it; at 192 MB an encode may be killed and retried while the blog keeps serving. The server runs `bun --smol`, which took a 128 MB container from 121.5 MB and never finishing its warm-up to 55 MB and 379 ms, and the page cache is a budget, 8 MB by default.
- **The backup archive can leave sealed.** It carries every credential the blog holds, and now the server can seal it to two keys it cannot open itself: an identity shown once and a passphrase. **Off at install and off on this upgrade** (Settings, Server and connections, Backups). Lose both keys and nobody can open it.
- **An upgrade copies your database before it changes it**, into `data/backups/`, and refuses to migrate if it cannot. A migration that leaves the file mostly empty is followed by one compaction: a 618 MB database holding 8 MB of writing came back to 8.9 MB.
- **The four looks each read as their own kind of publication.** Source code sets every headline in its monospace and numbers code lines; the newspaper carries its sections in the masthead and opens on a drop cap; the notebook is dot-grid paper with links in highlighter. Settings shows them as drawn tiles.
- **Fixed on the way:** the render cache that grew with every deploy (502 MB on one blog, one post stored 204 times), a spaced list closing up on save, a mixed bullet and checkbox list splitting in two, an escaped dollar or tilde turning into maths or strikethrough, and backslashes printed into summaries.

**2.2.13, three days before,** let the writing out: the blog can be followed from Mastodon, read by a program through `/api/v1`, downloaded as Markdown that another tool can open, and a piece can say what language it is written in.

**2.2.10 to 2.2.12, the four days before,** are where the subtraction landed. Twenty-two declared packages left and twelve arrived, React and the seven `@tiptap/*` among them, and a clean install went from 194 MB on disk to 138. The admin is server-rendered HTML again and time to the heading went from 1,038ms to 285 on the activity log; the editor stands on ProseMirror directly and is ready to type in about 107ms; the Markdown engine is ours, at 648 of 652 CommonMark examples and 24 of 24 GFM; readers get the pen; the notebook speaks IndieAuth, Micropub and Webmention; and a post is 122.8 KB where 2.2.9 sent 131.


**What it does not do.** A sealed backup with both keys lost cannot be opened by anyone, and the ops script seals the database but copies uploads unsealed. The pre-upgrade copy sits on the same disk as the database. At 192 MB a picture's smaller copies may arrive a few minutes late. ActivityPub publishes and does not read, so the blog follows nobody and a reply is not a comment. The Content API is all or nothing, with no per-client key. A piece names its language but the site does not follow it: there is no per-language route, listing, feed or front page, and a piece can only name one of the eleven languages the interface speaks. The Markdown bundle is an export rather than a sync, and a link card is fetched once and never refreshed. There is no multi-user mode: one blog, one owner, one process, and comments have accounts where the writing side does not. A NAS and a Kubernetes cluster get no Caddy, deliberately, because both already terminate TLS somewhere else. Two devices marking the same page at once overwrite each other, last save wins. Nothing in the admin shows which passages readers keep most; only the `list_mentions` MCP tool answers that. Webmention verifies its source and rate-limits but has no spam judgement. Typing straight after a link puts the characters inside it, found and left alone on purpose, pinned by a test so it cannot drift without somebody deciding. There are four looks and no fifth, a look dresses the published site only, and going further is still custom CSS. The STARTTLS upgrade is proved against a real relay at deploy time and nowhere else, since Bun cannot turn an open socket into a TLS one on the server side. The library's name search narrows the page it is on rather than the whole library, which is what a pager costs. The Help screens are still English only, a few counts still read "1 attempts", the Motion switch is the owner's rather than per-reader, an install that rewrites its own HTML with nginx `sub_filter` loses the origin's compression and validator, and an origin with no CDN makes a reader on the far side of the planet pay a round trip that saved bytes cannot buy back.
