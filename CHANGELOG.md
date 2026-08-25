# CHANGELOG

## Unreleased

### The Auto schema switch does something now

It shipped in the settings shape, defaulted to ON, and told the owner in plain words that it
"adds structured data for Google: WebSite on the home page, BlogPosting on each post". Nothing
read it. `grep -rn 'ld+json' src/` returned nothing at all. The docs recorded the gap honestly;
the switch in front of the owner did not, so it read as a feature that was working.

It is wired. **`WebSite`** on the home page, carrying the sitelinks search box only when search
is actually switched on — describing an endpoint that answers 404 is worse than describing
none. **`BlogPosting`** on each post, with the real `dateModified` and only when the post was
genuinely saved again, so nothing claims to have been edited on the day it appeared. A static
page gets none: an object restating the title and the canonical tells a crawler nothing the
tags beside it already did. No author, because there is no owner-name setting in this
software and the only name on record is the sign-in username; the site is named as publisher
instead. And no schema at all when `siteUrl` is unset — the same rule the canonical follows,
because `http://localhost:3000` has reached production in a feed and a sitemap before.

### Every listing describes itself

Search, every tag, every category, every series and the 404 page all shipped **the same meta
description**: the site's own one-line summary, which describes none of them. Four indexable
page kinds, one identical snippet. Term and series pages now build their own from the six
locales, and the 404 and search pages use the sentences already on them. The home page keeps
the site description, because there it is the right answer.

### A search results page is no longer an invitation to a crawler

`/search?q=` mints a URL per query and carried no canonical and nothing else to stop an
indexer either. It sends `noindex, follow` now — follow, because the links on that page are
the real posts and there is no reason to waste them.

### Three repairs a screen reader notices, and a description that fits in the result

Found by auditing the rendered pages against the [Front-End Checklist](https://frontendchecklist.io)
(387 rules), not by reading the source — which is why they had survived this long.

**Every navigation region says which one it is.** A page carried two or three `<nav>`
landmarks and a screen reader lists them by label alone, so they all read as "navigation"
and none of them told you which. The contents rail already got this right; the sidebar menu
and the pager now do too. The header's control cluster went the other way: search, theme,
palette, grid, subscribe and the drawer toggle are buttons, not links to anywhere, so
announcing them as a navigation landmark sent people to a toolbar. It is a `<div>` now.
Nothing moved on screen — the class carried all the styling.

**A table header says it is one.** Every `<th>` a Markdown table produces now carries
`scope="col"`. In a simple table a screen reader can infer the column from position; `scope`
is what WCAG asks for by name, and in a table with merged cells it is the only association
there is. This is the second deliberate divergence from what 1.x printed, recorded in
`golden/` the way the first one was: 1.x's answer stays untouched on disk, the new answer
sits beside it, and eleven changed lines across five fixtures were checked one by one to
differ by that attribute and nothing else.

**Meta descriptions stopped being written past the point anybody reads them.** The bound was
200 characters under a comment saying a search engine truncates there, while a second comment
eleven lines below said the wall is about 160. The second one was right: five of ten sampled
pages shipped a description with a tail that Google cuts off. It is 157 now — 160 less the
ellipsis that says it was cut — and the two comments agree.

### An agent can now read the blog, not just write it

Six new MCP tools — the reading half of the surface: `get_traffic` (the dashboard's own
numbers, with the window before for comparison), `get_audience` (subscriber and comment
counts), `list_comments` and `delete_comment` (moderation, soft delete into the Trash),
`search_posts` (the owner's full-text search, drafts included) and `get_update_status`
(the amber/green dot, answerable by an assistant). Two things stay unreachable over MCP
on purpose, held by tests: subscriber addresses, and commenters' emails and IPs. A new
[agent cookbook](./docs/agent-cookbook.md) shows prompts that do real jobs with all this.

### And steward it

Six more: `compose_homepage` curates the composed front page (which rows, what size,
where their posts come from — the layout grammar stays the product's), `update_appearance`
restyles the site strictly from the curated menus (an agent has no eyes, so it gets preset
ids, never a color), `get_post_traffic` answers for one post, `reply_comment` answers a
reader under the owner's name and emails them like a reply typed on the page,
`send_test_newsletter` sends the next issue to the owner alone — the recipient is not a
parameter, and the real broadcast is deliberately not a tool — and `create_snapshot`
takes the scheduler's own backup before anything big.

### Every picture can have words now

Settings grew an **AI tab** — the model, the jobs it does automatically, and the MCP
door an agent connects through, all in one place. Paste an API key — Anthropic, OpenAI
or Gemini, your pick, your bill — and **the models list themselves** for you to choose
from, which also proves the key works before you save it. From then on every image you
upload gets alt text written for it — and two more jobs joined it, each with its own
switch: a post published with the excerpt left blank gets a real one written in your
tone (the mechanical first-fifty-words was never an excerpt, it was a shrug), and every
comment arriving through the public door is read once — spam moves to the Trash where
you can restore it, and when the model mumbles, the reader wins. The library also grew
a button: describe every image that has never been described, for the blog that just
moved in with five hundred pictures. Each image gets alt text written for it, in the site's own
language, in the background, by the time you go looking. Pasting the key IS the switch:
without one, no request ever leaves your server, which keeps the promise this software
already makes elsewhere. The suggestion lands on the image in the library, flows into the
editor as the default alt when you insert it, and stays yours to edit — clear it and the
machine never refills it, because '' is a decision and NULL is an absence.

### An assistant moved into the admin

The sidebar grew an **Assistant** page: a chat that runs on the model you plugged into
Settings → AI and acts through **exactly the tools an MCP agent gets** — the same
registry, the same limits, the same activity log. "How did the blog do this week?",
"sweep the comments for spam", "switch to the sepia palette" — asked in a sentence,
inside the admin, no MCP client required. Every tool it runs shows as a chip under the
reply, arguments are checked against each tool's own schema before anything executes,
and the conversation lives in your open tab and nowhere else — the blog's database
holds posts, not chats. Two doors now, one rulebook: whoever has a Claude subscription
connects over MCP; whoever plugged in a key talks to the blog directly.

### Three more front doors

The importer used to speak only WordPress. It now takes a Ghost export (.json), a
Substack export or a Medium export (the .zip they email you) through the same one file
input — the server tells the archives apart by structure, because nobody remembers whose
zip is whose. And every import, WordPress included, now passes a deterministic cleanup:
dead shortcodes swept, captions folded into their images, non-breaking-space debris and
blank-line pileups gone. No AI touches your words on the way in; an assistant connected
over MCP can polish further, post by post, through the same revisioned saves as any edit.

### Your essays print like pages, not like web pages

Press Ctrl+P on a post — or save it as a PDF — and you get the essay. Before this there
was not one print rule in the whole stylesheet, so paper got the screen: the reading
progress bar, the [search] [dark] [palette] [menu] buttons, a "book mode" link that does
nothing on paper, then the related posts, the entire comment thread, the subscribe card
and the footer. Ten sheets for a four-page piece, and four dead buttons at the top of it.

Now the page carries the masthead as one line of provenance, the essay, its notes, its
tags — and stops. The measure is set for paper rather than for a viewport, headings do
not sit alone at the foot of a page, tables and code and figures are not cut in half,
code wraps instead of losing its right-hand end, and a link that leaves the site prints
its address so a paper copy is still a lead. Your own type settings come with it, at the
size you chose. A reader printing at night gets ink on paper rather than a black page.
The pen marks are the one thing that keeps its colour, because they are the reason a page
off this site looks like this site.

### Small things

The Assistant page and the AI tab were both rebuilt after being looked at rather than
reasoned about: the tab was drawing browser-default dropdowns and OS-blue checkboxes
beside the switches on the card next to it, and had no labels on any of its three fields;
the chat had its composer stranded two thirds of the way down the page with empty paper
under it, said nothing about which model would answer, and let you type a question before
telling you no model was connected. Both are made from the same kit as every other screen
now, and the assistant names its model, offers a few openers, keeps the composer where
your hands are, and lets you start over.

Two links that went nowhere: `Settings → AI` reached from anywhere outside the settings
screen quietly landed on the Site tab (the tab list the address is checked against had
never been told the AI tab exists — it is read from the source of truth now), and the
Assistant had taken a fifth seat in a sidebar whose rule is four. It sits with the rest
of "everything else", one click away.

### Select a sentence, and take it with you

Highlight anything in a post and one small control appears: **Copy quote**. It puts the
sentence on your clipboard with a link that opens the post *at that sentence*, scrolled to
it and highlighted by the reader's own browser. Paste it into a message and the person on
the other end lands exactly where you were, not at the top of a long essay.

It is not a share button. Nothing is sent anywhere, no account is involved and no third
party is contacted: the link is an ordinary URL with a text fragment on the end, so a
browser that does not know the trick simply opens the post. On a phone it sits *below* the
selection, where the operating system's own Copy menu is not.

The link stays readable, which took some care: the usual way of building one percent-encodes
every non-Latin letter, so a Vietnamese sentence came out as two hundred characters of hex.
Only whitespace and the three characters the syntax reserves are escaped now, and a long
quote is anchored on its two ends rather than carried whole.

### The keyboard under your fingers, and a caret that stops flickering

**Typewriter feedback** was one switch. It is now a choice of instrument in Settings →
Appearance: **Typewriter**, **Mechanical, tactile**, **Mechanical, linear**, or **Off**.
The typewriter strikes bright and hard. The tactile board gives you the bump and then the
bottom-out, twelve milliseconds apart, which is the thing your finger is actually feeling.
The linear one has no bump at all: one soft, low thock. The space bar and the return are
deeper than the letters on all three, because they are the two biggest keys on any board,
and no two strikes are identical — a click repeated exactly stops sounding like typing.
Nothing is downloaded for any of it; the sound is made in the browser, as it always was.

**And the flicker is gone.** Every keystroke used to animate the whole paragraph you were
typing into: its opacity dropped to 0.9 and it moved by half a pixel. At an ordinary typing
speed that is a paragraph strobing five times a second under your eyes. Nothing moves the
text now. The sound carries the keystroke, the caret carries the position, and the words
hold still — which is what a real machine does, where the paper moves and the letters do not.

**The caret stops blinking while you are typing**, and starts again about two thirds of a
second after you stop. It fades rather than switching on and off, and never fades all the
way out. A blink means "the cursor is here and nothing is happening"; while your hands are
moving, something is.

If you had the old switch on, you have the typewriter. If you had it off, you have Off.

### And you set how loud it is

The click shipped at one fixed level, and one level is a guess about a room, a pair of
speakers and a person. **Key volume** sits under the instrument in Settings → Appearance:
drag it, and it plays a key as it goes, so you are listening to the thing you are setting
instead of walking to the editor and back to find out. Picking an instrument plays it too —
tactile and linear are a difference you hear or you do not hear at all.

Nothing about the balance moves with it: a space stays deeper than a letter, and the tactile
bump stays under its bottom-out, wherever you put the slider. **Zero is a real setting** —
the caret without the sound — and it is not the same as turning the instrument Off.

### Three sounds that are actually three sounds

The first attempt was not three instruments. It was one burst of noise through one filter,
three times, at three centre frequencies — which is one sound with three EQ settings, and it
sounded like it. This is a rebuild from the machines outward.

They are called **Woody**, **Crisp** and **Deep**, and they used to be called after the
machines they are modelled on. They are not called that any more, because they are not
recordings and they are not going to fool anybody: a name that promises a 1940s Underwood
makes a good synthesised knock sound worse than it is. So they are named for what you hear.

**Woody** is built like a machine that strikes: a lever, something hitting a hard surface
through a ribbon, and a small bright mechanism finishing the job a moment later — three
events across sixty milliseconds. Its space bar strikes nothing at all, so it is a dull
knock and a tick, and its return key sends the whole thing back across and into the stop.
**Crisp** is a snap and then a landing fourteen milliseconds after it: bright, hard, over in
forty. **Deep** has no snap — a blunt start, a low body letting go slowly, and one quiet
tick as the key comes back up.

Every key has three separate takes, matched in level so they differ in grain and not in
force, and each one plays back a few percent off pitch. Forty keys in a line never repeat.

**And it is much louder.** The top of the slider is about six times the amplitude the old
one reached at ITS top, and the default sits well above where the old one ever went. The
three are levelled against each other by measurement rather than by eye — weighted for what
the ear is sensitive to, and again for what a laptop speaker can actually reproduce — so
switching sound changes the sound and not the volume.

**Play a few keys** now sits beside the volume. Dragging the slider plays one key, which
turns out to be easy to miss; six of them in a row is not, and a run is the only way to hear
what separates these three anyway. If your browser had not yet let a page make a sound, the
first key you asked for used to be swallowed. It is not any more.

Whatever you had chosen stays chosen.

### The pen is yours now

Settings → Appearance grew a card called **The pen**: the five highlighter pigments, the
ring, the underline, and what selected text looks like on a light page and on a dark one.
Every field starts empty, and empty means the ink that is there today, so nothing changes
until you change it and **Reset to default** puts all nine back.

Pick a colour and it brings its own family with it. A highlighter pigment is really four
values: the sweep, the same sweep pre-mixed into a dark page, and two ballpoint-strength
versions for the ring and the underline, because a pale sweep is invisible as a 2px line.
You choose one; the other three are worked out from it, by the same rule the built-in inks
were measured against. If the colour you pick is dark enough to swallow the words under it,
the card says so rather than stopping you: it is your pen, and it is also the contrast floor
the rest of the site is held to.

The inks that ship stay measured off a photograph of a real pen box, and a blog that never
opens the card serves the exact same stylesheet, under the exact same address, that it
served before any of this existed. [ADR 0029](./docs/decisions/0029-the-pen-becomes-the-owners.md)
records the trade, and amends the decision that said these colours would never be a setting.

### Selecting text looks like this site

Drag across a sentence and the highlight is black on a light page and grey on a dark one,
in place of the browser's blue. That blue was the one colour on the page that came from
nowhere: everything else down to the hairline is the palette you chose, and the most
physical gesture a reader makes was borrowing the operating system's accent.

### A switch that clears the desk

The editor grew a **Focus** switch (and `Ctrl/Cmd + \`): one press takes the list of your
writing and the whole button row off the screen and leaves the paper. Nothing is lost while
it is on, because selecting text still raises the formatting bar and "/" still opens the
inserts. The default is unchanged.

The same pass fixed what a 13-inch laptop was actually looking at. The list of your writing
used to sit beside the editor from 1280px, which left the button row 630 pixels to fit 787
into: it wrapped to two lines, the line above it wrapped to two more, and there were three
tiers of chrome above the first word. The list now joins the editor at 1640px, where there
is room for both, and below that the paper gets the window.

## 2026-08-22 — Quire Ink 2.1.4

The day after the editor day, spent auditing rather than writing: the whole source, the
analytics behind it, and every screen at four widths — phone, iPad upright, iPad sideways,
desktop. What the audit found is below. Still a drop-in: same install, same settings, same
database, no migrations. **One new environment variable**, `UPDATE_CHECK`, which exists so
you can turn a new behaviour off.

### Your blog now knows when a release is out

Once a day, on the first visit it gets, your blog asks `check.quireink.com` what the newest
release is, and the dashboard wears the answer as a dot beside the version: amber when a
newer release exists, green when you are on it, and nothing at all when it has not asked
recently — "up to date" is a claim, and a stale answer cannot make it. Nothing updates
itself: knowing a release exists and installing it are separate acts, and the second one
stays yours.

The same request is how a running blog is counted, and the request was designed around
that: what goes out is the version, a code rebuilt from a new date every midnight so no two
days can be linked, and whether the site has a public address yet. Not your address, not
your posts, not your readers, not your figures — the whole request is one line, written out
in [the self-hosting guide](./docs/self-host.md#11-what-this-blog-tells-us-and-how-to-stop-it).
Turn it off in Settings → System or with `UPDATE_CHECK=0`, and it stays quiet on its own
under `bun --watch` and `bun test`, because an afternoon of development is not an install.

### One clock for the whole site, and you choose it

The date under a post was the server's date. A public page is rendered once and cached, so
a post published at 18:00 UTC read "August 22" from a machine in London and "August 23"
from one in Hanoi — and moving the server silently moved every date on the site. The zone
is now a setting, **Settings → Site → Timezone**, and it is the site's whole clock: the
date under every post, the month markers in the archive, the newsletter's date line, and
the day an analytics chart starts on. `ANALYTICS_TZ` keeps working as the default until you
pick one. The picker offers what the runtime's own timezone database knows rather than
carrying a copy of it, and a typo cannot take a page down — an unknown zone falls back
instead of throwing.

### An uploaded SVG no longer gets to act on your site

An SVG is a drawing that is allowed to carry script, and `/uploads/` served one like any
other image. Opened directly in a tab, the browser ran that script on your blog's own
origin, where a fetch carries the owner's session cookie. Only the owner can upload, so the
shape of this is not a stranger's attack — it is the booby-trapped icon set you downloaded
and used as a logo. SVG responses now go out sandboxed. Used as an image on a page, nothing
changes: an `<img>` never ran script in the first place.

### Buttons sized for thumbs

Six controls in the admin — Export CSV among the analytics, the taxonomy tools, Copy URL
and Delete in the media library, the tour's "Got it" — were exactly as tall as their own
text: 16 pixels, on screens where a fingertip is 40. Each now has a full-size hit area
without its ink moving a pixel, and the checkboxes — where a browser silently ignores
padding on the native widget — carry their label as part of the target.

### A meta line wraps between its facts

At phone width the reading time on every card could break in the middle of itself — "4" at
the end of one line, "min read" opening the next — and a date could split across its own
comma. Each fact now holds together, and the line breaks between facts.

### Two untrue sentences, and line endings

The self-hosting guide's systemd unit produced an install that would never have been
counted, because the update check originally demanded an environment variable the unit
never set; the check now recognises a real install by what it is rather than by a
declaration, so the unit works as written. The schema doc claimed there was exactly one
place that assembles SQL from a variable when there were two — the second, `vacuum into`,
is now documented at both ends. And the repository pins its line endings: 98 files carried
a mix of CRLF and LF, which made a one-line edit read as a rewrite.

## 2026-08-21 — Quire Ink 2.1.3

A day of editor bugs, all found by one person writing one post. The owner pasted a Markdown
article into the writing surface and got a white screen; every fix below came out of chasing
that, and three of them were found by the tests written to catch the first two.

Nothing here changes how the thing is installed or run. Still a drop-in: same install, same
settings, same database, no migrations, **no new environment variables**.

### Pasting a Markdown article now makes a post

It did not. Pasted text arrived verbatim — the headings kept their `#`, a table stayed a wall
of pipes, a fence stayed three backticks — and it saved worse than it looked: the serializer
escapes what it is handed, so the draft that reached the database read `\# Heading` and
`&gt; quote`, and the post published as its own source code. One option in the Markdown
extension had never been switched on. A paste inside a code block, and a paste made with Shift
held, still arrive as plain text, which is what both gestures mean.

### The editor stopped going blank, twice

Both were the same shape of mistake in the pen's own Markdown rules, and both ended the same
way: a throw inside the parse, inside a React render, and an admin that unmounted itself into
a white page with nothing in the console that a writer could act on.

**`**bold** and ==ink==` in one paragraph.** The rule that parses a stroke's contents handed
the nested parse the token array the outer parse was still holding indices into; markdown-it
finishes an inline pass by splicing that array, every recorded index shifted, and the next
lookup threw. Emphasis BEFORE the stroke was required to reach it, which is why `==ink== and
**bold**` had always been fine and nothing anybody wrote deliberately ever hit it.

**A stroke inside a link label** — `[**@@Quire Ink@@**](https://…)`. markdown-it scans a link
label by running every inline rule in silent mode and then checking that a rule which claimed
a match moved the cursor. All three pen rules, and the inline maths rule, claimed without
moving. It needs the delimiter to be INSIDE the brackets, so a day of round-trip fixtures that
put the stroke beside a link walked past it.

### A page that fails no longer takes the admin with it

There was no error boundary anywhere in the admin, so any error thrown while a page rendered
unmounted the entire tree — sidebar, rail, everything. That is what turned a parser bug into a
blank browser tab. A failing page now becomes a sheet that says what happened, says the work
is still held on the device, offers to reload or to leave, and shows the error's own message
so a report can be more than "it went blank". It sits inside the canvas and outside the
sidebar, so the rail keeps working and leaving the page is what clears it.

### Tables stopped losing cells

Four of these, all of them a save rather than an edit, which means the writer does nothing
wrong and finds out later:

| Written | Saved, before |
|---|---|
| `\| $x^2$ \| hai \|` | `\|  \| hai \|` |
| a cell holding an image | the same, emptied |
| a cell holding an escaped pipe | one column fewer, and again on the next save |
| a merged cell, or a cell of two blocks | the literal text `[table]` — the whole table |

The first two are one cause: the serializer asked whether a cell had TEXT before writing it,
and a formula keeps its TeX in an attribute while an image is a leaf block with no text at
all. The third is that a pipe inside a cell was written bare, so the next open re-cut the row.
The fourth was a fallback that replaced an entire table with seven characters — reachable by
pasting a table from a web page, by pressing Enter inside a cell, or by deleting the header
row with the button that offers to. A table Markdown cannot express is now downgraded rather
than deleted: the shape is lost, the words are kept, the columns stay aligned.

### A list that mixes bullets and checkboxes stopped growing

`- một` / `- hai` / `- [x] ba` is one list in Markdown, and the whole list was being marked as
checkboxes because one item was. The two plain items were lifted out, the empty checkbox list
that remained had to be given an item, and the post gained a `- [ ]` nobody wrote — which
parsed on the next open as an empty task item, saved as `- \[ \]`, and grew from there. The
runs are now split into a list each, in the order they were written.

### Publishing reaches readers immediately

Measured from the owner's own publish: nine seconds passed between pressing Publish and the
CDN being told to drop its copy, because the purge was the last step of a walk that re-renders
every public page — 79 pages, 6.5 seconds, a number that grows with the archive. Meanwhile the
manual "Clear cache" button did it in 183ms. The two jobs were never one job: the warm is for
origin latency and can take as long as it likes, the purge is what makes readers see the new
post. The purge now fires about 50ms after the write; a bulk import still purges at most
twice.

### A link is underlined by the pen, in dashes ([ADR 0028](docs/decisions/0028-a-link-is-a-pen-gesture.md))

A body link was invisible, and measurably so: `--c-link` against body text is 1.24:1 on the
default palette and never reaches the 3:1 that colour-as-the-only-cue wants, while the
hairline under it sat at 1.16–1.33:1 across all twelve palette-and-mode pairs. Colour set
darker and a heavier weight were both built and refused by measurement. A link now carries the
mark a reader draws under a line they mean to come back to — dashes, tiling rather than
stretching, so a longer link gets more of them rather than bigger ones, and visibly not the
solid `++underline++` a writer draws. It costs 0.99 KB gzipped and rides in the sheet every
page already loads.

### How the editor is tested now

The two blank pages were found by the owner, not by 1,485 tests, and the reason was
structural. `golden/corpus/` holds 45 Markdown fixtures and this project has two parsers —
one for the reader's page, gated by the golden compare, and one for the WRITER'S page, which
had never been handed a single fixture. Half the software was untested against the corpus.
And every fixture written for the pen tested one gesture in one sentence, while both bugs
lived in combinations.

So the corpus now runs through the editor as well, alongside 186 generated cases — six
gestures against sixteen containers, including the two that mattered: after emphasis, and
inside a link label. The law asserted is a fixed point rather than an exact string: opening
and saving may normalise, but a document that keeps changing every time it is opened is
silent corruption on a timer, and a parse that throws is a white screen. That suite found the
table bugs on its first run. A post containing every shape that has ever broken the editor is
also opened in a real browser by the tour and saved twice, because a DOM shim never mounts
React the way a browser does and both white pages ENDED in React.

1,736 tests, sixty browser flows.

### Docker Hub, for the people the image exists for

The image is published to Docker Hub as `quireink/quireink` as well as GHCR — the same bytes,
built once and copied, so a version number cannot come to mean two different images — because
GHCR cannot be searched from a Synology or QNAP container UI at all. Its page had an empty
description, no overview and no category, which is what Docker Hub's search reads, so the
image was unfindable for exactly the audience it was published for. Both READMEs and the
self-hosting guide now lead with a pull rather than a clone-and-build, and name the NAS case
where a NAS owner will look.

## 2026-08-21 — Quire Ink 2.1.2

**This release replaces 2.1.1, which is withdrawn.** 2.1.1 shipped on 2026-08-20 and lived
one day. It was not wrong about anything it set out to do — the pen work below is its work —
but it went out with book mode already dead on current Chrome, and it had no way of knowing:
nothing in this project tested that path. 2.1.2 is everything 2.1.1 was, plus the fix, plus a
day of work the same review turned up. There is no reason to run 2.1.1, and its tag and
release are gone; upgrading from 2.1.0 or earlier lands here directly.

Still a drop-in: same install, same settings, same database, no migrations, **no new
environment variables**.

### Book mode was broken on Chrome 148, on every install

Every article opened in the reader showed "1 / 1" and both arrows were dead. Chrome stopped
treating a multi-column element's overflow columns as scrollable overflow — measured, the
flow reported 3,964px of content while its scroll container reported 279px, and an assigned
`scrollLeft` snapped back to 0 — so the count was taken from a number that had gone blind and
every turn was a no-op. Chrome then also stopped **painting** those columns, so the first fix
produced a blank second page with the words laid out and undrawn.

Turning a page is now a transform on the flow under a clipping viewport, the count reads the
flow's own width, and the flow is sized to hold every column as a real column box, because
real columns paint. Two browser tour flows pin all three, desktop and phone. The tour had no
book-mode flow at all, which is how a dead feature stayed green through fifty-seven checks.

### The pen learns to draw like a hand ([ADR 0025](docs/decisions/0025-the-pen-varies-itself.md), [ADR 0026](docs/decisions/0026-the-pen-learns-to-underline-and-ring.md))

Carried from 2.1.1 unchanged. It began with photographs: a notebook and two textbooks full of
real highlighting, put next to the demo with the verdict that the demo's strokes looked
machine-stamped. They did, for a reason the code could name — every highlight was one SVG die
stretched to fit, and the jitter meant to hide it counted siblings, so on a site where most
paragraphs hold one highlight it never fired. A page of twelve highlights wore one silhouette
twelve times.

Stroke shapes are now **grown from a seeded generator, not drawn**: ten dies varying tilt,
weight, edge tremor, chisel ends, an occasional taper where the pen lifted, a dry lane where
the felt split, pooled ink along the top edge, a darker spot where the pen was set down — and
forty grips deciding how each stroke sits on its words. Which variant a highlight wears comes
from a hash of its own text, so it is scattered across the page and stable across re-renders:
a page that reshuffled its ink on every visit would feel haunted rather than hand-made.

**Two more gestures.** `++text++` draws a pencil underline — bow, droop, taper, sometimes a
second re-inked pass — and `@@word@@` rings a word in red ballpoint. Both take `#green`-style
suffixes in ballpoint-strength versions of the five inks, because a thin line in the
highlighter's pastel pigment all but vanishes. The ring is two caps at a fixed width and a
middle that does all the stretching, so the curves stay hand-sized around any word. Both are
owner toggles (Settings → Reading), on by default, CSS only.

**The three-way stroke setting (marker / swipe / double) retires.** A pen that varies itself
leaves a picker between three uniformities nothing to do. Saved settings keep working.

**The U button stops losing work.** It applied StarterKit's underline mark, which has no
Markdown serialization, so every save dropped it silently — since the editor first shipped.
The editor owns `underline` now: same button, same Mod-U, saved as `++text++`.

### The pen ships only to the pages where it wrote ([ADR 0027](docs/decisions/0027-the-pen-ships-only-where-it-wrote.md))

All that ink cost bytes: 280 SVG data-URIs had grown to roughly 21 of the public
stylesheet's 29 KB gzipped, paid by every page including the ones with no ink on them. The
ink now ships as two hashed, immutable sheets of its own, linked render-blocking but only on
pages whose HTML actually contains a mark or an underline. `site.css` falls **28.7 → 7.6 KB
gzipped**; a page with no ink drops 21 KB and roughly 260 KB of CSS parse; a highlighted post
pays less than the old single sheet, across parallel cached requests. Deferred loading was
rejected: it shows bare words for a beat before the ink lands.

### The page reads like a set book

**A font swap that moves nothing.** Every text family now declares a metric-matched fallback —
the local face its stack falls back to, reshaped to the family's own measurements — so when
the web font arrives, glyphs change and line breaks do not. Measured across all four
families: 1,200 characters at 640px set the same 17 lines in Literata and in its fallback,
where bare Georgia set 16. The swap used to cost a full line of reflow.

**Hanging punctuation** hangs an opening quote into the margin the way a set book does, and
**hyphenation limits** stop justified text breaking words a compositor would refuse.

### Book mode: the reader's hand on the type, and fresher paper

The scale was one fixed number and read large; it is a touch more generous than the article
now, and **A− / A+** in the reader's chrome move it between 0.85 and 1.35, remembered per
browser. The paper was pulled hard toward yellow with a heavy grain — together an impression
of foxed stock rather than a classic page. It is a quiet warm ivory now, the grain is felt
more than seen, and the drop cap, the asterism and the spine all stay.

### The phone reads with its thumbs

Book mode kept the desktop's 48px side margins on a phone — a quarter of a 375px screen spent
on air. A phone page is the glass less 20px a side now, the mouse-sized arrows retire, and
pages turn by swipe or by a tap in the outer thirds, with the middle third left as a safe
place for a thumb. The reader also finally has a **way in on a phone**: both desktop entries
hide under 768px, so a working one-page book mode had no door. A floating button, twin to the
back-to-top circle and appearing on the same scroll, is it. The sidebar drawer's rows were
stacking a desktop gap on top of touch padding and sat about 27px apart; they close up.

### The owner picks what a first-time visitor opens in

Light or dark was the visitor's laptop and nothing else: a blog could not BE dark or BE
light, only mirror whoever was looking. **Settings → Appearance** now carries System / Light /
Dark above the palette grid. A reader who has chosen for themselves is untouched in every
case. New installs also start in Literata rather than the sans.

### Docker: bind mounts work, and the image is finally verified

The Docker path had no verification of any kind — the `Dockerfile` appeared in no test, no
tour flow and no workflow. Measured on a Linux daemon: a **root-owned bind mount**, which is
exactly what a Synology, QNAP or Unraid container UI produces, killed the container on boot
with `SQLITE_CANTOPEN`. The docs claimed it merely came up degraded; that was wrong.

The image now accepts **`PUID` / `PGID`** (1000:1000 by default, so nothing changes for
existing installs), adopts the mounted directories only when their ownership is actually
wrong, and drops privileges before the app starts — the app never runs as root. CI builds the
image and boots it twice, on a named volume and on a root-owned bind mount, and asserts the
process is unprivileged.

### Smaller things

A production-dependency stage, so a source-only change stops re-resolving the whole tree.
Two admin rows that lined up with nothing, and one `ResetButton` in the kit instead of three
hand-written copies that had already drifted. An audit pass over every markdown file after a
day that moved the pen's delivery, the fonts, book mode, the first paint and the install
defaults: fourteen confirmed drifts, corrected.

## 2026-08-18 — Quire Ink 2.1.0

**Thirty commits since 2.0.3, and nearly all of them are one project: the admin rebuilt
around writing** ([ADR 0024](docs/decisions/0024-the-admin-is-rebuilt-around-writing.md)).
2.0.3 made the admin look like the product; this release makes it *behave* like one — a
writing desk, not a control panel. It ran the way the last redesign should have: a mock
first, the owner's verdict on the mock, then the code page by page against it, and the
owner writing on each cut and ruling again. A dozen of these commits exist only because he
sat down to write and circled what was wrong. The mock's two ideas now hold everywhere: the
screen you write on shows the list of everything written beside the paper, and every other
screen is **one sheet per page** rather than a scatter of cards on a canvas.

The upgrade is a drop-in: same install, same settings, same database, **no new environment
variables**. The one schema change is a search index for pages (`pages_fts`) that the
database creates by itself at boot, the same way every migration here runs. The reader's
pages did not move a byte — every bundle, stylesheet and font is identical to 2.0.3 —
because all of this is the owner's side of the house.

And the project has a front door now: **[quireink.com](https://quireink.com)** is the
homepage — three static pages, no process behind them, which is the product's own taste
applied to its marketing. **[demo.quireink.com](https://demo.quireink.com)** remains the
running build, its bar now linking back to this repository.

### The admin could not find a sentence the owner remembered writing

That was the first defect of the run, and it set the theme. The content screen's filter
matched title, tags and categories — over the array the page had already been handed. The
body text was never in the browser, so a phrase from inside a draft returned nothing, and a
draft is what the box is most needed for.

The index had existed the whole time: `posts_fts`, FTS5 over title *and* body with
`remove_diacritics 2`, serving the reader's `/search` since the port. The admin simply
never asked it anything. Now it does, with the reader's two filters removed, because the
person typing wrote the drafts and is allowed to see them. **Pages join the same index**
(the release's one migration), since the admin's one list holds both. The box keeps its
instant title match and adds the server's body match behind a 180ms debounce — and a row
that matched on its body **shows the passage it matched in**, because without that line it
looks like a row that matched on nothing. Typing `gioi thieu` finds "Giới thiệu"; the
verification flow types a phrase that appears in no title and must land on the post that
carries it in its body.

### Four drawers became one list

Posts · Pages · Taxonomy · Series stood as four equal tabs, and the owner's verdict was
that it read as WordPress. The mechanism behind the feeling is specific: to look for
something you had to decide which drawer it was in *before* you could look, and two of the
four drawers were not content at all — renaming a category and ordering a series are
maintenance, done rarely, taking a quarter of the screen's attention daily.

Now it is one stream, posts and pages together, most recently touched first. They already
shared the `/{slug}` namespace and the search index; the split only ever existed in the
screen. Each row carries a line of the writing under its title — the excerpt normally, the
matched passage while searching. The date column says "Last touched" in six languages,
because that is what it holds; a column headed *Date* showing the last save is a small lie
repeated on every row.

### The editor asked its questions first

The old writing surface put twenty-four buttons over the text, five of them an exact
duplicate of the bubble bar that has always appeared on a selection, and opened the full
attributes column — slug, date, status, terms, series, two image pickers, SEO — on every
load, asking while the writer was mid-sentence and taking 340px of the width.

The attributes are **closed** now, and the first Publish press opens them *instead of
publishing*: every field already carries an answer, so it is a review, not a form.
Publishing again publishes. They slide in from the right over a scrim, footered
Later / Publish, deliberately narrow because the fields are a column of short answers. And
the sheet draws **its own calendar**: `<input type="datetime-local">` popped the browser's
blue popup into a monochrome admin, and no stylesheet can reach that popup. The new field
keeps the native value — every caller and save path untouched — but the grid is
Monday-first from `Intl`, the picked day is the admin's black pill, and today is a hairline
ring.

### The toolbar left, and came back the size the owner ruled

The mock-faithful cut removed the toolbar entirely: `/` on an empty line raises the insert
menu at the caret — image, gallery, table, code, the two formulas, divider, and the block
types with their Markdown shortcuts printed beside them, so the menu teaches the gesture
that makes itself unnecessary. Then the owner wrote in that editor for an afternoon and
ruled three times, and each ruling was applied as said: the **formatted view gets the full
button row back** ("ở chế độ bình thường nên có thanh công cụ chứ"), at the top of the
sheet, full width, wrapping on a narrow window instead of hiding half its controls behind a
horizontal drag, with the buttons grouped in the middle. The Markdown view stays bare —
raw text formats itself, so a strip of formatting buttons over it is furniture. The switch
that gets you there is spelled "Markdown", sits beside Attributes in the action line, and
while it is on the editor draws no toolbar at all. `/` and the selection bubble remain:
two doors, same rooms.

The chrome became one piece on the way. The action line — back link, save state, word
count and reading time, the three buttons — is the sheet's **own** top row, the toolbar
attaches directly beneath it, and the two stay joined while scrolling. The title sits on
the paper itself, with status and last-touched under it. Recovered work folded into the
action line as a sentence with two links, Restore the darker of the two because it is the
one that rescues somebody's words. Every clipped scroller — tag cloud, slide-over,
combobox, the `/` menu — fades at its cut edge, because a hard crop mid-row reads as
broken and the fade says *there is more*. And the bug the owner found by writing: selecting
the **first line** of a post put the bubble bar under the sticky toolbar, covered and
unclickable — the one sentence he could not format was the opening one. Fixed, with the
regression flow watched red first.

### The write screen: the list beside the paper

`/admin/content` is not a dashboard anymore; it is the write screen, and it is two panes.
The left pane is the writing itself — the one list, its body-reaching search, and one dark
New post button — riding beside **both** editors from wide windows up, marking the row you
have open. Below the wide breakpoint the sheet takes the room and the list is one "← Write"
away. Focus mode used to hide all navigation while writing; the rail stays now, because
the owner circled it on the mock.

Then he used it, and four more verdicts landed in one sitting. The three scope tabs grew to
**five** — All · Pages · Posts · Published · Drafts, a kind family and a status family on
one row — and they hold that one row in *all six languages*, each locale given its own
deliberately short words, the row stretched flush to the pane's edge instead of stopping
short of it. Scrolled, the pane and the sheet pin at the same top instead of two offsets
24px apart. The date beside a published post is its **publication** date — the last save
there read as a wrong publish time — and a quiet button cycles the sort between
last-updated and date-created. Taxonomy and Series, which had ended up below panes that
had just grown to window height ("a door nobody can see"), became quiet tools on the
pane's own sort line, opening as slide-over sheets from the right.

### Eleven doors, when the owner came to write and to see how it went

The rail listed eleven destinations, so the first screen of a writing tool asked for a
decision about drawers before it offered either the writing or the reading. **The rail is
four now** — Home, Write, Library, Newsletter — and everything else lives behind one
"Everything else" button that opens *itself* when the current page is one of them, because
a rail that hides where you are would be a worse fault than a long one. Nothing was
removed. The group **remembers the owner's choice** across sessions: an explicit click on
the row persists, while the visit-driven opening never writes — only the owner's own hand
records a preference.

Analytics could leave the rail because its numbers moved to the home screen: the Traffic
card carries views, visitors, time per post and read-through over the window it names once.
And the writing comes back before anything else does — **"Pick up where you left off"** is
the four most recently touched unfinished pieces, each chip a click from the cursor, with a
door to the rest when there are more. The administration counts — posts, pages, comments,
images, storage — moved below the widgets; they are inventory, and inventory is what this
rebuild moves out of the way.

The rail also learned it has **two registers**. The footer's controls — theme, Clear
cache, Sign out — wore the same row dress as the destinations above them, so the rail read
as nine pages, one of them apparently named "Light". Controls are smaller and quieter now,
at control radius; destinations keep their size. The theme menu itself had two faults with
one cause each: its items were 16px in a 14px rail (a public type role that resolves to
nothing in the admin), and it floated under the content, because a sticky rail is its own
stacking context and the later sibling painted over it. It opens upward *inside* the rail
now, at rail size. And the "Show icons" switch moved into Everything else — a set-once
device preference does not need a permanent footer row — and it governs the whole rail,
footer glyphs included, by the owner's ruling.

### Mỗi trang một tờ — every page is one sheet

The mock's second idea, applied to the seven remaining pages plus the activity log, each as
its own commit. Four laws, held by shared primitives rather than by discipline: the page is
**one full-width sheet**; a page's tools live on the **sheet's own first row** — tabs,
search, counts, the quiet dangerous verb; headline numbers **stand directly on the paper**
in a band, not in little boxes; and lists of short rows fill **two newspaper columns** with
a hairline rule between them, one column on a phone. Every page is the same width on
purpose — "tôi cũng không muốn chiều ngang trang có cái bự, có cái nhỏ".

- **Library** went first and carried the primitives in: kind tabs on the sheet's first
  row, the tab's own toolbar (count · search · sort) bleeding to the sheet's edges as a
  second chrome row — the editor's two-row chrome, worn by a library — and the intro
  sentence demoted to the sheet's closing small print.
- **Analytics** stopped floating seven cards: the range strip and the privacy note share
  the first row, the five headline numbers stand in the band with their trend arrows and
  the new/returning split riding along, and all seven top-lists went bare — columns
  divided by vertical hairlines on the sheet itself. Export waits quietly in the page
  head.
- **Comments became the reading queue.** Each comment is two lines of its own text — click
  to read in full — with the whole ledger (who, where, when, from what address) as one
  line of small print underneath and Delete as a quiet word at its end. The six-column
  spreadsheet is gone. The queue gets the admin's search, over text, name and post title,
  its hits painted with the pen.
- **Newsletter**: three counts on the paper, the SMTP warning as a full-width line, and
  the subscriber list as one-line ledgers — the address is the thing, the log's facts
  follow as small print, and the dot ahead of a pending address is the pen's edge tone,
  the list's own work-in-progress.
- **Trash**: kind tabs with their counts, "empty this kind" as a quiet tool beside them,
  and one row shape carrying posts, pages, media, files and comments alike — the thing
  first, then the deletion date and the two verbs that decide its fate.
- **Settings**: the tabs and the search that reaches past them share the first row, and
  all 26 cards became hairline **panels** — one radius step under the sheet's, title on a
  ruled header row — so a tab reads as sections of one page instead of boxes on a canvas.
  The always-reachable save bar stays fixed, because a footer Save on a tab three screens
  tall is a Save nobody can reach.
- **Help** is prose, so the guide packs its sections as hairline panels in two columns —
  the owner's ruling, after a centred reading column was tried first.
- **The activity log** became two columns of one-line ledgers — time, an action chip, the
  detail — with its count and Clear on the first row. An error is an inverted monochrome
  chip, not a red badge.

### Monochrome, plus exactly one colour

The Writing Desk mock is not monochrome — it carries exactly one colour, the product's own
highlighter, and the build had left it out entirely. **The pen arrives** in its three
places: a search hit wears it as a mark, folded per *character* so the indices survive
Vietnamese diacritics; the dots that mean work-in-progress — a draft's row, the unsaved
state, the unfinished chips on the home screen — are its edge tone; and dark mode uses the
mock's own dark pen values. A second use of colour would spend the only signal that means
"your words", so there is none.

The style sweep around it was audited two ways — computed styles read out of the running
admin, page by page and settings tab by settings tab, then a grep of the classes — and
fixed what either found. The 12px radius tier existed nowhere in the contract and eight
places in the code; it is gone, and the ladder is three steps: sheet, panel, control. Two
in-page shadows died (the admin draws none except on overlays). The last two reds left the
monochrome admin — the error card carries a strong border and a "!", the backup-delete
link carries the word itself.

### Every admin screen fits a phone, and the check that proves it

One tour flow per screen now asserts, at 375px, that the whole document is no wider than
the window — and names the widest element when it is not. All of them were watched fail
against a deliberate sabotage before being trusted, and the first clean run caught a real
one: analytics scrolled sideways by 36px, because the range strip sat in a row whose
comment *said* it wraps and whose classes did not. The browser tour is 57 flows now, up
from 40 at 2.0.3.

### The README starts with a reader, and the licence stops turning operators away

The README's second line was "One process. Two SQLite files." A person who writes and does
not deploy stopped there, and everything below was written for somebody who already knew
what those words meant. "What it is" now opens the page in nine plain sentences — what it
is like, that you change it by clicking, what a post costs a reader, what an AI can do for
you, what you need to start, and what you take on in exchange. The technical opening is
intact one heading below, in both languages.

And the licence said no to the wrong people. The relicense had been written on the
sentence "nobody may make money from it", which blocked a host that installs published
releases and sells the operation of them as firmly as it blocked the fork-and-rename it
was written for. Only the second was ever the point.
[`LICENSE-EXCEPTION.md`](LICENSE-EXCEPTION.md) now grants commercial use of a **published
release run unmodified**, on four conditions: notices stay, credit and no passing off,
sell the service not the software, and security fixes only, reported within 30 days.
Commercial use of a modified copy still needs asking
([ADR 0023](docs/decisions/0023-commercial-use-of-unmodified-releases.md)).

### The demo grew pictures, and the docs caught up

The five seeded posts on the demo now carry their plates in the prose — the nib angles in
the pen post, the imposition sheet and registration target in the press pair, the
modular-scale bars and the return-sweep diagram in the reading series — so the library and
the reading page have something real to show, and the pen post closes with an exercise
anyone can do with two pencils. The README's admin picture was reshot from the sheet-era
admin, and [`docs/admin-design.md`](docs/admin-design.md) plus the feature docs describe
the admin that exists rather than the one that used to.

*57 tour flows, 1416 tests, and the seven build guards, all green before the tag.*

## 2026-08-15 — Quire Ink 2.0.3

**Forty-three commits since 2.0.1, and 2.0.2 is folded into this one.** 2.0.2 went out on 10
August and stood for five days; everything it shipped is in this release, and its notes are
below under the line rather than summarised. There is one release to read and one to install.

The thirty-four commits since 2.0.2 split in three. Eleven are a pre-release audit of jobs this
software had left to somebody else — it had no upload cap, no storage quota, no bind address
the server would admit to, and nothing at all holding the one rule the whole design rests on,
one blog and one owner. In each case a reverse proxy, a firewall rule or a habit had been
covering, which is exactly why none of them had ever shown. Then the admin, which had
stopped looking like the product it belongs to. Then a run of defects the owner found by using it: a false 404 on a rename, a focus ring drawn for the wrong kind of control, and code blocks that were neither blocks nor coloured.

**Four new environment variables across the two, and one of them changes what an existing
install does at boot** — read the first entry before upgrading. `HOST`, `MAX_UPLOAD_MB` and
`STORAGE_QUOTA_GB` are new here; `TRUST_PROXY` arrived in 2.0.2 and almost nobody needs to set
it. The upgrade is otherwise a drop-in: same install, same settings, same database.
### The server listened on every interface, under a log line that said it did not

`Bun.serve` with no `hostname` listens on `0.0.0.0`. The line printed underneath it said
`127.0.0.1`. Measured across four running instances, every one was bound `*:port`, and nothing
was reachable only because a firewall rule said so — a defence one rule deep, sitting under a
log that told whoever checked the opposite of the truth.

**`HOST` now exists and defaults to `127.0.0.1`**, and the boot line prints what `Bun.serve`
came back with rather than what the code hoped it did. Every layout in
[`docs/self-host.md`](docs/self-host.md) puts the proxy on the same box, so loopback is right
for all of them.

**If your proxy is on another machine, or the process runs in a container that has to be
reachable from outside it, set `HOST=0.0.0.0` before upgrading.** The bundled Docker image sets
it, because inside a container loopback is the container's own.

### Nothing in this software refused an upload

The only byte limit anywhere in the tree belonged to the WordPress importer. What actually
refused an oversized image was `client_max_body_size` — whatever the operator's proxy happened
to say, and nothing at all if there was no proxy.

**`MAX_UPLOAD_MB` (default 64) and `STORAGE_QUOTA_GB` (default 5)**, enforced in the storage
driver rather than in a route, so a route that forgets cannot write past them. The owner gets
two admin fields that can **lower** either number and can never raise it: the environment is the
ceiling, the setting is a preference, and `0` on either side means "no cap from me".

Refusals happen before the bytes are read rather than after: `413`, with `file_too_large` or
`quota_exceeded`. The worst of the six byte paths was the MCP tool `add_media_from_url`, where
the bytes arrive on a fetch the server itself made and no proxy has an opinion at all — it
buffered a whole remote body into memory, and now stops reading at the cap.

### Five advisories sat in the lockfile and nothing was able to see them

`bun audit` found five, one of them high, while the repository's alert list was empty. GitHub
builds its dependency graph from `package.json` — 34 packages, exactly the direct dependencies —
and never parses `bun.lock`. So no indirect advisory can produce an alert, and a direct one
cannot either when the caret range permits a fixed version the lockfile is not on.

**`bun audit` runs in CI as its own job** and fails the build on a finding. The five are
cleared: `hono` 4.13.1, `nodemailer` 9.0.5, `marked` 18.0.9, `shiki` 4.4.3, and `fast-uri`
pinned through `overrides` at `^3.1.5` — inside the major `ajv` declares, because `bun update`
on a transitive package writes it into `dependencies` and jumps to 4.x, which fixes an advisory
by breaking the library that consumes it. None of the four `hono` advisories was reachable from
this code, which was established before the bump rather than assumed after it.

### One owner was the design, and nothing in the software held it

Any row in `users` holding a session is the owner: there are no roles and no per-user scoping
anywhere, by design ([ADR 0002](docs/decisions/0002-no-saas-single-instance.md)). The CLI would
still create a second account, and a second account on this schema is not two users — it is two
people sharing one identity.

`createUser` refuses when an account already exists. Its test-only escape hatch is honoured
**only** under the test runner, so a signup route written against it would pass its own tests
and refuse in production, which is the failure mode worth having.

### There is no compiled binary, and `bun run build` stops implying one

The last open question from the 2.0 rewrite, now
[ADR 0022](docs/decisions/0022-ship-from-source-not-a-compiled-binary.md). `bun build --compile`
bundles `sharp`'s JavaScript and not its native module, and both halves of the old note turned
out worse than it said: the binary does not throw on the first image call, it **dies on the boot
path before it ever listens**; and "one executable plus a native module directory beside it"
does not exist as an option, because `sharp` resolves from the bundle's own `/$bunfs/root/…`
path, so the real `@img/*` copied next to the executable fails identically.

`bun run build` now builds the two artefacts that actually ship — the island bundles and the
admin SPA — and nothing else. It had been emitting `dist/quireink` under a note saying not to
deploy it "yet"; anybody who deployed it anyway was deploying something that has never worked.
Quire Ink ships as source run by Bun, which is what the Docker image and every documented
layout already did.

### A feed and a sitemap full of `http://localhost:3000`, with nothing saying so

`SITE_URL` unset does not "derive per request" — a comment claimed that for months while nothing
derived anything, and the real answer was `http://localhost:3000` in every canonical tag, feed
and sitemap. It stays a constant deliberately: the page cache is keyed by path alone, so one
request carrying `Host: evil.example` would poison the sitemap for everyone. Deriving it is
cache poisoning with extra steps.

What changed is that the absence is loud — a `[WARN]` at boot naming the variable, and an admin
hint that says what breaks rather than what to type, in all six languages.

### Readers can pick a palette, and a blog ships only the palettes it enables

Six palettes have shipped since 2.0 and no reader could reach any of them: the switcher was
never ported from 1.x, so `enabledPalettes` was a setting with nothing behind it while the CSS
for all six sat inline on every page.

`themesToCss` now takes the enabled list. Below two enabled it emits **no** `[data-palette]`
rules at all, because the switcher hides itself and `:root` already *is* the palette. Measured
on a served page: one palette is 0 rule blocks and 35,662 bytes, six is 12 blocks and 37,432 —
**1,770 bytes raw and 423 gzipped off every page load**, in the inline half of the stylesheet
that no cache spares.

And the switcher is ported, so enabling one now means something: 564 bytes, after the theme menu
and the palette menu were made one `dropdown()` rather than two. The reader bundle budget moved
8,800 → 9,600 as a decision rather than a nudge mid-fix, and both READMEs moved with it — the
reader's JavaScript is 3.6 KB gzipped on a listing and 7.8 KB on a post.

**Driving it in a browser found a bug no test would have.** Both header controls sit in the same
corner and each stopped its own click from reaching the handler that closes menus, so the theme
menu and the palette menu could be open at once, overlapping. Neither was wrong alone. Opening
one now closes the others.

### The editor's save bar never mentioned the copy on your own disk

The local draft snapshot has been written since 2.0 — on an interval, and again on leaving,
hiding or unmounting the editor — and the bar only ever spoke about the server, so `unsaved` was
displayed over work that was already on disk. A feature that exists and says nothing reads as a
feature that does not exist, and this one was asked for twice.

`autosaveSeconds` is a setting now (default 120, floored at 15) and the bar has a fourth state:
"kept on this device at HH:MM". The floor is the reverse of the obvious worry — a long interval
is safe *because* the leave, hide and unmount flushes exist, while a very short one would make
the interval the whole safety net again. It is still not a server autosave, for the reasons in
`useLocalDraft.ts`.

### Motion durations are three tokens instead of twelve literals

Twelve declarations across three files carried four values for three intents, and `.13s` next to
`.15s` is the same idea written twice — the drift a token set exists to stop. `--dur-fast` .15s,
`--dur-base` .2s, `--dur-slow` .5s. No `--ease` token: its value would be the keyword `ease`,
and the scroll-driven animations must stay `linear`. The sign-in page keeps its literals because
it never receives the public stylesheet, where a `var()` resolves to nothing and drops the
transition silently.

### `bun run tour` — thirty-six flows in a real browser, with a verdict each

`check:all` proves the code compiles and the seams hold. It cannot tell you that a column
collapsed, or that a control the owner switched on has nothing behind it; both of those have
shipped. The tour seeds its own instance on its own port, drives one browser through the
reader's controls, every admin page, a draft saved and published and trashed and restored, an
upload refused for being too large and an archive built — then deletes everything it made.

First run was 32 of 36, and **all four failures were the tour's own assumptions rather than the
app's behaviour**: a category link mistaken for a post link, the Help page reported broken
because its troubleshooting table mentions a URL that 404s, and two API routes that do not
exist. That is the honest result for a suite written this late, and the wrong assertions were
the useful part — a suite that cries wolf is worse than no suite, so the admin's not-found state
is now readable as a fact instead of being detected by the word "404" appearing on a page.

### The backup had never been opened, only weighed

The tour's backup flow read the first two bytes of the archive and confirmed a gzip member.
That proves an export happened; it says nothing about whether the owner's blog comes back out
of it. Both failure modes this project has actually met are invisible to that check: a
snapshot taken as a file copy captures a torn write-ahead log that only appears on restore,
and the uploads tree has been written to one path and read from another for months with
nothing going red.

`bun run tour` now ends with **`bun scripts/restore-check.ts`** — outside the browser,
because a page cannot untar an archive or open SQLite. It downloads the export, extracts it,
and asks the four questions the manual procedure in [`docs/backups.md`](docs/backups.md) asks:
both databases pass `integrity_check`, every table holds at least the rows it held before the
snapshot, every upload is byte-identical, and the archive carries all three members.

**It uploads one image first, and that is the point rather than a detail.** The seeded fixture
writes `media` ROWS and no files, and the tour deletes the image it uploads, so the uploads
tree is empty by the time this runs: `all 0 upload(s) are in the archive` would have passed
forever while proving nothing. An empty assertion is worse than no assertion, because it reads
as coverage. The probe is taken back out afterwards — and taking it out needs TWO calls, since
`/api/media/delete` is a soft delete that keeps the bytes on purpose.

Two things were found by writing it rather than by running it. Counting the live rows AFTER
the export reports the export's own `activity_log` row as data loss — the first run said
`activity_log 48→47` over a perfectly intact archive — so the counts are taken before the
snapshot and the assertion is one-directional. And the check was made to fail on purpose,
against a tampered file and a missing one, because a check that has never been red is a
decoration.

### The two queued compiler flags, measured and declined

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` were both queued for "once the
port is finished". It is finished, so both were run — and both are declined, on the rule
`noImplicitReturns` was declined under: a flag you work around teaches people to work around
the compiler.

97 findings and 37 respectively, and every non-test file carrying more than one was read.
Not one was reachable at runtime: capture groups read after `.exec` returned non-null,
`?? LIST[0]` on module-constant arrays that are never empty, `split()[0]`, a SHA-1 digest
indexed inside its own 20 bytes, and seventeen in one file from indexing a `Record<string,
string>` that the function above it fills with `''` for every key. The reasoning and the
numbers are now in `tsconfig.json` beside the flags, so the next person meets the measurement
rather than the queue entry.


### The admin was wearing the framework's clothes, not the product's

The owner's word for it was *rẻ tiền* — cheap. That is a fair reading of what was there, and
the fault was not workmanship: a grey canvas, rounded white cards, drop shadows and pill tabs
is the stock look every dashboard framework hands out, and none of it came from this product,
whose public side is paper and hairline rules. Twelve screens dressed as somebody else's
software.

So the vocabulary changed once, in the shared kit, and all twelve moved with it: a **paper**
canvas, sheets with a hairline instead of a shadow, a 10-8-6 radius ladder, and the shadow
reserved for something that genuinely floats over content. `check:admin-kit` gained a rule that
matches the SHAPE rather than the exact class string — a raised white surface on a shadow —
because six segmented controls had copied the tab strip's pill and every one of them differed
from the primitive by a single shade, so the existing check passed for months while the admin
carried seven of one control.

**One typeface.** The chrome font the admin borrowed from the site is gone; it is Inter and
nothing else, with one deliberate exception — the editor's writing surface and its title stay
in the reading face, because what you type there is what a reader will see. A test pins the
exception to four files by name, so a third face cannot arrive quietly.

**Sidebar icons are a preference, off by default**, remembered per machine. Collapse is always
available: a collapsed rail has no labels, so it always draws glyphs regardless of the setting.

Spacing was re-measured rather than re-guessed — the page rhythm went 32/12/12/24 to 40/16/24/24
— and two things the owner pointed at were fixed by measurement: the dashboard's stat tiles were
49% empty air and are now one ruled band, and two cards in a row sat 37px out of line at the
seam (0px now, top and bottom).

The version label reads `quireINK v2.0.3 (abc1234)`, linking to the **project** rather than to
the commit. The SHA is there to be read — does this match what was just shipped — and a
per-commit URL is a page nobody opens from a dashboard and 404s the moment a branch is rebased.

### Every admin screen downloaded a LaTeX engine

Measured on the Comments screen, which has neither an editor nor a formula on it: **212 KB
unpacked, 63 KB over the wire**, of Temml. Nothing was wrong with the code. `@/utils` needed
three regex helpers so `toPlainText` could drop a formula out of an excerpt, it took them from
`render/math.ts`, and an ESM import is not a menu — taking three helpers took the module, and
that module imports Temml at its top. Fifteen admin files import `@/utils`, so the bundler put
a LaTeX engine in the chunk every screen shares.

The grammar now lives in `render/math-syntax.ts`, which may never import a renderer; `math.ts`
re-exports all of it so the parsers that do render still ask one module for both halves. The
admin's first load drops from 682 KB unpacked to 470 KB, and the editor — the one screen that
actually renders maths — is unchanged.

### The front page's biggest slot was starved by a cap meant for a `<meta>` tag

An excerpt was clamped to 200 characters when SAVED. The front page's text kind then asked for
260 for its lead standfirst and could never be given them: the most-looked-at slot on the site
was bounded by a number chosen because search engines truncate a meta description past ~160.

Storage now keeps **280**, and each surface clamps again on the way out for its own reason —
the same shape `web/article.ts` already used for the share card. The demo's own standfirsts were
one line each and have been rewritten; they now run three to four.

### CJK stops being deliberately absent

The fixture said CJK was left out because no bundled subset carries a Han, kana or hangul glyph,
so it would "fall back to a system font and demonstrate the opposite of the point". That
confused what we SHIP with what the page RENDERS IN. Nothing CJK is shipped and nothing will be
— a CJK webfont is megabytes — but a stack that ends at the generic `serif` keyword hands the
choice to the browser's last-resort face, which differs on every machine and nobody picked.

The reading stacks now name PingFang, Hiragino, Yu Mincho, Malgun Gothic and the Noto families
before the generic, at zero download. And because 直 is one character drawn three ways, there is
one tail **per language** with `:lang(zh|ja|ko)` rules to select it, so a Japanese site is not
set in Chinese letterforms by whichever family the machine happens to have installed first.
The demo has three new posts — Chinese, Japanese and Korean — to prove it.

### The tour toured the wrong instance, and blamed the code

The tour serves its own seeded instance on port 3399, which is also the port a dev instance
runs on. With one already bound, the tour's server lost the bind, the health check was answered
by the OTHER instance, and forty flows ran against a database the tour never seeded: the
reader-side half passed on the same fixture, and all twenty-six admin flows failed `401` because
the session belonged to a different database. It reads as a specific, confident regression.
It cost an hour of bisecting one.

**The tour now refuses to start on a busy port**, before it builds or seeds. And the browser
binary is found rather than hardcoded: three scripts each carried the same Linux path, so on a
Mac the project's main verification tool opened with `ENOENT` on a directory with the wrong
platform in its name. `scripts/chrome-path.ts` looks in the places it is actually installed and
names the install command when it finds none.

### Renaming a draft and publishing it said "Not found"

The post saved, the address bar updated, and the shell then threw the editor away for a red
banner. Reported as *"mỗi lần sửa link bài nháp rồi đăng bài là bị Not found"*, and the post
was on disk the whole time.

A `router.refresh()` left over from the Next.js port, sitting after a raw `history.replaceState`.
The router keeps its own copy of the path and the raw call does not update it, so `refresh()`
bumped the epoch and the page re-fetched itself with the OLD slug. Its comment said it was
dropping "the client Router Cache (no stale RSC)" — neither of which exists here, and
`Route()` renders a different component per path, so every navigation already refetches on
mount. It bought nothing. `PageForm` had the identical two lines.

A tour flow drives the real form now and asserts all three symptoms at once. It was checked
against the bug put back, because a guard nobody has seen fail is not a guard.

### The Markdown source view, which had never been designed

Three things, and the first was a specificity accident rather than a decision: the textarea
asks for `outline-none`, `.admin-shell :focus-visible` is two classes, and the ring won — so
clicking into the source drew a 2px rectangle around a column 60vh tall. The rich editor has
had an explicit exception since it shipped; this surface never got one, and neither did the
post TITLE, which is the third and was found by photographing the second.

It was also set in Inter at 14px, so `##` and `|` did not line up. It is source: a mono face
at 15px on a 1.8 line now — the SYSTEM mono, under a name the site's own variables cannot
override, because measuring the obvious name first showed it resolving to a webfont and
undoing the admin's one-typeface rule for a mode most owners never open.

And the markers dim. A textarea cannot style part of itself, so the text is drawn twice: a
mirror underneath with `##`, `---`, `**`, `|` and the pen's `==` wrapped, and the textarea
over it with its own text made transparent. It stays the only source of truth — caret,
selection, undo and every keystroke are its own — and the mirror is `aria-hidden`.

### A code block was not a block, and a bare fence had no colours

`pre` carried padding, a radius and an overflow rule and no background, because Shiki writes
one as an inline style — and `vitesse-light` writes `#ffffff` on a `#fcfcfc` page. So a code
block was a white rectangle on a near-white one: the radius had nothing to round, the padding
read as an indent. Worse, that hex is baked into HTML cached under a hash of its Markdown, so
it outlived every palette a reader can pick. The panel comes off the palette now, with the
hairline the tables already use.

Then the colours. A fence that names nothing highlights as `text`, which has no tokens, so the
colour was only ever there for blocks that remembered a word after the backticks. Two answers,
and both were decided by measuring:

- **A guess, and a timid one.** Terminal output is the commonest untagged block there is, and
  colouring stray words inside an error message looks broken. Every rule needs a signal prose
  cannot fake — a shebang, two command lines, shell syntax, an executable path with a flag, an
  SQL verb, a quoted key. Below that bar it stays `text`.
- **When the guess declines, mark what is true anyway.** Forcing a grammar was tried and
  rejected on evidence: through `bash`, Shiki coloured `id` and `nếu` as commands and swallowed
  six words of Vietnamese as a string off one pair of quotes. So a language-less block gets the
  two things that survive not knowing the language — a quoted run on one line, and `$NAME` —
  by WEIGHT rather than colour, because the default palette is monochrome and a colour-only
  device does nothing on it.

And ```` ```typescript ```` never highlighted at all: the grammar was loaded, the fence said the
word, and the lookup missed because the id is `ts`. The corpus has had a fixture recording
exactly that since the port.

### The golden gate moved, for the first time, on purpose

Three of forty-five fixtures stopped matching Quire 1.x — all three the same behaviour, a fence
whose language could not be used. Their 1.x reference stays on disk **untouched**: those files
are what a renderer that no longer exists actually printed, so overwriting them would not
update the reference, it would destroy it, and the gate would go on reporting parity against
our own output. The new answers live in `golden/v2/`, the three are named in `DIVERGED` with a
reason each, and forty-two still hold the original contract. `CLAUDE.md` now says never
regenerate `v1`.

### Smaller things

- The Comments table gave the post title 97px, in which a normal headline wrapped to five lines
  and made every row 145px tall — sized by the column that matters least, while the comment
  beside it stayed clamped at two lines inside all that height. A minimum width and a clamp:
  176px and 65px.
- Settings has a search box. Seven tabs were defined and the owner still could not find a
  setting; four links elsewhere in the admin pointed at a tab deleted two weeks earlier.
- The onboarding steps can be opened again after being dismissed.
- A hint rendered in two different faces on one card, because the rule that chose the face keyed
  off the HTML TAG: `Setting`'s hint is a `<p>` and `ui/Input`'s identical hint is a `<span>`.
  Faces are chosen by ROLE now, and `check:admin-kit` fails a screen that names a typeface.
- The demo's posts carry 47 highlighter strokes and 67 formulas, against 12 and 5. A renderer
  feature absent from the fixture is a feature the demo claims and never proves.
- `content/themes.ts` split: palettes stay, the font presets and their tuned typography move to
  `content/fonts.ts`. One-way import, and `themes.ts` re-exports, so all 22 callers are
  unchanged.

### Also

- The README's feature table lost a quarter of its words and stopped wrapping its own labels.
  GitHub gives a markdown table no column widths, so `A highlighter` and `Leaving WordPress`
  broke across two lines; the labels are one word each now, and the two that need two are
  joined with a space the renderer cannot break on. The cells had drifted long enough that the
  table read as an essay with a heading column — a row is for telling somebody whether they
  want the thing, not for proving it to them.
- [ADR 0021](docs/decisions/0021-hosted-quire-ink-one-process-per-blog.md) records how a hosted
  tier would work if there is one: a control plane starting one process per blog, not a
  `tenant_id` column threaded through a schema built on one owner. A decision, not a feature.
- Two remote branches that would have reverted shipped work are deleted, their SHAs kept in the
  author's ledger so the commits stay reachable.
- `.design-sync/` — the generator inputs for previewing admin components in a design tool.
  Tooling only; nothing in `src/` imports it.
- The release procedure in [`docs/conventions/releases.md`](docs/conventions/releases.md) no
  longer tells you to check for a binary that is no longer built.
- `docs/conventions.md` reached 400 of the 400 lines `check:docs` allows, having been squeezed
  twice in one day to fit. It is now [`docs/conventions/`](docs/conventions/README.md), one file
  per surface — type, layout, colour, motion, IDE chrome, i18n, scripts, releases — the same cut
  [ADR 0010](docs/decisions/0010-four-homes-doc-layout.md) made for `docs/features/`. Two rules
  that had been filed by where their control sits rather than by what they govern moved with it:
  the font handles are with typography instead of with chrome reuse, and the mode × palette axes
  are with colour instead of with the header.

---

## Folded in from 2.0.2 — withdrawn as a separate release

**Twelve commits and not one new feature.** Every entry below is a defect, and eight of them
were found the same way the 2.0.1 fixes were: by driving the running site and measuring it,
not by reading the source. The notes are unedited from the 2.0.2 release; the rate-limit fix
is the reason nobody should be left on 2.0.1.

### The sign-in lockout lasted about a minute, and a forged header defeated the rate limit

Two defects in `server/rate-limit.ts`, both reachable from the internet.

**Every bucket was swept with whichever window the last caller happened to pass.** Public
endpoints charge a minute, sign-in fifteen, recovery codes an hour — one map, one sweep, and
the sweep applied the current caller's window to every key in it. So five failed sign-ins
wrote a fifteen-minute lockout and the next ordinary search request ninety seconds later
deleted it. On a site with any traffic the lockout was real for about a minute. A bucket now
carries the window it was written under and is judged by its own.

**`CF-Connecting-IP` was believed from anyone.** True that Cloudflare will not let a client
forward that header — and false in the one case that matters, a request straight to the
origin. Measured: 70 requests against a 60-a-minute cap, a different forged value on each,
all 70 answered. The other half of the same function was as bad in the opposite direction:
with no proxy at all neither header exists, `clientIp` returned the string `unknown`, and
every visitor shared one bucket — one person searching rate-limited the whole site, measured
at request 16 of 70 from a second client.

The socket peer is the ground truth and `Bun.serve` reports it, so that is what is counted. A
proxy header is believed when the connection came from loopback or a private address — nginx
on the same box, which is every layout in [`docs/self-host.md`](docs/self-host.md) — or when
**`TRUST_PROXY=1`** says the hop in front is somewhere public. Existing installs need no
change.

### A reader whose machine is dark opened every page on a white one

There was no `prefers-color-scheme` rule anywhere in the public stylesheet: measured at 0 of
429. `.dark` is applied by a deferred module, so for one paint the page is whatever CSS alone
can decide — and `system` is the default mode. Every dark-mode reader got a white flash on
every navigation.

The dark tokens now ship under `@media (prefers-color-scheme:dark){:root:not([data-theme])}`,
and the island sets `data-theme` to the resolved light/dark on its first apply rather than
only when a reader picks something. Measured after, OS dark and no stored choice: background
`rgb(14,14,14)`, `color-scheme: dark`, identical to what the island later produces. It was
`#fcfcfc`.

The cost is stated rather than glossed: a reader who explicitly chose LIGHT on a dark machine
now gets the inverse flash for exactly as long as the dark reader used to get theirs. That
moves it off the common case onto the rare one. Removing it altogether needs an inline script,
which this project does not have anywhere and asserts it does not.

### The front page lazy-loaded its own LCP image

`front-card.ts` set `loading="lazy"` on every image it built, including the lead's — measured
inside the first screen at both 1000px and 812px viewport heights. Lazy takes the one image
the page is judged by out of the preload scanner's reach. The rule already existed in two
other places; this was the one that had not read it.

### Compressing a response cost more than sending it

`web/compress.ts` runs outside the page cache, so every cache hit re-derived a compressed body
it had already produced. Requests per second on a warm local instance:

| | compression off | re-gzipping | memoised |
|---|---:|---:|---:|
| Front page | 5,510 | 3,325 | **4,445** |
| Article | 4,897 | 3,509 | **4,943** |
| `site.<hash>.css` | 11,216 | 3,652 | **8,139** |

Compression had been costing 40% of the front page's throughput and two thirds of the
stylesheet's — on a file that is content-hashed, `immutable`, and cannot change for the life of
a build. The cache is keyed by the body's bytes rather than by path, so a write that empties the
page cache has nothing to invalidate here.

A **404 is now compressed**: it is 19,650 bytes of rendered site shell and it is deliberately
not page-cached, so a crawler walking dead links paid for all of it every time. A 206 still is
not, because compressing a slice would make `content-range` a lie.

Brotli was measured and declined: quality 4 saves 2.9% on an article and 1.4% on the admin
sheet for the same CPU or more, to save bytes the CDN re-compresses anyway.

### The owner re-downloaded 262 KB of admin on every load

`main.js` (194 KB) and `admin.css` (68 KB) are the two files the bundler does not hash, and they
went out `no-cache` with no ETag and no Last-Modified — so both came down in full every time,
while the twelve hashed chunks beside them were free. They are fingerprinted now, and the bare
names still serve for a tab holding an older shell.

The shell also linked the entry and nothing else, so the browser discovered the module graph one
level at a time: four waves, measured at 4 / 13 / 24 / 31 ms on localhost, which on a real
connection is four round trips of blank screen. The entry's static imports are walked at startup
and emitted as `modulepreload`; three waves now, and the two that remain are the lazy route and
its dependencies, which is what splitting by route means. Route chunks are deliberately not
preloaded.

None of this reaches a reader. The admin's weight is the owner's alone
([ADR 0006](docs/decisions/0006-admin-stays-react-spa.md)).

### Two things a screen reader got wrong

The search overlay's empty state was a `<p>` inside a `<ul>`. The only child a list may have is
a list item, so a browser drew it correctly and assistive technology announced "list, 0 items"
while a sentence sat on screen saying otherwise. Both messages are list items now, and the list
carries `aria-live="polite"` — results arrive without the focus moving, and nothing had
announced that an answer came back, or that none had.

The theme menu marked the current mode with a CSS class and drew its tick from CSS, so a reader
heard four identical buttons and no way to tell which one they were already on. They are toggle
buttons in a labelled group with `aria-pressed` now — **not** `role="menu"`, which would promise
arrow-key navigation this widget does not implement.

The accessibility pass put `core.js` 59 bytes over its 8,800-byte budget and the guard stopped
the build, which is the guard doing its job. It is at 8,780 and the budget did not move.

### Every webfont rebuilt from upstream

The 2.0.1 subsetting left four families alone. Extending it to them, and moving JetBrains Mono
onto the same upstream path, took **inter −7,572 B** across three subsets and **IBM Plex Mono
−5,564 B** across six.

Source Sans was the last family still carrying `wght 200..900` for a product that offers
400/500/600/700. Clamping the already-shipped file was worth 832 B and had been measured and
dismissed on that basis; from upstream the same clamp is worth **7,076 B**, and the clamped file
covers 20 more codepoints than the one it replaces. All eight families are still offered in
Settings — the two Source faces and Plex Mono were rebuilt rather than dropped.

### Smaller things

- **`docs/performance.md` was split.** It crossed the 400-line cap, so
  [`docs/delivery.md`](docs/delivery.md) now takes what the SERVER does before it answers — the
  render cache, the CDN purge, compression — and `performance.md` stays the resource-loading
  law, what a BROWSER fetches.
- **The README's Speed table was re-measured** against the origin rather than carried forward
  from 2.0.0. Three of five rows were wrong by more than rounding.
- **`bun run build` no longer leaves the tree dirty.** `bun build --compile` drops a 61 MB
  dotfile beside `dist/` that nothing cleans up, and it was untracked and unignored.
- **`TRUST_PROXY` was missing from the Vietnamese README's environment table.** Added with this
  release; it had been documented in English only.
- **The README's headline JavaScript figure contradicted its own Speed table.** It said readers
  download "4.4 KB", fifty lines above a table reading 3.3 and 7.6 — 4.4 KB was `post.js` on its
  own, a bundle rather than anything a page costs, and it survived 2.0.1 re-measuring the table
  underneath it. Both READMEs now give the range a page actually costs, and the artefact rows
  are read off this build: **3.4 KB** on a listing, **7.7 KB** on an article.

### The demo

Not the product, but it is where most people meet it, so it is in the release.
[demo.quireink.com](https://demo.quireink.com) went from **18 posts to 28**, and the owner-facing
half stopped being photographs of absence: nothing had been in Trash, the Media library was a
drop zone, the subscriber list said "No subscribers yet", and no post was waiting anywhere for
the scheduled publishing that is a headline feature.

The fixture also had a claim problem. It shipped with four highlights, three footnotes, one
callout and one equation across eighteen posts — no code fence and no table anywhere — which is
how a site that renders maths, code, tables and five callout types came to look like a site that
renders paragraphs. Each new post is written around one of those gaps.

Its dates follow the clock now instead of a pinned constant, so the demo no longer ages a month
between refreshes; `SEED_NOW` pins them for the README plates, which were themselves pictures of
the fixture from two releases ago and have been reshot.

## 2026-08-07 — Quire Ink 2.0.1

**The product has a name, a licence and three features it did not have on 2026-07-30.** Sixty-nine
commits. Most of them are fixes, and nearly every fix in the list below was found the same way:
by driving the running site in headless Chromium and measuring it, rather than by reading the
source. `check:all` is 1,273 tests, 7 static guards and 45 golden fixtures compared byte for byte.

A reader on a default install with code in the post downloads **28% less font** than they did
on 2.0.0, and nothing was removed from the product to get there.

The entry dated 2026-07-31 below is part of this release.

### It is called Quire Ink now

`quireink.com` was bought, so [ADR 0016](docs/decisions/0016-rename-to-quire-ink.md) moved the
name with the domain and **[demo.quireink.com](https://demo.quireink.com)** became a public demo
instance — `manhhung.me` had been doubling as the showroom. The wordmark is **quireINK**, shipped
as outlines in `src/brand-art.ts`: `quire` in Inter, `INK` in JetBrains Mono, the project's own
two-face system stated as a logo. Outlines rather than live text for three reasons, only the
first aesthetic — `/login` must not wait for a font, the admin renders in whatever chrome face
the owner picked, and Literata is absent from most pages. `Qi` is the compact mark for the app
icon, the favicon and the collapsed rail; both are generated from one module, so the icon cannot
go stale again the way it had (it still read `vb`, two renames back, because nobody opens a 512px
file).

Three names deliberately did not move: `quire.db` and `analytics.db` (renaming them breaks every
backup archive already written), the `__Host-` session cookie (renaming it signs everybody out on
deploy), and the systemd unit.

### Licence: MIT → PolyForm Noncommercial 1.0.0

MIT grants the right to sell, which was never the intent.
[ADR 0015](docs/decisions/0015-relicense-polyform-noncommercial.md) records the change and the
dependency audit behind it (331 packages, all copyleft-compatible, so AGPL stays available).
Use, modification, redistribution and a patent grant are kept for **any noncommercial purpose**,
read generously: your own blog, a hobby project, study, research, charities, schools, public
research bodies, government. Commercial use is outside the grant and needs a separate licence.

Quire Ink is therefore **source-available, not open source**, and every claim to the contrary in
the tree was corrected rather than softened.

**Not retroactive, and it cannot be.** Everything through `v2.0.0` was MIT and stays MIT for any
copy already taken.

### Mathematics

`$$M \times V = P \times Q$$` used to publish those characters verbatim: the dollar sign means
nothing in Markdown, so `marked` passed it through. [ADR 0020](docs/decisions/0020-mathematics-as-mathml.md).

**Temml renders the TeX to MathML on the server, so a reader downloads nothing extra for it** —
no script, no stylesheet, no font file. That is the only affordable answer against a whole-site
budget of 4.4 KB: KaTeX ships ~23 KB of CSS plus a font family before it draws a glyph, and
MathJax runs in the reader's browser. KaTeX's own `output: 'mathml'` was the near-miss — that
mode was built as an accessibility track beside the HTML it actually draws, and standalone it
renders visibly worse.

`$…$` carries **Pandoc's three guards**, and on a blog that writes about money they are the
load-bearing part: the first post that needed this was about the quantity theory of money, where
`$5` and `$10` sit in the same paragraph as `$M \times V$`. A naive `\$(.+?)\$` reads `5 và ` as
a formula and eats the prose between two prices. Every rejected sentence is a test.

**The editor half was not optional.** With the server renderer complete, opening a post and
saving it still doubled every backslash (`$$M \times V$$` → `$$M \\times V$$`) and ate `\(…\)`
delimiters to markdown-it's `escape` rule. Neither throws; both destroy the author's source on a
save they did not know was a rewrite.

Two toolbar buttons, not one behind a menu — a standalone equation and a symbol inside a sentence
are different gestures. Typing `\(x\)` or `$$x$$` converts on the spot; **`$…$` deliberately does
not**, because an input rule fires on text already typed and cannot see the character coming
next, which is exactly what Pandoc's third guard needs. A price must survive being typed.

### A highlighter pen

Bold and italic mark a word; a blockquote marks a block. Nothing marked the gesture in between —
the one mark on a page that is a **reader's** rather than a typesetter's. `==text==` is that, and
`==text==#green` picks one of five inks. [ADR 0018](docs/decisions/0018-highlighter-pen.md).

The stroke is an SVG image, not a gradient and **not a mask**: masking clips the text along with
the ink, and the first pass rendered "mang dấu vết" as "mang uau vet". Two paths per stroke,
chisel ends, and `box-decoration-break: clone` so a highlight running past the end of a line
breaks into one stroke per line instead of a box wrapped around both.

The five pigments are **measured off a photograph of a real pen box**, then verified by reading
pixels back off the rendered page. The pen is chartreuse (hue 73), not the golden yellow the
obvious guess reaches for. Dark mode failed AA twice before it worked. Whole cost: **1.4 KB gzip**,
and the default stroke emits no bytes at all.

### A composed front page

[ADR 0014](docs/decisions/0014-homepage-modes.md), in two parts. `/` can now serve the post list
(the default, byte for byte what it always served), **any page you wrote**, or a **built front
page**: a lead story, a few picks, a row per category, most read, latest.

The design came from photographing the NYT front page rather than remembering it, and the finding
that shaped everything is that **most stories there carry no picture**. Hierarchy is size, then
standfirst, then image, then rules — so the two site kinds are one grammar with the dials moved,
and a site with no images looks finished rather than broken.

Both branches resolve **per request**, not when the routes are registered: `createApp()` runs once
at boot and the mode is a setting, so a route table built from settings would need a restart and
would serve the old shape until it got one.

### The webfonts, rebuilt

Every self-hosted face is rebuilt from upstream by
[`scripts/ops/subset-fonts.py`](scripts/ops/subset-fonts.py), which is committed — the doc
that told you to run this step had been naming a file that has never existed in this tree,
so the one operation the whole font budget rests on was the one nobody could reproduce.
All eight families stay selectable; none was dropped.

**Code ligatures are out of JetBrains Mono, and that is most of the saving.**
`jetbrainsmono-latin` was 30,164 B for 229 characters, and 26 glyphs plus 138 GSUB lookups
of it were the `calt` set: the thing that draws `=>` as an arrow and `!==` as a
struck-through equals **with no exclamation mark left on screen**. Right in an editor,
where you typed the line; wrong on a page, where a reader copies it. `--font-mono` resolves
to this family on every install whatever typeface the owner picked, so any post with code
was paying for it. **30,164 → 14,556 B.**

**Oldstyle figures are back in the two book serifs.** `islands.css.ts` has asked book mode
for `font-feature-settings:"onum" 1,"dlig" 1` since it was written, under a comment saying
a sans would ignore it — and every face ignored it, because the subsetting had dropped
`onum` and `dlig` from Literata and Source Serif alike. The one typographic flourish that
mode advertises had never rendered. Restored to the `latin` subsets only: `onum`
substitutes digits, every ASCII digit is in that range, and asking for it on `latin-ext`
measured +3,700 B of nothing.

**A Vietnamese subset was keeping its diacritics by accident.** `TEXT.vietnamese` declared
no combining marks while `MONO.vietnamese` declared five, and that was not a slicing
detail: GPOS `mark` attachment is what puts a tone mark on a vowel, and a subset with no
mark to attach loses the feature outright. The shipped `latin` files were carrying
U+0300/0301/0303/0309/0323 **outside their own declared range** to cover for it, so the CSS
and the files disagreed in both directions at once. Declared properly, the vietnamese files
keep `mark` and come out smaller. Checked on decomposed (NFD) text, which is what would
have broken.

**Source Sans stops shipping six weights nobody can pick.** It was the one family still
carrying `wght 200..900`; the product offers 400/500/600/700 and nothing else. Rebuilt from
upstream and clamped, `sourcesans-latin` lands under the file it replaces while covering 20
more codepoints — 35,608 B unclamped against 28,532 clamped, from the same source.

| What a reader downloads in fonts | 2.0.0 | 2.0.1 | |
|:---|---:|---:|---:|
| Default install, English, no code | 36,116 | **33,256** | −8% |
| Default install, English, with code | 66,280 | **47,812** | −28% |
| Default install, Vietnamese, with code | 79,704 | **60,000** | −25% |
| Literata + JetBrains chrome, Vietnamese | 81,948 | **68,212** | −17% |
| Source Sans + Plex Mono, English | 89,232 | **71,668** | −20% |

Across all 21 files on disk: 473,448 → 448,756 B.

Two failures are worth recording, because the script refuses to write on either now. An
explicit `--layout-features` list drops `kern`/`mark`/`mkmk` along with everything else it
does not name: that build measured **26% smaller and had no kerning at all**, and it looked
like a win. And a rebuild that quietly stops covering a declared codepoint is a silent
fallback face for that character, which is how the shipped files came to be missing eleven
of their own.

### The frozen 1.x tree is gone

[ADR 0019](docs/decisions/0019-remove-the-frozen-tree-from-the-working-copy.md). It was 438
tracked files against 434 in `src/`, 495 MB on disk, two guards carrying a special case for it,
and twenty live documents apologising for its paths. **Preserved at tag `v1-final`.** The one-shot
PostgREST importer went with it, along with `@supabase/postgrest-js` and 972 lines of
transform/verify/write — it described a migration that had happened and cannot happen again.
`src/import/wordpress.ts` is unrelated and stays. `golden/v1/corpus/` is **not** part of this: it
is the golden compare's contract, read on every run.

---

### Fixes: things that were losing data or losing readers

- **A partial settings save reset the homepage mode.** Three sanitizers hard-coded their default
  where every sibling honoured the `fallback` argument, and `saveSettings` takes a *partial* — so
  a patch that never mentioned `home` silently moved the homepage back to the post list and
  turned a text-led front page image-led. Reachable, and not by accident: the MCP
  `update_settings` tool builds a patch of at most title, description and `showDescription`.
- **Every redirect the owner had ever stored did nothing.** The table has had full CRUD since the
  port and no reader, so a redirect created in Settings → SEO appeared in the list and never
  fired — and the automatic 301 a slug rename adds never fired either. **Every rename since the
  port quietly threw away the old URL and whatever ranked at it.**
- **A trailing slash was a 404.** No route ends in a slash and Hono does not match one, so
  `/some-post/` fell through everything. Fine for a URL somebody typed; fatal for a site that
  *moved* here, because every WordPress permalink carries one. Measured on a real export: 468 old
  URLs shaped `https://example.com/{slug}/`, every one of them answering 404.
- **Redirects pointed at `http://` behind a proxy.** TLS terminates at nginx, so the origin sees
  `http` and every `Location` was resolved against that. A browser paid an extra hop; a client
  that refuses https → http simply stopped. The test asserted the absolute form, which is why it
  shipped.
- **A save landing mid-warm never purged the CDN.** `warmThenPurge` opened with `if (running)
  return`, which reads like de-duplication and is data loss: a warm walks every public post and
  measured 8.4s on a 77-post site, so any save inside that window never reached `purgeEdge`.
  Measured `Age: 824` against an `s-maxage` of 60.
- **A 500 on any public page** returned `{"error":"Internal error"}` in the browser window —
  unstyled, no viewport meta, no way back. The three locale strings for a real error page had
  been in all six languages since the port with nothing printing them.
- **A miss on any path of two segments or more** fell through to Hono's built-in `404 Not Found`
  in `text/plain`. `/{slug}` answers a one-segment miss properly, so the only case anyone checked
  always looked right — while an imported WordPress site sends every old inbound link shaped
  `/2024/01/slug` straight here.

### Fixes: the reading surface

- **A five-column table panned the whole article sideways on a phone.** Measured at 390px: a
  table is 484px at its narrowest and cannot be squeezed below its own content, so the document
  went to 516px and every paragraph travelled with it. `pre` has carried `overflow-x` since it
  was written and `.math-block` was given it deliberately; tables were the third case, and two
  comments in the tree asserted they already scrolled.
- **A phone gave a sixth of its width to gutters and got half the measure.** The shell padded
  2rem a side at every width, and above the phone breakpoint that is dead weight because the
  42rem max-width binds first — so it only ever spent anything where there was nothing spare. At
  390px the article set **33 characters to the line against 67 on a laptop**. Now 37 and 9 lines
  where it was 33 and 10; a 360px Android goes 30 to 33.
- **The newspaper filed its lead stories two levels below the section names.** The outline read
  h1, h3, h3, h3, h2. Size comes from a class and never from the tag, which is also why no
  screenshot was ever going to catch it.
- **The section headings missed the mono-chrome tracking correction.** Under a JetBrains Mono
  chrome the word "Typography" set 90.2px as a section label and 82.7px as the kicker three lines
  below it. Same font, same size, same screen, 9% apart.
- **Every palette was tuned to land exactly on the contrast minimum**, and one landed on it to
  the decimal — ocean's meta measured 4.50:1 against AA's 4.50. All six clear **5.0:1** now,
  which is the bar this repository already holds its own highlighter to. The corrections are
  three to six hex points each. A new test computes the ratio for every role in every preset.
- **The front page's own links were 20px tall** against the 24px minimum, on a phone, where the
  mobile sheet already gave the drawer rows, the tag links and the footer a real target.
- **A teaser ended on "a field of…"** — an ellipsis after a preposition. It prefers a full stop
  now when one falls in the last 40% of the budget. No stop-word list: this product ships a UI in
  six languages, and a full stop is punctuation rather than vocabulary.
- **A site with a dark logo had no logo at all in dark mode.** The rule hiding the light mark
  matched both marks and won on specificity. It shipped because the path had never rendered —
  `logoDark` is opt-in and no instance had set one.
- **The grid toggle was visible on every page that has no list**, announcing
  `aria-pressed="false"` for a list that was not there. `[hidden]` is a general rule now, not a
  patch per component.
- **The mobile sidebar drawer panned 32px on every phone** (2026-07-31, below).
- The comment thread became a card on the page's own terms, with the body set at the article
  size instead of two steps smaller, and a date that comes before its time in every locale —
  Vietnamese had been rendering `lúc 21:58 23 tháng 6, 2026`.
- Links prefetch eagerly; prerender stays on hover. Measured from a Vietnamese home connection:
  TTFB is ~145ms on an edge hit, ~185ms on a miss, ~65ms straight to the origin, and `moderate`
  prerender needs a ~200ms hover dwell that a normal click never waits for.

### Fixes: the share card

- **A Japanese title came back as twenty black boxes reading NO GLYPH.** satori has no system
  fallback and returns a perfectly valid PNG of the right size, so nothing failed: the route
  answered 200 and every structural assertion passed. The card ships three Inter subsets, so ja,
  ko, zh, ru, el, th and ar were all reaching it — and the first three are configurations this
  product explicitly supports. Both builders check every line they would draw now, and fall back
  to the site's own image or to no card. Shipping a CJK face is megabytes and stays an open
  decision rather than something slipped into a bug fix.
- **The card was a dark gradient with white text**, which is what every generated card on the web
  looks like and which said nothing about what was on the other side of the link. It is paper
  now, with the title and the date under the **same highlighter** the reader meets inside an
  article. Rasterised at 2x — satori emits SVG, so the resolution was always sharp's to choose,
  and 72 DPI left the type soft on the phone where a shared link is opened.
- **The pen on the card was not the pen on the page.** A copy of the stroke had drifted from the
  original — the denser lower band ended four numbers apart — under a comment claiming a test
  pinned the two together. There was no such test. `render/pen.ts` holds the pen now, and the
  card's own pixels are asserted.

### Fixes: import, security, abuse

- **A WordPress gallery lost most of its photographs.** The figure rule read
  `querySelector('img')`, which is the first match anywhere in the subtree, and returned it as
  the replacement for the whole block: importing a real site brought over **255 of its 407
  photographs** and said nothing. One page kept 30 of 169.
- **`collapseBlob` stripped `/uploads/` anywhere it appeared**, so an imported post referencing
  another site's `/wp-content/uploads/x.jpg` was silently rewritten to `/wp-contentx.jpg` on save.
- **Every never-published WordPress draft imported dated today**, because WordPress writes a zero
  GMT date and `??` took the zero.
- **`/og` was the expensive public route and the only one without a cap.** A cached page answers
  in ~1ms; a card costs ~44ms, and the card is a pure function of its query string — so changing
  one character of `?title=` misses the edge and the origin together. At 40 concurrent from one
  unauthenticated client the median page went from 1.9ms to 10.6ms on a machine with cores to
  spare; the self-hosting target is a 1–2 vCPU box.
- Two dead-end code-scanning findings closed for real (a drifted HTML escaper in the newsletter,
  biased sampling in recovery codes) and one documented as dismissed with the reason.

### The repository stopped describing one blog

`state/` was a worklog, a task list, a roadmap and five audits — all public, all about **one**
blog: its domain, its server, its service name, what was wrong with it on five dates. None of it
was a credential and none of it was a leak. It was somebody else's server, published for no
benefit to any reader. It moved to a private sibling with the two vhosts that named a domain, a
cert path and an internal port ([ADR 0017](docs/decisions/0017-move-state-and-instance-config-private.md)).
The backup script stopped being named after one instance, `backups.md` stopped citing the
author's own post count as evidence, and the delivered plan stopped declaring "there are no
third-party self-hosters" — a sentence every clause of which had become false.

Also: **794 generated files untracked** (12.5 MB of design-sync output swept in by a `git add -A`),
the parity checklist's 232 never-ticked boxes replaced by an inventory that reads as one, and
`docs/features.md` split into a directory at its cap.

### Guards

- **`check:docs` gained a sixth rule**: a repository path written as code in a live document has
  to exist. Rule 1 only ever resolved links *between* markdown files, which is how CLAUDE.md's
  debug router — the first thing anyone opens when something breaks — spent months pointing at
  two source files that are not there. It immediately found worse: `self-host.md` documented a
  migration command deleted a release earlier, and `performance.md` told you to run a script that
  has never been in this tree.
- **`check:admin-kit`** is new: each admin primitive has a signature belonging to exactly one
  file, and the check fails if a screen re-types it.
- **`check:css-literal` and `check:type-roles` discover their sheets** instead of listing them.
  Both lists had gone stale — `front.css.ts` and `utility.css.ts` were never in one of them, so
  it reported "ok (6 sheets)" against files it had never opened.
- **`noUnusedLocals` and `noUnusedParameters`** on in all three projects: 15 dead declarations,
  three dead exports, and **336 dead locale strings** across twelve files.
- `check:filesize` and `check:docs` warn from 90–95% of a cap, so the person who adds the line
  that crosses it is not the person blocked by it.

## 2026-07-31 — the mobile sidebar stopped panning

**The drawer scrolled sideways by 32px on every phone, and two separate mistakes had to line
up for it.** `.rail` asks for `overflow-y:auto` so a long index can scroll. A box that names
one axis and leaves the other alone does not get `visible` on the other — the used value
computes to `auto` — so the drawer had been a horizontal scroller all along, waiting for
something inside it to be a pixel too wide.

The IDE chrome then supplied the pixel. Its line-number ring hangs 23px outside a rail row, on
the gutter rail's divider hairline, and `.rail-inner` was widened by 32px and padded back so
the gutter's own scroller could not clip it. Both of those are facts about the **desktop**
rail: below 640px the rail is a drawer with no divider and no inner scroller, and `rail-css.ts`
injects that scroller inside the same breakpoint. Ungated, the overhang put a 291px box inside
a 259px one. The whole IDE rail block is now behind `@media (min-width:640px)`, which is where
the header already drops its tokens, and `.rail` spells out `overflow-x:hidden` so no future
rule can teach it to pan again.

Measured, not eyeballed: `nav.toc.rail` reported `clientWidth 299` against `scrollWidth 331`
before, and no horizontal scroller at all after, at 360, 390 and 414px. The page itself never
overflowed, which is why this survived the mobile pass in 2.0.0 — `documentElement.scrollWidth`
was 390 the whole time and the panning was one element deep.

**Also:** four new demo images in the README, rebuilt from real screenshots of a seeded
English instance and composed in HTML so they regenerate from a command. The dashboard shot
is what surfaced the activity-row overlap fixed in 2.0.0.

## 2026-07-30 — Quire 2.0.0

**Stable.** The beta said it had run one site for one owner for a little over a day, and that
nothing was known to be broken but nothing had been proven either. Since then the whole project
has been audited end to end — design, performance, and correctness — by measuring the running
site rather than reading the source. That audit found one live security hole, one rendering
rule that had never applied, and a mobile failure no amount of source reading would have
revealed. All three are fixed and verified in production. That is the difference between
beta.1 and 2.0.0.

### The shape of it

One process, two SQLite files, a directory of uploads. Clone it, `bun install`, run
`bun src/index.ts` behind a reverse proxy, and the install is done. There is no database server
to provision, no migration step (the schema is applied at boot inside a transaction), no
container runtime, and no third-party account anywhere in the path. Docker is one service and
two volumes, with no sidecar.

| | |
|:---|:---|
| **Runtime** | Bun + Hono. One process, single-threaded, so exactly one writer by construction: no pool, no mutex, no busy-retry |
| **Content** | `quire.db` and `analytics.db`, joined with `ATTACH` where needed. Timestamps are integer milliseconds UTC everywhere; timezone logic lives in TypeScript, never in SQL |
| **Public pages** | Server-rendered HTML plus three hand-written island scripts. **No framework reaches a reader** |
| **Admin** | A React 19 SPA, route-split, served only to the owner. React and the editor cannot leak onto a reading page |
| **Uploads** | The local filesystem, with AVIF and WebP variants built on save |

The seams are enforced rather than remembered. `bun run check:all` runs the type checker over
three projects, **six static guards** and **1,121 tests**. The guards fail the build on: a file
over 400 lines, a hardcoded size in the reader's stylesheet (or a type role that sets a size
without its leading and tracking), a backtick or an unopened comment inside a CSS template
literal, a NUL byte in a source file, a stale documentation link, and **any write route
registered outside the owner-gated router group** — the last one caught a forgotten
`/api/auth/enrol/done` the first time it ran.

### What a reader actually downloads

Measured from the network on a cold load of the live site, not estimated from the markup:

| | Home | A post |
|:---|---:|---:|
| Requests | **11** | **12** |
| Total | **139 KB** | **140 KB** |
| of&nbsp;which&nbsp;fonts | 86 KB | 86 KB |
| HTML | 22 KB | 18 KB |
| CSS | 7.6 KB | 7.6 KB |
| JavaScript | **4.4 KB** | **9.7 KB** |
| Third-party&nbsp;requests | **0** | **0** |

Everything except the HTML is content-hashed and `immutable` for a year, so a second page view
costs about **23 KB**. The reading fonts are 62% of a first visit, and that is a deliberate
trade: they are self-hosted, subset per language and `opsz`-pinned, because typography is the
product on a reading site.

The JavaScript figure is the one worth staring at. A listing page ships 4.4 KB — the analytics
beacon, the theme control, the search trigger and the mobile drawer — and an article adds the
table of contents, the lightbox, the code-copy button and book mode for another 5 KB. Each
bundle has a **byte budget the build enforces**, so a feature that overruns it fails the build
instead of quietly costing every reader.

Where the speed comes from:

- **One in-process page cache**, cleared completely on any write, so the invalidation rule is
  one line long and cannot rot. A miss is a sub-millisecond SQLite read plus a render.
- **A content-addressed render cache** in SQLite for markdown and syntax highlighting: the
  input IS the key, so there is no invalidation problem at all. It took long-post rendering
  from 383 ms to 1 ms, and it now prunes itself from the hourly tick.
- **The public stylesheet is minified before it is hashed.** It was 65,645 bytes of which
  34,438 were comment text, because these sheets are commented the way the code is. The prose
  stays in the `.ts` file; the wire gets 30,811 bytes, **6.5 KB compressed against 20.9 KB**.
- **Reading-font subsets are preloaded by language**, with `latin-ext` left lazy behind
  `unicode-range` and the chrome face preloaded only when it is a self-hosted family that
  reflows the page. Pinning the `opsz` axis took the preload set this site actually serves
  from **97,588 bytes to 46,212** — 51 KB off the critical path, measured.
- **Origin compression, edge caching, and prerender-on-hover** through a `Speculation-Rules`
  header rather than an inline script, so the public site ships no inline script at all and the
  recommended CSP can keep refusing `unsafe-inline`.
- **Scroll-driven CSS animations** for the card reveal and the reading progress bar: no script,
  off the main thread, and triple-gated so they can only ever hide content where they can also
  reveal it.

### Since the beta

**A live reflected XSS, found and closed.** `web/search-page.ts` had grown a private
`escapeHtml` that escaped `& < >` and nothing else, and it interpolated the reader's query into
`value="…"`. So `/search?q=" onfocus=alert(1) autofocus x="` came back as a working event
handler on a public page, from a link anybody could send. Escaping `<` meant a script tag could
not be injected; the unescaped quote was all it took. Both files that put a value in an
attribute through a weak escaper now use the canonical pair from `utils.ts`, which escapes both
quote forms, and `escapeAttr` is exported as a named alias so a call site reads as the context
it writes into. Two regression tests assert on the attribute's own quote count rather than on
the payload's text.

**A mobile layout that scrolled sideways, and the cause was not CSS.** Every public miss
returned `text/plain`, and a plain-text body carries no viewport meta, so a phone laid two words
out at the default 980px desktop width and let the reader pan. Measured at 390px: an unknown
slug reported a 980px document while every real page reported 390. The strings for a proper 404
page had been sitting in all six locales since the port with nothing rendering them. Every HTML
miss is now a page in the site shell.

**A rule that had never applied since the feature shipped.** Minifying the stylesheet surfaced a
paragraph in `ide.css.ts` with a closing `*/` and no opener: a browser read the prose as a
selector, failed, and discarded the rule that followed it — seven selectors meant to darken every
count and date under the IDE chrome. `check:css-literal` counts comment delimiters now.

**Mobile, measured at 360, 390 and 414 px and in landscape.** The search form was missing the
`min-width: 0` its sibling form had, so the input would not shrink and pushed the button's
border off-screen. Drawer rows went from 22px to 43px, the tag cloud to 37px, footer links to
35px. Form controls are floored at 16px on phone widths, because below that iOS zooms the page
on focus, and confirmed still 14.08px at desktop width so the floor does not leak. Copy-code is
visible under `@media (hover:none)`, the drawer has a scrim, `100dvh` sits beside `100vh`, and
the safe-area insets are honoured. All of it lives in a fourth sheet, `mobile.css.ts`, appended
last and matching nothing above 639px.

**The editor stops losing work.** A hard downward scroll triggered the browser's pull-to-refresh
and reloaded the page; the admin sets `overscroll-behavior-y: contain` now. The local snapshot
ran only on an 8-second timer, and `beforeunload` does not reliably fire on a mobile reload, so
it was never the safety net it looked like: it is flushed on `pagehide`, on a
`visibilitychange` to hidden, and on unmount.

**Contrast, discovery and keyboard.** `.term-count` measured 2.26:1 and failed AA at any size,
visible only with the IDE chrome switched off — so the site the owner saw was never the one
shipping the failure. Book mode's meta colour was 3.30:1 on its paper and is 4.93:1 now.
`/feed.xml` answered correctly with nothing on the site pointing at it; there is a
`rel="alternate"` link. A skip link is the first tab stop on every public page, and one
`:focus-visible` ring replaces the `outline: none` that had made the sign-up field the only
control where keyboard focus vanished.

**Admin.** The top progress bar drew itself twice per click: a navigation has two halves, the
route's chunk resolving and then the new page asking for its data, and the bar took the few
frames between them literally, marked itself done and restarted from the left. Measured at
39 ms and again at 102 ms; now one sweep. Toasts are announced to a screen reader and carry a
glyph, since success and failure had been inverted black and white and nothing else. The
`danger` button variant was byte-identical to `primary`, which made "Delete forever" the loudest
control on its screen. On the dashboard, an activity row gave its action a flat 120px column and
no way to shrink, so the long names — `auth.recovery.regenerated` measures 176px — ran out of
their track and painted on top of the detail beside them.

**Correctness and cleanup.** `safeNext` rejected `//host` but not `/\host`, which browsers
normalise into a protocol-relative URL and follow off-site. A second Cloudflare purge
implementation with no request timeout was deleted and its three callers repointed. `og.ts` no
longer trusts a `Host` header when `SITE_URL` is unset, and both of its fetches are bounded. The
render cache was insert-only with nothing ever deleting; it prunes in bounded batches, with no
`VACUUM`, because the database runs in WAL. Feeds and the public search index stop rebuilding at
the origin on every hit. A dead module, five dead exports, four orphaned routes and two unused
dependencies are gone, and the two modules that did arithmetic and sent mail — the analytics
aggregation and the comment-reply notifier — have tests for the first time.

### Moving from Quire 1.x

Everything about *running* it changed; nothing about *using* it did. The full breaking list is
in the 2026-07-29 entry below; the short version:

- **Sign-in is yours.** Google and NextAuth are gone: username + password (argon2id) + required
  TOTP + ten single-use recovery codes. `bun run user create` makes the account.
- **No database server.** `POSTGREST_URL` / `POSTGREST_TOKEN` no longer exist; `DATA_DIR` holds
  both database files.
- **Four environment variables matter.** Everything else is entered in the admin.
- **Import your 1.x content** with `bun run import-v1`, which reads a running 1.x over
  PostgREST. What was deliberately not carried over, with reasons, is in
  `docs/spec/07-parity.md`: Google Drive backup, numbered pagination,
  the reader-facing palette switcher, grid-view thumbnails.

The rewrite was a **port, not a reimplementation**
([ADR 0005](docs/decisions/0005-rewrite-in-bun-hono-sqlite.md)). Roughly 6,500 lines of logic
and every test moved unchanged, and the article renderer is held byte-for-byte against 1.x by a
golden corpus that treats one differing byte as a porting mistake, with nothing to review and
nothing to accept.

### Known gaps

- **The compiled binary is not the shipping path yet.** `bun run build` produces `dist/quire`,
  one file, but `bun build --compile` does not bundle `sharp`'s native module, so it throws the
  first time it resizes an image. Run from source, which is what the live site does. Tracked in
  `state/OPEN_QUESTIONS.md`.
- No in-app restore, by design: restoring replaces database files the process holds open. Backup
  is a one-click download from the admin plus an off-box cron job. See
  [`docs/backups.md`](docs/backups.md).
- Numbered pagination is prev/next only; the reader-facing palette switcher and grid-view
  thumbnails were not ported.
- The autosave interval is a constant, and the editor never says the work is being held locally.
  Both are filed in `state/TASKS.md`.
- Ten renderers still declare a private HTML escaper. Every attribute interpolation in them was
  verified to use the strong `escapeAttr`, so what is left is tidying rather than a hole, and the
  article renderer's text escaper is deliberately frozen by the golden gate.

## 2026-07-29 — Quire 2.0 beta (v2.0.0-beta.1)

The first tagged 2.0. The rewrite has been serving `manhhung.me` since 2026-07-28; this is
the point at which the two features it shipped WITHOUT are in, the last of the port's quiet
losses are found, and the version stops being `2.0.0-dev`.

**Beta and not 2.0.0**, for one honest reason: it has run one site for one owner for a
little over a day. Nothing is known to be broken. Nothing has been proven by anyone else
either.

### The two dead controls are alive

- **Google sign-in for commenters** ([ADR 0013](docs/decisions/0013-google-sign-in-for-commenters.md)).
  The toggle sat in Settings controlling nothing, and the parity note recorded the removal
  citing ADR 0007 — which is about the OWNER'S sign-in and says nothing about readers. A
  commenter is now a signed `__Host-` cookie rather than a session row; the identity comes
  from the id_token's claims (`aud`, `iss`, `exp`, `email_verified`) and the request body is
  ignored. Client id and secret are entered in the admin.
- **Scheduled backups** now write snapshots to `BACKUP_DIR` from the cron tick, listed,
  downloadable and deletable in the admin, retention by count. Due-ness is read from the
  newest file on disk, so there is no state to go stale. There is deliberately no restore
  button: restoring replaces database files the process holds open.

### Found by measuring, not by reading

Each of these looked correct in the source.

- **Prerender on hover.** `docs/performance.md` described Speculation Rules as shipping and
  the spec asked for them; neither was true. What the port DID carry over was
  `whenActivated`, the guard that exists only because a prerendered page runs its JS early.
  Now shipped as a `Speculation-Rules` header rather than an inline script, so the public
  site still ships none and the CSP keeps refusing `unsafe-inline`.
- **Typography.** A related-post title had no size rule at all and fell back to the body
  size. `--type-scale` was spelled per rule, so book mode enlarged the prose and left
  figcaptions, tags and the comment thread behind. The comment thread had lost
  `font-family: var(--font-reading)` and was rendering in the chrome font. Nine literal
  sizes sat in a sheet whose own header forbids them — `bun run check:type` now fails the
  build on any of it.
- **The series card** had lost the link to its own `/series/<slug>` page (which nothing on
  the site reached), the "part N of M" line, and its position above the article. All three
  were restored from data the port was already carrying.
- **The admin dashboard** reported `PostgreSQL · online` on a SQLite install, and its
  version named no build. It now shows the commit and links to it.

### Also

- Series in the sidebar, under the categories, with counts. `features.sidebarSeries`.
- Turnstile and Google sign-in moved to **Settings → Connections**, toggle and keys
  together. The split is what let `googleAuth` stay on for weeks with nothing behind it.
- A dark-mode logo can be uploaded; both marks ship and CSS picks, because the page cache is
  keyed by URL alone.
- The admin's dark mode works: `@custom-variant dark` was missing, and under it a `<body>`
  with a background and no text colour.
- First schema migration mechanism. `schema.sql` states the final shape; `migrations.sql`
  gets an existing database there.
- `scripts/ops/quire2-backup.sh` no longer names one machine's paths, bucket and webhook.

### Known gaps

- Numbered pagination is prev/next only; the palette switcher and grid-view thumbnails were
  not ported. Full list in `state/TASKS.md`.
- CI is red: the workflow still runs `npm ci` against a repository that has had no
  `package-lock.json` since the cutover. The fix is written and needs a token with
  `workflow` scope to land.
- No in-app restore, by design. See `docs/backups.md`.

## 2026-07-29 — Quire 2.0: one process, two SQLite files, no infrastructure

**The whole thing was rewritten and `manhhung.me` has been serving it since 2026-07-28.**
Next.js 16 + React + PostgreSQL + PostgREST became **Bun + Hono + SQLite**: one process,
two database files, a directory of uploads. Nothing to provision, nothing to keep running
beside it, no third-party account anywhere in the path.

It is a **port, not a reimplementation** ([ADR 0005](docs/decisions/0005-rewrite-in-bun-hono-sqlite.md)).
Roughly 6,500 lines of pure logic and every test moved unchanged; the admin's 68 React
components moved almost verbatim. That was the point: the owner does not read code, so the
dominant risk was a behaviour quietly not surviving the move, and translation is where
behaviour goes missing.

### ⚠️ Breaking — everything about running it

- **Sign-in is now yours.** Google and NextAuth are gone. Username + password (argon2id) +
  **required TOTP** + ten single-use recovery codes ([ADR 0007](docs/decisions/0007-self-hosted-password-totp-auth.md)).
  Create the account with `bun run user create --username <name> --email <address>`.
  `AUTHORIZED_EMAIL`, `AUTH_GOOGLE_*` and `AUTH_URL` no longer exist.
- **No database server.** `POSTGREST_URL` / `POSTGREST_TOKEN` are gone. `DATA_DIR` holds
  `quire.db` and `analytics.db`; the schema is applied at boot inside a transaction, so
  there is no migration step.
- **Env is down to four things that matter**: `DATA_DIR`, `SITE_URL`, `AUTH_SECRET`,
  `STORAGE_LOCAL_DIR`. Everything else is entered in the admin.
- **Google Drive backup is gone** ([parity exception 1](docs/spec/00-rationale.md)). Backup is
  now an operational job that keeps working when the application does not: a cron script
  to object storage, plus a one-click download of the whole install from the admin. That
  deleted ~730 lines of OAuth, token refresh and folder bookkeeping. See [docs/backups.md](docs/backups.md).
- **Sessions do not carry over.** The cookie is `__Host-` prefixed and therefore scoped to
  one hostname. You will sign in again.

### The reader's side

- The public site now ships **no framework at all**: server-rendered HTML plus a few small
  hand-written islands, and **no inline script anywhere** — a property covered by a test,
  which is what lets the CSP drop `'unsafe-inline'` from `script-src`.
- Article HTML is **byte-identical** to 1.5's. The golden harness became a hard equality
  gate rather than a diff review, because `marked` and `shiki` came along unchanged.
- **Book reading mode** paginates correctly: 1.5 drifted one column gap on every page turn.
- Search runs on SQLite FTS5 with Vietnamese diacritics folded.
- **A dark logo can be uploaded** (Settings → Site). A logo is ink on transparency and a
  dark mark measures about 3.4:1 on a dark page, which reads as a black smudge. Both marks
  are emitted and CSS picks one, because the page cache is keyed by URL alone.
- `cache-control` is sent for the first time: 60 seconds plus `stale-while-revalidate` on
  public HTML, `private, no-store` on the admin, sign-in and API.

### The owner's side

- The admin is the same React SPA, extracted from Next and served as a static bundle
  ([ADR 0006](docs/decisions/0006-admin-stays-react-spa.md)). Settings were regrouped into
  seven defined tabs ([ADR 0011](docs/decisions/0011-settings-regrouped-into-seven.md)).
- **Dark mode actually works.** It was applying to four elements and nothing else: Tailwind
  v4 compiles `dark:` to a media query unless told otherwise, so 668 utilities were
  following the operating system while the admin's own switch toggled a class nobody was
  listening to.
- Tables no longer clip on a phone, and the analytics table no longer spends its width on
  three-character numbers while truncating every title.
- The MCP server, the WordPress import, scheduled publishing, redirects, series, the
  activity log, Trash and the in-app Help all moved across intact.

### Under it

- Two SQLite files joined with `ATTACH`. `bun:sqlite` is synchronous and the runtime is
  single-threaded, so there is exactly one writer by construction: no pool, no mutex, no
  busy-retry.
- The seven invariants were restated for the new shape ([docs/invariants.md](docs/invariants.md)).
  The cache one got blunter on purpose: the whole page cache is thrown away after every
  write, which costs a few renders and cannot be wrong.
- 927 tests. `bun run check:all` is typecheck, four static guards and the suite, offline,
  with no services.
- The repository was flattened after cutover ([ADR 0012](docs/decisions/0012-flatten-repo-after-cutover.md)):
  2.0 at the root, the frozen Next tree in `v1/`.

### Known gaps

- **Google sign-in for commenters is not implemented.** The toggle survived the port and
  the feature did not; it does nothing until it is built.
- The backup schedule and retention fields in Settings are inert for the same reason.
- Numbered pagination is prev/next only, and the palette switcher and grid-view thumbnails
  were not ported (both are off on this install). Full list in `state/TASKS.md`.

## 2026-07-26 — Quire 1.5: newsletter, a real dev stack, and a security pass (v1.5.0)

The minor moves for two reasons: the blog can now **email its readers** as a first-class
subsystem, and the self-host **environment variables were renamed** (see Breaking below).

### ⚠️ Breaking — self-host env

`SUPABASE_URL` → **`POSTGREST_URL`**, `SUPABASE_SERVICE_ROLE_KEY` → **`POSTGREST_TOKEN`**,
and **`POSTGREST_DIRECT` is gone**. Rename the two keys in your `.env.local` / `.env.docker`
*before* restarting — `src/env.ts` fails fast, so a server with the old names will not boot.
`POSTGREST_URL` is the endpoint that serves tables at `/<table>`; behind Supabase's gateway
that path is `/rest/v1`, so include the suffix in the URL itself.

The names were a leftover: the data layer used the `supabase-js` client to speak PostgREST,
long after Supabase itself was dropped. It now depends on **`@supabase/postgrest-js`** — the
standalone query builder that `supabase-js` wraps — so `db()` keeps the same `.from()`/`.rpc()`
surface, all 132 call sites across 28 files are unchanged, and four clients the app never
called (auth, realtime, storage, functions) are no longer shipped.

### Newsletter

- **Admin → Newsletter**, a page of its own with three tabs. *People*: subscribers and each
  address's real send history. *Send*: pick one or more posts, review the actual email HTML in
  a sandboxed iframe, then send. *Test*: sample sends. Settings → Integrations now holds only
  the SMTP credentials.
- **Sending is a deliberate act.** There is no automatic broadcast: the cron publishes a
  scheduled post on time but never emails anyone. The double-send guard reads the send log
  rather than `broadcast_at`, which older posts still carry from the retired auto-send.
- **A designed email, in your palette.** One shell for every message — 600px table, inline
  styles, masthead with your actual logo, hidden preheader, an Outlook-safe button, and a
  footer that says why the reader is getting this. Colours come from the owner's own theme.
  The logo ships a **PNG twin** because Outlook on Windows cannot render WebP.
- **Several posts are ONE digest**, never one message per post — newest leads, the rest follow
  as a list. Each post still gets credit in the per-post stats.
- **Every send is logged**, success and failure with the SMTP error, from the single choke
  point in `sendMail` — no path can email an address without it showing up.
- **Open tracking** via a 1×1 pixel whose token identifies the send row, never the address.
  First hit wins; no IP, UA or referrer recorded; previews and test sends carry no token.
  Links are not wrapped — there is no click tracking.
- **Subscribe from any page** with a header envelope button (shown only when SMTP is
  configured) that opens the form as a modal.
- **Unsubscribe now confirms on POST.** A bare `GET` — email scanners, link prefetchers — no
  longer silently unsubscribes someone; it renders a confirmation page instead.

### Security

A dependency audit found **14 known vulnerabilities, 3 critical**, because `next` was pinned
to an exact version and patch releases never arrived. All criticals are gone:

- **Auth.js** — a configuration error could make existence-based auth checks *fail open*, and
  `getToken()` threw on a malformed `Bearer` header (called on every `/admin` and `/api`
  request). → `next-auth` 5.0.0-beta.32 / `@auth/core` 0.41.3
- **Next.js** — middleware/proxy bypass on App Router + Turbopack, plus nine more. → 16.2.11
- **node-tar** — parse DoS and an infinite loop; restore unpacks archives. → 7.5.22
- **fast-xml-parser** — entity-expansion reset, reachable through the WordPress importer. → 5.10.1
- **sharp** / **postcss** — needed `overrides`, because the vulnerable copies were nested
  inside `next` where a normal bump has no effect.
- `nodemailer` deliberately stays on 7.x: none of its advisories touch an API this app uses,
  and `next-auth`'s peer range forbids 9. Reasoning recorded in `audit/2026-07-26-comprehensive.md`.
- **`/api/subscribers` was exempted from the edge owner guard** — `isPublicApi()` matched
  `/api/subscribe` as a prefix. Nothing was exposed (the routes call `requireOwner()`), but
  the defence-in-depth layer is restored and the match is now exact.

### Accessibility

- **All six light palettes failed WCAG AA on secondary text** (2.91:1–3.60:1 where 4.5:1 is
  required at 14px); scifi and amber failed on link colour too. Corrected to the lightest
  value that clears AA, hue and saturation untouched. Live Lighthouse accessibility **96 → 100**.
- `themes.test.ts` now holds every preset to AA — a palette is data, so a bad value is
  invisible in review.

### Performance

- **Font weight axes clamped to 400–700**, the only weights the app can render, keeping the
  `opsz` axis that `font-optical-sizing: auto` opts into. The reading font's LCP pair drops
  **129 KB → 95 KB**; 175 KB saved across the bundled families (`scripts/subset-font-weights.py`).
- Responsive `<picture>` for the cover hero, a lean media select for the public post render
  instead of reading the whole library, and a lazily-loaded search overlay.
- Measured on the live site (mobile, median of three): **Performance 77 → 87, LCP 5.1s → 4.0s,
  blocking time 230ms → 100ms.**

### Working on Quire

- **A local dev stack that actually works**: `docker-compose.dev.yml` brings up Postgres +
  PostgREST + **Mailpit**, so `npm run dev` on the host has hot reload and the whole newsletter
  path — opt-in, broadcast, reply, open pixel — runs end to end with no real SMTP account.
- **`DEV_LOGIN`** adds a local-only owner sign-in, so `/admin` is reachable on a machine with
  no Google credentials. It is an auth bypass, so it has two gates and an alarm: unregistered
  unless `NODE_ENV !== 'production'`, it demands a secret rather than being a flag, and a
  production server **refuses to boot** while it is set.
- **Admin → Help rebuilt as a usable manual.**
- Verification is now a rule, not a habit: run the change on the local stack and drive it with
  a headless browser. Two UI defects shipped the week before purely because `check:all` passed
  and nobody opened the page.
- The static check scripts normalise path separators, so the guards work on Windows — they had
  been reporting phantom violations and silently skipping their own exemption lists.

### Fixes

- **Lightbox was dead for self-hosted images** — the URL scan only matched absolute `https://`,
  while local images are stored root-relative, so the island never rendered.
- **WordPress import** stamps imported posts as already broadcast, so a later cron tick cannot
  blast an entire back catalogue to subscribers.
- **Book mode**: wide images spilled into the next column; dark mode leaked white text onto the
  paper background (the overrides used the wrong variable prefix).
- **Admin analytics scrolled sideways on a phone** — the header held its actions rigid, so four
  range pills plus Export could neither shrink nor wrap.
- File uploads use an exclusive write with retry, matching media originals.
- Search box is one bordered field with no stray accent ring; the rightmost header icon aligns
  to the content margin.
- Scroll-reveal now works on Safari and Firefox via an IntersectionObserver fallback (Chromium
  keeps the pure-CSS path and ships no extra JS), and the fade finishes mid-screen where the
  eye actually is.

### Look

- The public frontend is rounded site-wide, matching the admin, instead of the global
  square-corner reset.
- Admin dropdowns are styled: a custom `Select` replaces the raw native control, and a
  `Combobox` replaces the untypeable `<input list>` + `<datalist>`.
- Shared input chrome, aligned radii, and the analytics read-depth panel moved up beside
  Channels and Referrers.

## 2026-07-23 — book mode: 15% larger text + paler paper (v1.4.37)

- Reading text in book mode is now 15% larger than normal, via a `--type-scale` multiplier on
  the `--fs-*` role sizes (default 1 elsewhere). It tracks the owner's font-size setting: raise
  the setting and book mode stays 15% above it. UI chrome (fixed rem) is unchanged.
- Book-mode paper background is a touch paler.

## 2026-07-23 — book mode: single paper background (v1.4.36)

- Dropped the floating page-sheet-on-desk look: book mode is now ONE flat warm-paper
  background across the whole reader (no two-tone surface, no sheet shadow).
- Paper grain is baked into that single background (desaturated fractal noise, multiplied)
  and dialled up a touch so the texture reads more clearly.

## 2026-07-23 — book mode split out + excerpt-tracking fix (v1.4.35)

- **Fix — cramped post-card excerpts:** the mono-chrome letter-spacing nudge
  (`data-chrome-font` −0.04/−0.05em) was leaking onto `.reading-font` excerpts (they wear
  `.t-body`), tightening the reader's words out of line with the rest. Now excluded via
  `:not(.reading-font)`.
- **Book mode fully separated (perf):** the heavy overlay moved to `BookReader.tsx`, **lazy-
  loaded** via `next/dynamic` — its pagination code reaches the browser only when a reader
  opens book mode. Book CSS moved out of global `globals.css` into `components/blog/book.css`,
  imported by the toggle, so **listing pages no longer ship any book-mode code or CSS**.

## 2026-07-23 — book mode: paper standard (v1.4.34)

Book mode is now its own printed-page standard, not the sepia theme:
- **Paper palette:** near-black ink on a light warm-white page (was brown-on-tan sepia).
- **Page as a sheet:** the reading area is a paper sheet with inner margins + a soft shadow,
  floating on a slightly deeper surface (the desk / binding) — real open-book depth.
- **Paper grain:** a faint multiplied noise texture over the sheet so the flat screen reads as
  printed stock, not a glowing panel.

## 2026-07-23 — book mode: more Western-book touches (v1.4.33)

- **Small-caps opening line** beside the drop cap (the traditional raised-initial companion).
- **Asterism section breaks:** markdown `---` (`<hr>`) renders as a centred ⁂ instead of a rule.
- **Page number** styled as `— n / total —`.
- **Faint book spine** down the centre gutter between the two columns (sits on the viewport, so
  it holds still while pages flip).

## 2026-07-23 — book mode: sepia, drop cap, #read link (v1.4.32)

- **Always warm-paper (sepia)** regardless of the site theme / dark mode — book mode overrides
  the theme tokens to a paper palette; closing restores the previous colours automatically.
- **`#read` deep link:** book mode is now driven by the URL hash — `…/slug#read` opens it on
  load, the toggle is a real `<a href="#read">` (shareable / copy-link), and Back closes it.
- **Drop cap** on the opening paragraph + oldstyle figures / ligatures where the reading face
  has them — the classic Western chapter opening.
- **Title** smaller (body size) and regular weight, so it recedes further.
- **First-line alignment fixed:** the reader now clones the inner `.prose` (one level, not the
  `#post-body` wrapper), so the first paragraph's top margin actually zeroes and the first
  column opens flush with the second.

## 2026-07-23 — book mode width + title (v1.4.31)

- **Spread now spans the full layout footprint incl. both side gutters** (`viewport − 2×rail
  left`, the centred layout's mirror), not just the narrow content column — wider, less cramped.
  Falls back to near-full width (capped 1400px) when no rail is on screen.
- **Title** in the top bar is no longer bold and uses the faint meta colour, so it recedes and
  the article stays the focus (size unchanged).

## 2026-07-23 — book mode polish (v1.4.30)

Feedback pass on the book reader:
- **Spread width now matches the site's content column** (`#post-body` width) instead of a
  fixed cap, so book mode is exactly as wide as the page reads normally.
- **Book typography reused:** the overlay carries `book-text`, so the same first-line indent +
  justified margins as the normal reading view apply (was plain blocks).
- **Chrome:** dropped the footer; the page count moved up next to the close button (top-right).
- **Title** in the top bar is now centred and larger.
- **First column opens flush** — zeroed the leading top-margin so the first line no longer
  drops down.

## 2026-07-23 — book reading mode (v1.4.29)

- **New "Chế độ đọc sách" reader** (`components/blog/BookMode.tsx`): a toggle on the post meta
  line (after the reading time) opens the article as a **fullscreen two-column book spread**,
  paged horizontally with the arrow keys / on-screen arrows and a soft fade between spreads.
- **Desktop + iPad only** (the toggle is hidden below the iPad width). Uses a fixed overlay, not
  the Fullscreen API, so desktop and iPad behave identically; mobile never shows it.
- **Non-destructive to the base page:** the reader clones the already-rendered `#post-body`
  (Shiki highlight, images, footnotes intact), so normal scroll / SEO / a11y / find-in-page are
  untouched. Content flows via CSS columns; media stays column-width and is capped to a page
  height so nothing overflows a spread. Respects `prefers-reduced-motion`.
- **Admin toggle:** `features.bookMode` (Admin → Settings → Features), **default on**.

## 2026-07-23 — admin Series manager + series-box polish (v1.4.28)

- **New Content → Series tab** (`SeriesManager.tsx`): lists every series (incl. drafts) with
  its ordered parts. Per series you can **rename** it (across all its posts, merges on
  collision), **remove** it (clears `series`+`series_order`; the posts stay), and **reorder**
  parts with up/down arrows. Backed by owner-gated `POST /api/series` (`updateSeries` /
  `reorderSeries`). Series data is derived from the dashboard's existing post index — no extra
  fetch.
- **Series box slimmed:** dropped the prev/next links (redundant with the ordered list); tuned
  the inner padding + part spacing. Removed the now-orphaned `seriesPrev`/`seriesNext` locale
  keys and the `prev`/`next` fields on `SeriesInfo`.
- **JetBrains Mono tracking:** the mono chrome ran airy — gave `jetbrains-mono` the same
  negative letter-spacing treatment Plex Mono already had (`-0.05em`, a touch tighter since
  JetBrains is wider), scoped to chrome text only (the reader's prose is untouched).
- **Refactor:** pure series ordering/grouping (`orderSeries`, `seriesEntries`) moved to a
  client/edge-safe `lib/series-order.ts` so the client `SeriesManager` can import it without
  dragging the db/sharp chain into the browser bundle; `series.ts` re-exports it.

## 2026-07-23 — drop the visible "Updated" line on posts

- Removed the "Updated <date>" text from the post meta line (owner preference — it added
  noise). The JSON-LD `dateModified` (invisible, SEO) is kept. Orphaned `updatedPrefix`
  locale key removed from all 6 dictionaries.

## 2026-07-23 — JetBrains Mono chrome font

- Added **JetBrains Mono** as a second self-hosted monospace option for the system/chrome
  font (Admin → Appearance → System font), alongside IBM Plex Mono. One VARIABLE woff2 per
  subset (wght 100–800; latin + latin-ext + **vietnamese**), so a single face covers every
  weight. Vietnamese coverage verified (U+1EA0–1EF9 + Ă/Đ/Ơ/Ư/₫ present in the subset). Pick
  it from the appearance settings; nothing changes until selected.

## 2026-07-23 — newsletter broadcast + reply notifications (batch 7b)

Completes the newsletter (built on 7a's subscribe/opt-in/SMTP foundation).

- **Broadcast on publish.** When a post first goes live it is emailed ONCE to confirmed
  subscribers (title + excerpt + link + per-recipient unsubscribe). Tracked by a new
  `posts.broadcast_at`; the cron (`broadcastDuePosts`, run on the 5-min publish tick + the
  hourly backstop) finds published, date-reached, not-yet-broadcast posts, sends, and stamps
  them. Scheduled (future-dated) posts broadcast when they actually go live, not when saved.
- **No back-catalogue spam.** The migration backfills every already-live post's `broadcast_at`,
  and `broadcastDuePosts` stamps a due post even when SMTP is off or there are no subscribers —
  so enabling the newsletter later never blasts old posts. Editing a post never re-broadcasts
  (the upsert leaves `broadcast_at` untouched).
- **Comment-reply notifications.** Replying to a comment emails the parent commenter (best-
  effort, transactional; skips self-replies and a deleted parent). Sent via `after()` from the
  comment route (`notifyReply`); no-op without SMTP.
- Pure email builders (`lib/newsletter-email.ts`) — escaped, unit-tested. Migration
  `2026-07-23-broadcast.sql`. i18n ×6. +3 tests.

> **Enabling it:** set SMTP in Admin → Settings → Integrations → Newsletter. Until then the
> sign-up form is hidden and all sends are no-ops (rows/stamps still recorded correctly).

## 2026-07-23 — footnotes + music embeds (batch 6c)

- **Footnotes.** Write `a claim[^1]` + `[^1]: the source` — the reference renders as a
  superscript link and the definitions collect into a list at the foot of the article (with
  back-links). Numbered by first reference. Because the renderer escapes raw HTML (and marked
  has no footnote support), this is done by pre-processing the markdown — references become
  private-use placeholders that survive marked, then become `<sup>` links + the list after
  render (`lib/footnotes.ts`). A `[^x]` inside a fenced code block is left alone; definition
  text is rendered through `renderInlineMarkdown` (escaped). +10 tests.
- **Spotify + Apple Music embeds.** Paste a track/album/playlist (or Apple Music album/
  playlist/song) URL on its own line → a compact audio player, via the SAME plain-`<iframe>`
  path as the video embeds (`videoEmbed`) — no third-party widget script, no CSP change. The
  Apple Music URL is quote-guarded so it can't break out of the iframe `src`.
- **Not doing X / Instagram / gist embeds:** those require third-party widget scripts + CSP
  allowances, and the owner doesn't use them — dropped from the plan (not deferred).

## 2026-07-23 — newsletter: subscribe / opt-in / SMTP (batch 7a)

Own-your-stack newsletter foundation — self-host SMTP, no third-party lock-in.

- **Subscribers + double opt-in.** `subscribers` table (email unique, status
  pending/confirmed/unsubscribed, per-subscriber token). `POST /api/subscribe` creates a
  pending row + emails a confirm link; `GET /api/newsletter/confirm` flips it to confirmed;
  `GET /api/newsletter/unsubscribe` opts out. Confirm/unsubscribe render a standalone result
  page (opened from an email, no app shell). All three are public + rate-limited.
- **SMTP via Nodemailer** (`lib/mail.ts`) — config on `integration_keys` (server-only secrets,
  never in settings.data; env fallback). `sendMail` degrades gracefully when unconfigured (no
  500). Admin: an SMTP config card + subscriber list (counts + delete) in Settings →
  Integrations. New dep: `nodemailer`.
- **Public sign-up form** (`SubscribeForm`) shown at the foot of a post **only when SMTP is
  configured**. i18n ×6 (form + opt-in email + result pages + admin).
- Migration `2026-07-23-newsletter.sql`.

**Deferred to 7b:** broadcasting a post to confirmed subscribers (send-on-publish) and
comment-reply notifications — the send paths that need live SMTP creds to verify end-to-end.

## 2026-07-23 — callouts + copy-code button (batch 6b)

Render-layer editor extras.

- **Callouts:** a blockquote whose first line is `[!NOTE]` (also `TIP` / `WARNING` /
  `IMPORTANT` / `CAUTION`) renders as a labelled callout box. Monochrome by design — an accent
  left-border + a bold label carry the meaning, so it stays on the palette (no semantic
  colours). Post-processed in `PostContent.tsx` (`buildCallouts`); an unknown `[!FOO]` or a
  plain quote is left untouched. +4 tests.
- **Copy-code button:** every code block gets a "Copy" button (the `CodeCopy` client island
  attaches it on mount — the code HTML is server-rendered by Shiki). Revealed on hover, always
  shown on touch. i18n ×6.

**Still deferred (need heavier work, tracked separately):** footnotes — the markdown renderer
escapes raw HTML, so these need a proper `marked` extension, not post-processing; and X /
Instagram / gist embeds — those require third-party widget scripts + CSP allowances.

## 2026-07-23 — per-post SEO, cover image, real dateModified (batch 6a)

Post-metadata half of the editor-completeness batch.

- **Per-post SEO overrides:** `meta_title` / `meta_description` columns. When set they drive the
  `<title>`, meta description, and OpenGraph/Twitter card; blank falls back to the post title +
  excerpt (unchanged behaviour). Editor: an "SEO title / SEO description" section in the post
  settings panel.
- **Cover image:** a `cover_image` — a visible hero shown at the top of the post (and the OG image
  fallback, ahead of the SEO-only featured image). Editor: a Cover image picker.
- **Real `dateModified`:** the Article/BlogPosting JSON-LD now emits the actual last-saved time
  (was a placeholder equal to `datePublished`); the post meta line shows "Updated <date>" when an
  edit lands >24h after publishing. Uses the existing `updated_at`.
- Migration `2026-07-23-post-meta.sql`. i18n ×6 (public "Updated" + admin labels).

**Deferred to batch 6b** (render-layer editor extras): footnotes, callouts/admonitions, code
copy button, and X/Instagram/gist embeds.

## 2026-07-23 — series / collections (batch 5)

Group posts into an ordered **series** (e.g. a multi-part guide).

- **A series is just a name + order on the post** (`series`, `series_order` columns) — no
  separate table. Assign one in the editor (Series field with autocomplete of existing
  names + an Order number). Migration `2026-07-23-series.sql`.
- **Series box** at the top of every post in a series: the ordered list of parts (current
  one highlighted), a "Part n/total" label, and prev/next links within the series
  (`lib/series.ts` → `getSeriesForPost`; public parts only). Ordered by `series_order`, then
  chronologically as a tiebreak.
- **`/series/[slug]` page** lists a series in order (a new public route, ISR-cached; slug
  derived like categories/tags). i18n ×6. +4 tests.

## 2026-07-23 — URL redirects (batch 4)

Move a URL without breaking links. Manage 301/302 redirects in **Settings → SEO**.

- **New `redirects` table** + `lib/redirects.ts` (CRUD) + owner-gated `api/redirects`.
  Migration `2026-07-23-redirects.sql`.
- **Real HTTP redirects from middleware.** `middleware.ts` resolves the request path
  against a redirect map (301 permanent / 302 temporary) BEFORE any render — a page-level
  `redirect()` under a route with a `loading.tsx` is downgraded by Next to a 200
  meta-refresh, so the redirect must come from the edge. The map is fetched from PostgREST
  with a plain (edge-safe) fetch and cached in-process for 60s; the matcher now runs on all
  paths except `/_next` and `/uploads`. Fail-open — a lookup error never blocks a request.
- **Auto-301 on slug rename.** Renaming a post/page slug adds a permanent redirect from the
  old path (existing links + search results keep working); saving a slug also clears any
  stale redirect that used it as a source, so live content always wins and a rename-back
  can't self-loop.
- Admin: a **Redirects** card (list + add + delete) in Settings → SEO. i18n ×6. +8 tests.

## 2026-07-23 — scheduled publishing (batch 3)

Publish a post with a **future date** and it goes live on time, automatically.

- **No new status.** A `published` post dated in the future is simply hidden by the existing
  read layer (`isPublicallyVisible` — lists, search, and the `/[slug]` page), so scheduling is a
  property of the date, not a state machine. New `isScheduled` helper = its exact complement.
- **Editor cue.** With a future date the Publish button reads **Schedule**, the toast says
  **Scheduled**, a "Scheduled for <local time>" note appears under the date, and the live
  "View post" link is hidden (the URL 404s until it goes live); "Preview draft" still works.
- **On time, not within the hour.** `lib/scheduled.ts` `sweepScheduled` (run by the cron) finds
  posts that crossed their time within a bounded lookback (`newlyLive`, a pure `(since, now]`
  window) and runs one `purgeAndWarm` so the edge 404 is flushed and the origin re-warmed. A new
  **5-min publish tick** (`/api/cron?publish=1`) does only this; the hourly maintenance tick sweeps
  a ~65-min window as a backstop. No watermark stored (an overlapping purge is an idempotent
  superset). `docker-compose.yml` + `docs/self-host-native.md` updated with the new cadence.

## 2026-07-23 — accessibility pass (batch 2)

Audit-driven a11y + polish across the reader and admin (no feature change):

- **Contrast:** secondary text (`--c-meta`) darkened to meet WCAG AA in light mode
  (dates, captions, excerpts, ToC, pagination); admin helper text likewise.
- **Keyboard focus:** one visible `:focus-visible` ring site-wide; comment fields no
  longer strip their outline.
- **Skip link:** a localized "skip to content" jump (all 6 languages) + `<main id>` so
  keyboard/screen-reader users bypass the header controls.
- **Headings:** a body `#` is demoted to `<h2>` so the post title stays the only `<h1>`
  (fixes the outline / duplicate-h1).
- **Comment form:** every field now has an accessible label (`aria-label`).
- **Lightbox:** its round controls render round again (they were squared by the global
  sharp-corner reset); pagination tap targets meet the 44px minimum.
- **Print:** a clean print/PDF stylesheet (drops chrome, black-on-white type).
- **i18n:** the last hardcoded Vietnamese strings in the editor chrome moved to locales.

## 2026-07-23 — pre-SaaS hardening (batch 1): safer restore + robustness

Foundational fixes from the pre-SaaS audit (no user-facing behaviour change):

- **Backup restore is now transactional.** The content tables are cleared + re-inserted
  inside one `restore_tables` DB transaction, so a mid-restore failure rolls the whole DB
  back instead of leaving the site half-restored. Identity ids are preserved, so threaded
  `comments.parent_id` links survive a restore (the old per-table path re-keyed and could
  break them). Requires migration `2026-07-23-restore-rpc.sql`.
- **Rate limiter no longer leaks memory** (evicts aged-out IP keys) and **prefers
  `CF-Connecting-IP`** over the client-forwardable `X-Forwarded-For`, so a spoofed header
  can't evade limits or poison the analytics visitor hash / country.
- **CSP hardening:** added the safe, no-nonce subset (`object-src 'none'`, `base-uri`,
  `form-action`, `frame-ancestors 'none'`); a full script-src+nonce policy is a follow-up.
- **Analytics inserts no longer swallow real errors** — the base-row fallback fires only on
  a genuine missing-column (42703, pre-migration); other errors are logged, not hidden.
- **Font src URLs are validated** before landing in `@font-face { src: url(...) }` (rejects
  `javascript:`/`data:` and `url()`-breaking characters).

## 2026-07-23 — admin Library + Settings declutter

- **Library (Images) is calmer and more usable.** New toolbar: total **count + size**, a **name
  search**, and a **sort** (newest / name / size). Each tile keeps the info you wanted — `dims · size
  · date` on one tidy row with a compact date — and the per-tile copy / download / delete actions now
  **overlay the thumbnail** (revealed on hover, always shown on touch) so they cost **zero layout
  height** and the grid reads clean. The grid is 5-across at desktop (was 6) so the caption fits
  without truncating. The three Library tabs use the shared kit `Tabs` (was a one-off inline copy).
- **Settings reorganized for clearer grouping.** WordPress **import moved out of Integrations** into
  **Content** (a one-time content tool, not an integration), so Integrations is now purely external
  services (Backup, MCP, Cloudflare). **Appearance** is two balanced columns — palette + custom CSS on
  the left, the type stack (font / typography / rendering) on the right — and **SEO** is full-width.
  Nothing stretches a narrow form across a lone full-width row.
- No behaviour or data changes — pure admin layout/UX; all settings and library actions work exactly
  as before.

## 2026-07-22 — analytics v2: engagement, audience, sources, per-page drill-down

- **Much deeper Analytics.** The overview now shows five headline metrics — views, visitors
  (trend + new-vs-returning), **avg time on page** (dwell), avg read depth, and a **bounce rate**
  (single-page-visit share) — a **dual-series time chart** (views + visitors, pure SVG; the year
  range buckets by month, 24h by hour), a **top pages** table where each row links to its own
  drill-down, **traffic channels** (Direct/Search/Social/Referral) beside top referrers, an
  **audience** breakdown (countries + **device / browser / OS**), and the **read-depth
  distribution**. All source/audience lists count **distinct visitors**, not page views.
- **Per-page drill-down** (`/admin/analytics?path=/slug`): one URL's trend, referrers, countries and
  read-depth over the same ranges.
- **Accuracy.** Time buckets are truncated in `ANALYTICS_TZ` (IANA zone, e.g. `Asia/Ho_Chi_Minh`;
  defaults to UTC) so "days" match local midnight instead of UTC — fixes the shifted-day drift. The
  bot filter also drops the common AI crawlers (GPTBot, ClaudeBot, CCBot, PerplexityBot, Bytespider…).
- **Privacy unchanged.** Audience columns are **coarse UA buckets** (device/browser/os) parsed at
  insert (`lib/ua.ts`) — the raw user-agent is never stored, so still no fingerprint / no cookies.
  Dwell time is sampled alongside scroll depth on page leave.
- **Migration:** run `scripts/migrations/2026-07-22-analytics-v2.sql` on the live DB (adds the
  audience/dwell columns + the tz-aware `analytics_summary` / new `analytics_page` RPCs). The UI
  falls back to the base shape and hides the new sections until it is applied.

## 2026-07-20 — grid-view toggle (admin); timeline polish

- **Grid view is now an owner feature toggle** (`features.gridView`, Admin → Settings → Tính năng, default
  on). Off hides the header grid/list button and the no-FOUC script ignores a stored `list=grid`, so every
  listing stays a list — handy because the infinite-scroll timeline is hidden in grid view.
- **Timeline redesign**: the feed is grouped by year and the **year is now a sticky header** (`fs-h3`) that
  pins to the top of the gutter while its months scroll, then gets pushed out when the next year arrives (its
  `--c-bg` tag masks months sliding under it). Months keep their round `--c-meta` dots; the spine is the faint
  `--c-rule` hairline of the sidebar dividers; dots are round (explicit exception to the square-corners rule).
  It also appears at a much lower viewport width (a short date label needs only a thin gutter), so it shows on
  normal laptops instead of only very wide screens.

## 2026-07-20 — infinite scroll + date timeline; condensed category cloud

- **Infinite scroll** (`features.infiniteScroll`, off by default; Admin → Settings → Tính năng):
  home / category / tag listings reveal posts on scroll instead of paginating. The full published
  list is handed to the new `InfiniteListing` client island as light metadata (no post bodies), so
  revealing more is pure client work — no network; the first `postsPerPage` chunk still server-renders
  for SEO, and `/page/[n]` URLs 404 (duplicate content).
- **Date timeline** in the right gutter when infinite scroll is on: a spine down the feed with a marker at
  each month/year boundary (bold year + accent dot, quiet month name) placed level with that period's first
  post, so the dates line up with the posts on the left and scroll with the page (pure CSS — no measurement,
  no counts, no click nav). Desktop list view only — hidden on mobile and in grid view. The left rail is
  forced to its single-rail (all-blocks-stacked) branch.
- **Categories in the sidebar** now render as a condensed wrapped cloud (`CategoryCloud`) with the post
  count in parentheses, instead of a tall one-per-line list — much less vertical space.

## 2026-07-19 — listing grid: 2 columns at reading-column width

- **Grid mode (home / category / tag listings) now stays 2 columns and keeps the
  reading-column width**, matching the list view. Dropped the desktop-only override
  that widened the grid into the free right gutter and laid it out in 3 columns
  (`listingGridCss` removed; the base `globals.css` 1/2-column grid is all that's needed).

## 2026-07-16 — video upload: Library Videos tab + native player

- **Library → Videos tab** (between Images and Files): upload videos (drag-drop,
  `video/*`), preview in a grid of native players, copy URL, multi-select delete.
  Videos are attachments in the shared files store — no schema change.
- **Self-hosted video in posts**: paste the video URL on its own line (like a
  YouTube link) → the published page renders a native `<video>` player. Content
  stays 100% Markdown.
- **`/uploads` now streams with byte-range support** (206) — video seeking and iOS
  Safari playback work; large files no longer buffer whole in server memory (images
  benefit too). Video/audio MIME types added so browsers play instead of download.

## 2026-07-15 — leaner reader payload, one font law, agent-ready

Performance:
- **Split the stylesheet** into a public and an admin entry (Tailwind scoped per surface),
  so a reader never downloads admin CSS — public CSS dropped ~13 KB → ~9 KB gzip.
- **Lazy-load the comment island** (with its `next-auth` dependency) below the fold via
  `IntersectionObserver` — it's out of the initial reader payload until scrolled near.
- **Font loading is now one system-wide law** (`docs/performance.md`): preload only the
  reading font (the LCP title) subsets the site language needs — latin, plus vietnamese
  on a vi site, nothing for CJK or an uploaded custom font — and never the chrome font.
  Cuts the font contention on the LCP critical path for every language/preset/upload.

Agent-ready (AI agents can find, read, and drive the site):
- **Markdown for Agents**: request any post/page with `Accept: text/markdown` to get its
  authored Markdown instead of HTML.
- **Discovery**: MCP Server Card (`/.well-known/mcp/server-card.json`), API Catalog
  (`/.well-known/api-catalog`, RFC 9727), `/auth.md`, and homepage `Link:` headers.
- **`Content-Signal`** in `robots.txt` declaring content-usage preferences.
- Fixed a reverse-proxy rule that was returning 404 for the OAuth/MCP discovery routes.

## 2026-07-14 — sidebar refinements

- Sidebar order is now **menu → most viewed → featured → categories → tags** (categories sit directly
  above tags).
- **Most viewed** defaults to **3** posts and is configurable in **Settings → Site → Layout & menu**
  (0 hides the block).
- The **Featured** picker moved to **Settings → Site → Layout & menu**, right under the site menu.
- Post/page **reading views no longer show the menu/blocks** in the rail — only the table of contents.
  The main (listing) sidebar keeps the full menu + blocks.
- **Footer links open in a new tab** by default (external links only).

## 2026-07-14 — site menu moves into the sidebar; wider rail

- The **site menu** now lives at the top of the sidebar (above Categories) instead of a header
  dropdown. On desktop it sits in the always-visible left rail; the header menu button is gone.
- On mobile the header keeps a menu button, but it now opens the **sidebar drawer** (menu + the rest)
  rather than a separate dropdown — one drawer for everything. The old edge-handle tab is retired.
- The desktop rail is **wider** (210 → 250px) so longer titles wrap less; the gap tightens slightly so
  laptops keep the gutter rail. The mobile drawer is unchanged.

## 2026-07-14 — sidebar: most-viewed & featured posts

- The listing sidebar now shows two new blocks between **Categories** and **Tags**: **Most viewed**
  (automatic — top 5 posts by all-time views) and **Featured** (owner-curated). Each hides itself
  when empty.
- **Featured** is picked in **Admin → Settings → Content**: an ordered list of published posts
  (add / reorder / remove); the first 5 render, in that order, and any post that stops being public
  drops out automatically.
- The view-totals read now uses a cache-eligible GET rpc, so listing pages stay statically ISR-rendered.

## 2026-07-14 — fix intermittent image-upload / save-draft failures

- Fixed a native-only bug where generating an image's responsive variants/thumbnails read the
  original back over HTTP from its store URL. On the local-filesystem store that URL is a
  relative `/uploads/...` path with no origin, so the server-side fetch threw "Failed to parse
  URL" — surfacing as an occasional upload error, a failed **Save draft** (the save also
  finalizes the images it embeds), and hourly cron errors. Variants/thumbs now read the bytes
  straight from the store; a missing original is skipped instead of throwing.

## 2026-07-14 — IBM Plex Mono chrome tracking

- Tightened the interface tracking by `-0.04em` **only** when the system font is IBM Plex Mono, so the
  wide monospace no longer reads as spaced-out in the rail, menu, footer, and dates. Scoped to the
  chrome via `<html data-chrome-font>`; article text and the other system-font choices are unchanged.

## 2026-07-14 — system-chrome font selector

- Added a **System font** selector (Admin → Appearance) that sets the interface face — header,
  footer, menu, dates, admin — independently of the reading font, so the chrome can use a code
  font while article text stays readable. Options: Inter (default), the reading font, or the new
  self-hosted **IBM Plex Mono** (latin / latin-ext / Vietnamese, preloaded only when active).
- Replaced the old "keep the interface in Inter" toggle; existing sites that had it off now follow
  the reading font automatically, with no visible change.

## 2026-07-13 — editor focus and typewriter feedback

- Removed the global admin focus rectangle from the TipTap writing surface; keyboard focus remains
  visible on actual controls, while the editor continues to sit inside its bordered card.
- Added a visible block-style typewriter caret plus distinct insert/delete strikes on the active line.
  The caret is an overlay, so it never enters the ProseMirror document or changes selection; its blink
  and strikes respect both the site motion switch and reduced-motion preferences.
- Added generated mechanical key clicks, ultimately raised from 20% to 45% internal volume after production review: insertion is short and crisp, deletion
  is slightly lower. Audio is created locally with Web Audio, has no asset/network request, and only
  runs from direct editor input (composition updates are excluded).
- Added an Appearance → Rendering switch for all typewriter feedback. It persists in the existing
  motion settings and disables the custom caret, line response, and sound together.

## 2026-07-13 — admin form and toolbar visual correction

- Centered the editor formatting row whenever it fits, while retaining one-line horizontal scrolling
  on narrow screens.
- Reworked palette selection so inactive and hidden themes remain legible; selection, visibility, and
  default state now use neutral borders and surfaces instead of fading the complete control.
- Standardized backup scheduling and WordPress import around the shared rounded inputs and buttons.
  The native file-picker chrome is hidden behind an accessible, labeled control; all behavior is unchanged.
- Confirmed the light admin canvas remains a true neutral gray (`#f5f5f5`) with no blue tint.

## 2026-07-13 — editor toolbar and admin footer correction

- **Editor toolbar:** converted descriptive actions to compact line icons while preserving B/I/U/S,
  P, and H1–H5 as familiar text marks. The toolbar is permanently one row, horizontally scrollable
  at every breakpoint, and table actions join the same row contextually. Removing `overflow-hidden`
  from the editor frame restores reliable sticky behavior while scrolling.
- **Editor spacing/title:** reduced the gap below the action header and above the writing frame;
  post titles now auto-grow to their complete wrapped height instead of being clipped to two rows.
- **Sidebar footer:** light/dark now carries its sun/moon icon and shares the exact row geometry of
  Clear cache and Sign out. Admin canvas changed from cool gray to a true neutral `#f5f5f5`.

## 2026-07-13 — modern admin design system

- **Admin-only rounded component system:** the global square-corner rule now excludes `.admin-shell`.
  Public reading pages remain untouched; admin cards/tables use 16px, grouped controls 12px, and
  buttons/inputs/navigation 8px. Focus rings, borders, shadows, heights, and hover states are shared.
- **Layout and navigation:** rebalanced the admin workspace around a 208px desktop sidebar (72px
  collapsed), 1480px content ceiling, responsive gutters, clearer active rows, and a floating mobile
  drawer. The cool-gray monochrome palette remains; no public palette color enters admin.
- **All main surfaces:** modernized Overview, Analytics, Content, Comments, Media, Trash, Settings,
  Log, Help, the post editor, and the page editor. Stats are separate cards, tabs are segmented,
  tables have rounded frames and hover rows, settings keep two columns, and editor header/writing/
  property surfaces now align visually.
- **Behavior preserved:** no route, API, schema, query, form state, autosave, revision, preview,
  upload, cache, backup, publishing, or deletion logic changed in this redesign.

## 2026-07-12 — UI follow-up and owner-approved baselines

- **Public header icons:** restored the established search, three-circle palette, applied-theme
  sun/moon, and asymmetric two-line menu glyphs after a replacement set failed visual review.
  `ICON_BTN` remains the single source for their button size, alignment, and interaction chrome.
- **Mobile reading rail:** reduced the edge handle from 24 × 76px to 16 × 64px and its chevron to
  10 × 18px, with quieter neutral fill and opacity. The drawer behavior and reading-column layout
  are unchanged.
- **Documentation baseline:** recorded that public typography is intentionally unchanged, desktop
  Settings remains two-column, H1–H5 remain directly available in the editor, the editor header is
  framed and aligned to the writing surface, and Clear cache remains in the admin sidebar footer.

## v1.4.5 — 2026-07-11 (docs refresh)

Documentation only — no code change. Brings the project "About" (README's *What it is*) and the internal
docs current with the v1.4.4 line. README now lists the editorial admin, drag-drop / paste uploads (incl.
AVIF), the captioned-figure sizes (column / large / full-bleed / gallery), full-bleed mobile images, and
the in-app Help / Guide. `docs/features.md`, `ARCHITECTURE.md`, `docs/conventions.md` and `CHECKLIST.md`
are re-synced to the redesigned admin (flat canvas, slimmed Overview, light/dark + Sign-out footer, the
post editor's sticky header) and the full 15-table schema list.

## v1.4.4 — 2026-07-11 (stable: reading layout, admin redesign, media hardening)

Consolidates the whole 1.4.1–1.4.4 line into one stable entry: the sidebar rail + accent colour and
layout toggles, built-in reading fonts + book-page text, the nested/scrolling table of contents, SEO
(canonical + breadcrumbs), cache-clear-on-deploy, a fuller admin dashboard + Help page, an editorial
redesign of the admin workspace, full-bleed mobile images, and a hardened image upload/delete path.
Nothing here changes an existing install's hue or breaks its settings.

**Admin — an editorial redesign of the workspace.** The admin adopts a calmer, monochrome design system:
the editor chrome and the settings grid are realigned, the action header is framed, and long editor titles
wrap instead of overflowing. Structure and behaviour are unchanged — it just reads cleaner.

**Reading — large images go full-bleed on phones.** On a phone every in-body image now spans edge to edge
of the screen (gallery grids excepted) for an editorial look — no horizontal scroll. On wide screens the
"large" size (renamed from "Wide +30%") noses right into the free gutter by one rail width instead of
overflowing both sides / colliding with the ToC rail; on tablets and narrow desktop it sits at the column
width.

**Editor — the draft preview opens in a new tab and is always current.** The "Preview draft" button (was a
copy-link) saves any pending edits first, then opens `/preview/{slug}` in a new tab; the preview page reads
live (`fetchCache='force-no-store'`) so it never shows a stale revision after a save.

**Media — upload & delete hardened.** The original is written with an exclusive (O_EXCL) file write, so two
concurrent uploads that pick the same name retry a fresh name instead of overwriting each other and 500-ing
on the `path` primary key. Dimensions + the thumbnail are best-effort — a valid image never fails the upload
because thumbnailing hiccuped. AVIF is accepted; unsupported types show a clear message. Purging a trashed
image still referenced by a post/page/revision/setting now asks for confirmation before it can break a live
page.

**Admin — a Help / Guide page.** A new sidebar item (`/admin/help`) with a concise, sectioned index:
writing &amp; publishing, the five settings tabs, server &amp; self-host, Cloudflare (Cache Rules, Tiered
Cache, SSL, auto-purge), cache &amp; operations, and MCP — each linking out to the repo docs for depth.
Content is English (canonical, like the docs); the nav label + title are localized in all six languages.
Pure server component, ships no client JS.

**Cache — "Clear all cache" (and the deploy flush) now re-prime in the right order.** The warm step used
to run BEFORE the Cloudflare purge (which fired post-response), so it re-cached stale bytes the purge then
wiped — leaving the cache cold. `purgeAndWarm()` now purges the origin ISR + the whole CF zone FIRST, then
re-warms the origin render cache (home + newest pages, over loopback so it's reliable). This primes the
**origin** render cache — a reader's first post-purge miss renders fast instead of cold. (Pre-filling the
CF edge for a distant reader's region isn't possible from the origin — CF cache is per-datacentre; enable
**CF Tiered Cache** so a POP miss pulls from a warm tier instead of the far origin.)

**Fix — no more "stuck on the loading skeleton after a deploy."** A frequent deploy left already-open
tabs on the old build; a soft navigation then mixed an old client runtime with new-build RSC/chunks and
the router hung on the skeleton until a manual reload. `next.config` now sets a per-deploy `deploymentId`
(read from a `.deployment-id` file the deploy writes before build), so Next tags every asset/RSC request
with `?dpl=<id>` and the client hard-reloads the instant it sees a different id from the server — it
self-heals instead of getting stuck.

**OG card — post share previews show title + excerpt + date.** The generated Open Graph / Twitter card
for a post replaces the bottom "site name" line with a fuller excerpt (up to 320 chars, 4-line-clamped) and its publish
date, so a shared link reads like the homepage entry. Home/category/tag cards are unchanged. `/og` gains
`desc` + `date` query params.

**Reading — nested table of contents.** When a post mixes heading levels (H2 + H3), the top-level (H2)
rows get a bigger dot marker and the child (H3) rows go smaller with no dot — a few big markers over
quieter children. A post that is all-H2 or all-H3 stays uniform, as before. A long ToC that outruns the
viewport now scrolls inside its own (sticky) box instead of pinning its tail off-screen, and the gutter
rail is 30px wider (210px) to wrap less — the breakpoint is unchanged, so 1280/1366 laptops still show it.

**Admin — a fuller Overview.** The dashboard gains an **SEO health** card (published count + how many
posts miss an excerpt or a cover image, each linking to Content), a **Traffic sources** card (top
referrers + countries over 30 days by distinct visitor), a **Clear cache** button and a **View site**
link in Quick actions, and the System panel's Backups row now shows the **last run** (or "never").

**SEO — canonical + breadcrumbs.** Every indexable page now emits a self-referencing
`<link rel="canonical">` (home, posts, pages, category/tag, and each `…/page/[n]`), and posts carry a
`BreadcrumbList` (Home → category → post) alongside the existing `BlogPosting`. `/page/1` (and
`/category|tag/<x>/page/1`) now 308-redirect to the base instead of serving a duplicate of page 1.
(Unknown URLs already return a `noindex` soft-404 — Next's documented streaming behaviour — so they
were never indexable; no change there.)

**Cache — deploy flush.** `GET /api/cron?purge=1` (same `CRON_SECRET` auth) forces a full
`revalidateEverything()` — Next paths + the whole Cloudflare zone — so a code deploy, which runs no
admin write, still clears the edge. Content saves and the "Clear all cache" button already purge the
zone when the CF token+zone are set.

**New — built-in fonts** (Admin → Appearance → Font). Four self-hosted families: Inter, Source
Sans 3, Literata, Source Serif 4. Each is subset per unicode-range, so a family downloads only when
chosen. Picking a font also loads its tuned text sizing (a serif runs small, wants a tighter
leading) into the editable roles, which the owner still owns. An uploaded custom font overrides the
chosen built-in. (Bookerly was requested but is Amazon-proprietary; Source Serif 4 stands in.)

The chosen font styles the reader's words — post body + title, list cards, comment body, and the
editor. System chrome (dates, reading-time, related posts, header, footer, sidebar, admin) stays
Inter by default; a `fontChromeInter` toggle (Admin → Appearance) extends the chosen font across the
whole interface when turned off.

**New — book-page reading** (Admin → Settings → Features, `bookText`). Optional typesetting for the
post body: a first-line indent on each paragraph and justified text on columns 600px and wider, for a
printed-page feel.

**Sidebar — reaches every listing and marks where you are.** It now shows on home pages 2+ and on
category and tag archives (not just home page 1); the category or tag you are viewing carries the
accent mark, like a post's table of contents. Its breakpoint dropped so common 1280/1366 laptops show
the rail in the gutter instead of only the drawer handle.

**Fix — editor shows every category and tag.** The category/tag picker capped its suggestions at 12,
so terms past the first dozen never appeared to click. It now offers them all (scrollable), and typing
filters the list by substring.

**MCP — `patch_post`.** A new tool that partially updates one post by slug: only the fields you pass
change, the body and everything else stay put. Lets an agent tweak just the title, tags, or category
without resending the whole post (`update_post` still does a full replace).

**Fix — no more empty-slug posts.** A title/slug made only of emoji or punctuation slugified to `''`,
and the empty-slug row was unreachable from the editor and Trash (couldn't be edited or deleted).
`savePost`/`savePage` now fall back to a timestamped slug, so every post/page keeps an editable identity.

**Fix — serif reading fonts sit lighter.** Literata and Source Serif 4 rendered a large body (19px) and
a very black 700 bold that out-weighed the 600 headings, so bold read like a second heading. Body drops
to 18px (Literata) / 18.4px (Source Serif); presets now carry `readingBold: 600` (`--reading-bold`) so
`.prose` bold stays emphasis beneath the headings. Sans faces are unchanged.

**New — the sidebar rail.** Categories + tags (home) and a post's table of contents now live in the
left gutter, sticky, ranged right against a hairline divider, their first line level with the
content's first line. The reading column stays exactly centred: the rail is absolutely placed and
never displaces it. Its breakpoint is computed from `contentWidth`, so a wider column keeps the rail
hidden for longer. Below that width the SAME markup becomes a slide-out drawer behind a small edge
handle (`RailHandle` toggles `<html data-rail>`; drawer, handle and scrim all react in CSS).

**New — `accent`, a 7th palette colour** (Admin → Appearance). One highlight, used identically
everywhere: the marker beside the rail row you are reading, and the underline under any link you
hover (`.link-accent`, plus `.prose a:hover`). Seeded from each palette's `link`, so Mono stays
monochrome and no existing site changes hue. Settings saved before this key migrate on read.

**New feature toggles** (Admin → Settings → Features), all default on: `sidebar`, `leadPost` (the
newest post on home page 1 takes the h1 role), `categoryLabel`, `deck` (the excerpt as a standfirst
under a post title). Title display sizes come from the h1/h2 type roles, never a hardcoded value.

**Fixed**
- The table of contents never marked the section you were reading. An `IntersectionObserver` over
  the headings goes blank mid-section — the heading has already scrolled past, so nothing intersects.
  It now tracks the last heading past the reading line, coalesced to one measurement per frame.
- The drawer handle jumped half its height down the screen on every tap: it centred itself with
  `transform: translateY(-50%)`, which the global press feedback (`button:active{transform:scale(.97)}`)
  overwrote. It centres with `translate` now.
- The rail rendered before the page heading, so every page's outline opened with the sidebar's `h2`
  ahead of the article's `h1`.

**Changed**
- The table of contents is no longer a bordered, shadowed panel pinned to the viewport edge; it is
  type in the rail. It now opens with the post title (click = back to top) and closes with the
  tags/categories/comments jump, so a post with no headings still gets a usable index.
- The global `<hr>` runs the full column width instead of a left-aligned 50% stub.
- No rule between list cards and none under a post title: whitespace separates them. The
  end-of-article rules (before tags / related / comments) stay.

## v1.4.0 — 2026-07-09 (WordPress import, ops hardening, deep-audit fixes)

Outcome of a full read-through audit (UI/UX, typography, logic/cache, security, self-host
readiness). No CRITICAL/HIGH security holes were found; the rest is new capability + fixes.

**New — WordPress import (Admin → Settings → Integrations)**
- Upload a WordPress export (`Tools → Export → All content`, a WXR `.xml`) and its posts + pages
  import as Markdown — no CLI, no credentials. HTML → Markdown (turndown + GFM), categories/tags/
  dates/status/excerpt preserved, figure captions folded into the image alt, `Uncategorized` dropped.
  New content is ADDED (slug collisions get a numeric suffix; nothing is overwritten); images keep
  their source URLs. `lib/wordpress-import.ts` (pure, tested) + `POST /api/import/wordpress` +
  `ImportFields`. Replaces the removed, broken legacy CLI script.

**Ops / self-host readiness**
- **`GET /api/health`** — liveness/readiness probe (Postgres reachable + local store writable, 200/503);
  wired as the Docker `app` healthcheck.
- **Boot-time env validation** — `src/instrumentation.ts` + `src/env.ts` fail fast with a readable list
  when a required var is missing (guarded off build + edge, so `next build` still needs no backend env).
- **DB migration runner** — `schema_migrations` ledger + `scripts/migrate.sh` (`npm run migrate`) apply
  pending `scripts/migrations/*.sql` idempotently on upgrade; a Docker one-shot `migrate` service runs
  it before the app. Fresh installs seed the ledger from `schema.sql`.
- **Community + CI** — `SECURITY.md`, `CONTRIBUTING.md`, issue/PR templates, and a CI workflow
  (`check:all` + `build`).

**Security hardening**
- Generous per-IP rate limits on the public endpoints (`lib/rate-limit.ts`): `/api/track` (240/min,
  silent drop), `/api/search` (60/min → 429), `/api/mcp/register` (5/min).
- `/api/mcp/register` now gated behind `mcpEnabled()` (503 when off) so a disabled server can't grow
  the `mcp_clients` table.
- `/api/cron` uses a constant-time bearer compare; its maintenance steps are isolated so a finalize
  failure no longer skips the backup, and backup failures are logged.
- Backup **restore aborts** if the pre-restore safety snapshot fails, instead of overwriting with no
  recovery point.

**Fixes**
- Sitemap no longer lists category/tag URLs that 404 (derived from public posts only).
- Admin palette label `scifi` was keyed on a stale `rose` in all 6 locales → every language fell back
  to English; fixed.
- Admin Media/File library dates were hardcoded Vietnamese in every language → now locale-aware.
- A just-saved post now re-purges once its deferred AVIF/WebP variants finish, so `<picture>` appears
  without waiting on the ~1h ISR window.

**UI / typography**
- **Sharp corners everywhere** — one global `border-radius: 0` reset (house style).
- Removed `tracking-tight` from public headings so the Admin letter-spacing control actually applies.
- Visible focus ring on the two public search inputs.

**Cleanup**
- Removed dead code (`blobOrigin` + its layout block, `deleteByUrl`, `countByPost`, `tokenLimit`, an
  unused `signIn`); deduped `escapeHtml`; excerpt now clamps by chars too.

> Note: the CI workflow file (`.github/workflows/ci.yml`) must be added by a push with the GitHub
> `workflow` OAuth scope — it ships in the repo tree but a scopeless token can't create it.

## v1.3.6 — 2026-07-04 (fix: Cloudflare integration card reflects the saved state at once)

- The Cloudflare cache card now `router.refresh()`es after a successful save, so the "· saved"
  placeholder hint updates immediately instead of only after a manual page reload.
- Operational note (self-host): after an `ALTER TABLE` on a live database, reload the PostgREST
  schema cache (restart the service or `NOTIFY pgrst, 'reload schema'`) — otherwise PostgREST keeps
  its old schema and silently ignores writes to the new columns.

## v1.3.5 — 2026-07-04 (Auto CDN purge: Cloudflare cache clears on every write)

- **Cloudflare cache auto-purge.** Enter a Cloudflare API token (Zone.Cache Purge permission) + Zone
  ID in Admin → Settings → Integrations; the app then purges the whole zone on every content change
  and on "Clear all cache", so an edit is live instantly with no manual purge. Best-effort and
  non-blocking (fires after the response via `after()`), a no-op when unconfigured. Credentials are
  server-only (the `integration_keys` table, env fallback `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID`),
  never sent to the client. New `lib/cdn.ts`, hooked into `lib/revalidate.ts` (the single write choke
  point `freshenData`), new `CloudflareFields` admin card + `POST /api/integrations/cloudflare`.
- DB: adds `cloudflare_api_token` + `cloudflare_zone_id` to `integration_keys` (idempotent upgrade in
  `scripts/schema.sql`).

## v1.3.0 — 2026-07-04 (Native self-host: drop Vercel + Supabase-cloud, local-filesystem storage)

Quire is now self-hosted only, in two deploy flavors: **native** (install PostgreSQL + PostgREST +
the app directly on a Linux server) and **Docker** (unchanged). Vercel hosting and Supabase-cloud are
no longer supported targets.

**Storage: local filesystem only**
- Removed the Vercel Blob storage driver and the `@vercel/blob` dependency; binaries always live on
  the local filesystem (`STORAGE_LOCAL_DIR`, served at `/uploads`). `blob.ts` is now a thin facade over
  `blob-local.ts` (lazy-loaded so `node:fs` stays off the client). Deleted the browser-direct-upload
  token routes (`/api/{media,files}/blob-token`) and the `STORAGE_DRIVER` / `NEXT_PUBLIC_STORAGE_DRIVER`
  switches — uploads always POST to the server (no 4.5MB cap).
- Image refs stay store-relative: `collapseBlob` strips the `/uploads` prefix, `expandBlob` re-adds it.

**Deploy**
- New native install guide (`docs/self-host-native.md`) + systemd / PostgREST config templates in
  `deploy/native/`. Removed `vercel.json`.
- `.env.example` is now the native template. `SUPABASE_URL` points at your own PostgREST endpoint with
  `POSTGREST_DIRECT=1`; the `supabase-js` client and `SUPABASE_*` env names stay because they speak the
  PostgREST protocol, not a Supabase cloud project.
- Admin System panel reports self-host facts (Self-hosted / PostgreSQL / Local filesystem); dropped the
  Vercel region/branch/commit rows and the Supabase/Blob dashboard links.
- Analytics + comments read the visitor country from the CDN/proxy edge header (`cf-ipcountry`).

**Migration**
- `scripts/legacy/blob-to-local.mjs` mirrors a legacy Vercel Blob store to the local filesystem
  (pathnames preserved, so store-relative content renders unchanged).
- Docs refreshed to the native-first model (README, ARCHITECTURE, CLAUDE, ROADMAP, CHECKLIST, docs/*).

## v1.2.6 — 2026-06-26 (Quire 1.2: rebrand, dashboard, deeper analytics, galleries, lightbox & reworked editor)
Consolidates the whole 1.2.0–1.2.6 line into one entry.

**Rebrand**
- Renamed the project to **Quire** (a.k.a. Quire Blog): brand, wordmark (`quire`**blog**), package
  name, Docker/Postgres/MCP identifiers, GitHub URLs and the Drive backup folder (`quire-backups`);
  the `vibeblog-private` creds repo keeps its name.

**Admin dashboard & analytics**
- **Overview is now a dashboard:** a Traffic card (30-day views + visitors with a sparkline +
  last-7-days), Most-viewed posts, and a Needs-attention card (draft count).
- **Deeper analytics:** period-over-period trend (▲/▼) on views + visitors, a new-vs-returning split,
  top pages as a labelled Page/Views/Visitors/Depth table, and top referrers + countries counted by
  **distinct visitor** (one person = 1, not page views; country shows a flag) + a CSV export of the
  daily series. Needs a one-time DB migration (`scripts/migrations/2026-06-25-analytics-deepening.sql`
  then `…-analytics-fix-visitor-counts.sql`); until applied those sections fall back / stay hidden.
- **Faster admin home:** dropped a per-post content scan (`findUnusedMedia`, hundreds of serial
  queries) from the dashboard — it stays an on-demand check on the Media page.

**Image galleries & lightbox**
- Mark images `#grid` (a toolbar **Gallery** button with a multi-select picker, or the per-image
  **Grid** toggle); consecutive ones render as a **smart CSS grid** whose column count adapts to the
  image count (2→2, 3→3, 4→2×2, 5–9→3, 10+→4; collapses to 2 on phones).
- Picking several gallery images inserts **all** of them in one transaction (was keeping only the
  last — each `setImage` replaced the prior selected node).
- The editor preview lays gallery images **side-by-side** like the published grid (via
  `.react-renderer:has(> figure.img-grid)`), distinct from full-width single images.
- **Lightbox:** clicking any post/page image opens a full-size overlay with prev/next, keyboard nav
  (←/→/Esc), a counter and the caption.

**Editor**
- **Offline local autosave** (`useLocalDraft.ts`): unsaved edits are stashed in `localStorage` every
  8s and never hit the server until Save/Publish — editing a *published* post can no longer push
  half-finished text live, and a dropped connection won't lose work. A "restore / discard" bar offers
  any recovered draft on return; `beforeunload` still warns.
- **Editable tables:** a contextual control row (add/remove column, add/remove row, delete table)
  appears when the cursor is inside a table; the header row + left column are shaded with the table's
  own `--c-rule` colour as a visual spine (left-column shade is CSS-only, never changes the Markdown).
- **Live toolbar + floating selection menu:** the editor sets `shouldRerenderOnTransaction` so the
  toolbar reacts to the cursor (active highlights, the table row); selecting text — or putting the
  cursor in a link — pops a compact bubble (bold / italic / underline / strike / code + link
  edit/remove) that follows light/dark mode. Menu UI lives in `EditorMenus.tsx`.
- Drag-dropped images insert at the drop point; existing links are editable (prefilled href,
  clear-to-remove); clearer toolbar labels (text for Table / list / quote / code / divider); the
  Markdown/Review toggle trails the buttons inline.
- **fix(toc):** a heading that slugifies to nothing (e.g. `## !!!`) no longer emits an invalid `id=""`.

## v1.1.9 — 2026-06-24 (Docker self-host: fix fresh-install file permissions)
- **fix(docker): media uploads + ISR cache now work on a fresh self-host install.** The image runs
  as the unprivileged `node` user (uid 1000), but two paths were root-owned and unwritable, so a
  clean `docker compose up` failed at runtime:
  - **ISR/prerender cache** — Next 16 writes its segment cache under `.next/server/app/*` (not just
    `.next/cache`); the Dockerfile only chowned `.next/cache`, so revalidation failed with `EACCES`.
    Now `chown`s the whole `/app/.next` tree.
  - **Uploaded binaries** — Docker creates the `./data/uploads` bind mount as root, shadowing the
    image's chown, so posting an image/file failed with `EACCES`. Added a one-shot `init-uploads`
    service that fixes ownership (uid 1000) before the app starts.
- **chore: keep the bundled Docker stack's `./data/` out of git and lint.** Added `/data/` to
  `.gitignore` and `data/**` to the ESLint ignores so a `docker compose up` (which writes
  root-owned Postgres data there) no longer dirties the tree or breaks `npm run lint`.
- **Admin dotted-grid starts cleanly from the top-left edge** — one full gap of clear space before the
  first dot (`background-position` `-1px -1px` → `7.5px 7.5px`), no more dot crammed into the corner.

## v1.1.7 — 2026-06-23
- **Admin dotted-grid background tuned.** ~30% denser dots (tile `22px` → `15px`); light dots a touch
  dimmer (`0.13` → `0.11`), dark dots a touch clearer (`0.11` → `0.12`).

## v1.1.6 — 2026-06-23
- **In-page ToC meta drops the comment count.** The label is just `Comments` (`Tags / Categories /
  Comments`), no number — the count lived on the ISR-cached page so it was always stale; the
  authoritative count is in `/admin/comments`.

## v1.1.5 — 2026-06-23
- **Admin Comments table reworked.** The content cell now clamps to two lines and click-toggles to
  the full comment (click again to collapse) — per row, so replies (flat rows) expand independently.
  The post-title cell wraps instead of truncating, so long rows are no longer cut off. The **From**
  (provider) column is replaced by an **IP** column showing the commenter IP with the ISO country
  code in parens (`1.2.3.4 (VN)`); pre-feature rows show `—`.
- **Comments now persist the commenter IP + country** (`author_ip` / `author_country`, new nullable
  columns) — captured at submit (country is best-effort from the Vercel edge, blank off-platform).
  Admin-only: NEVER included in the public comment tree.
- **fix: in-page ToC meta shows the comment count as `Comments (N)`** (was `N Comments`); still hidden
  entirely at 0 (`Tags / Categories / Comments`). The count is part of the ISR-cached post page, so it
  refreshes on the next revalidation (≤1h) or when the post is next edited — not instantly on a new comment.

## v1.1.4 — 2026-06-23
- **fix: the no-cloud Docker stack, hardened by a real end-to-end boot test.** Brought the full
  `docker compose` stack up and fixed three issues a build-only check missed:
  - **No more `--env-file` footgun.** The compose file no longer uses `${...}` interpolation, so a
    plain `docker compose up -d` (or any compose command) reads every value straight from
    `.env.docker` — previously, forgetting `--env-file` silently recreated PostgREST with a blank
    JWT secret and broke auth. `gen-keys.mjs` now emits `PGPASSWORD` + `PGRST_JWT_SECRET` (the names
    PostgREST/libpq read directly); the DB URI carries no password.
  - **ISR cache is writable.** The runner now `mkdir`s + `chown`s `/app/.next/cache` for the `node`
    user — the standalone image ships `.next/static` as root but never `.next/cache`, so the first
    request hit `EACCES` trying to write the incremental cache.
  - **No duplicate env keys.** `.env.docker.example` dropped its empty `POSTGRES_PASSWORD=` /
    secret placeholders, so `gen-keys.mjs >> .env.docker` appends exactly one of each.
  Verified live: `service_role` SELECT → 200 and INSERT → 201, `anon` write → 401, the app homepage
  renders through supabase-js → bundled PostgREST, and `docker compose` runs warning-free.

## v1.1.3 — 2026-06-23
- **feat: Docker self-host needs NO cloud — bundled Postgres + PostgREST.** The compose stack now
  ships its own database, so a self-hoster never signs up for Supabase. Because the app only ever
  uses Supabase's REST layer (no Supabase Auth/Realtime/Storage), the stack is just **Postgres +
  PostgREST** (2 light containers): supabase-js points at the local PostgREST and the **entire data
  layer stays byte-for-byte unchanged**. The only code change is 3 env-gated lines in `db.ts` —
  when `POSTGREST_DIRECT=1` it strips the `/rest/v1` path prefix so supabase-js reaches bare
  PostgREST (no proxy container). Postgres applies `scripts/schema.sql` + a role/grant bootstrap
  (`docker/initdb/`) on first boot; `scripts/docker/gen-keys.mjs` mints the DB password + JWT secret
  + `service_role` key. Text now lives in `./data/postgres`, binaries in `./data/uploads` — back up
  those two folders. Managed-DB users can still point `SUPABASE_URL` at a real Supabase and drop the
  `db`/`rest` services. **Vercel is unchanged** (no `POSTGREST_DIRECT` → hits Supabase as before).

## v1.1.2 — 2026-06-23
- **feat: Docker self-host, from the same codebase.** `src/lib/blob.ts` is now a storage facade
  with two drivers picked by `STORAGE_DRIVER`: `vercel-blob` (unchanged default) and `local`
  (filesystem). The local driver (`blob-local.ts`) writes binaries to a mounted volume and serves
  them at `/uploads` (`app/uploads/[...path]`). The browser upload path mirrors this via
  `NEXT_PUBLIC_STORAGE_DRIVER`: off Vercel the bytes are POSTed to a server route
  (`/api/media/upload`, `/api/files/attach`) instead of client-direct-to-store — a Node host has
  no 4.5 MB body cap. Ships `Dockerfile` + `docker-compose.yml` (app + an hourly cron sidecar that
  pings `/api/cron`) + `.env.docker.example`; `next.config` gains `output: 'standalone'`. The image
  builds with **no backend env** (the data layer already degrades to empty), so it stays portable.
  **The Vercel deploy is byte-for-byte unchanged** — it ignores the Dockerfile and keeps Vercel Blob.
- **feat: backup is storage-driver aware.** `backup.ts` reads each blob through the driver
  (`readBlob`) instead of self-fetching the public URL, so a snapshot works under the local driver
  too. Google Drive stays the only backup target.
- **chore: `check:no-direct-blob`** added to `check:all` — `@vercel/blob` may be imported only by
  `blob.ts` (and `@vercel/blob/client` only by the client-upload files), so a self-host build can't
  silently depend on the Vercel SDK.

## v1.1.1 — 2026-06-23 (stable)
- **First STABLE release since `v1.0.15`** (`v1.1.0-beta` was a prerelease, not a stable cut). Rolls
  up everything since v1.0.15:
  - **Reader comments** — manual/instant (no cache), optional Cloudflare Turnstile, Google/Facebook
    commenter login, admin-managed keys, and **optimistic posting** + a route loading skeleton.
  - **Admin overhaul** — shared UI kit, dotted canvas, 5-tab settings; the **activity log** now also
    records server errors.
  - **Reworked post ToC** — "Tiêu đề" header, in-page jumps, collapsible on every viewport.
  - **Editable footer** with a tiny bold/italic/underline/link markdown editor.
  - **Reading-optimized typography defaults** + read time now on every list post (backfill).
  - **Site-wide motion engine** — subtle, token-gated, one admin switch; respects reduced-motion.
  - **Palette refresh** — true-neutral Mono, **Sci-Fi** replaces Rosé; per-palette visibility.
  - **Hardening** — one-command `check:all` + seam tests, single-source `liveOnly` soft-delete,
    force-no-store admin reads, iOS notch progress-bar fix.
  - Detail in the dated entries below.
- **fix(type): removed `text-wrap: balance`/`pretty`.** Both re-broke whole lines and left too much
  empty space on the right (titles wrapped early; body looked under-set). Text now wraps normally,
  filling each line to the measure. Don't reintroduce them.

## 2026-06-23 (v1.1.0-beta — activity log: errors now recorded + flagged)
- **feat: the activity log now captures server errors.** `logError` (the central route catch
  handler) schedules `after(() => logActivityError("METHOD /path", message))`, writing an
  `error`-action entry (same `activity_log` table, gated by the same `features.activityLog` toggle,
  never throws). Unexpected failures are now visible in **Admin → Log**, rendered with a red badge.
  Only genuine errors land here — validation 400s use `fail()`, not `logError`. `v1.1.0-beta`.
- **fix: many list posts showed no read time.** List views use the stored `posts.reading_minutes`
  column (the body isn't fetched for lists), and imported posts had it `null`. Added
  `scripts/backfill-reading-time.mjs` (mirrors `lib/utils.ts` `readingMinutes`; `--dry`/`--all`,
  idempotent) and ran it — 44 posts backfilled, 0 remain null. App saves already set the column, so
  this is a one-off repair. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — palettes: true-neutral Mono, drop Rosé, add Sci-Fi)
- **fix(palette): Mono is now truly hueless.** The old values had a faint warm/blue cast (cream
  `bg`/`rule`, slightly blue `text`/`meta`), so the menu hover looked tinted. All pure gray now, and
  `rule` is a touch lighter so the hover reads as a soft, colourless gray.
- **change(palette): removed Rosé, added Sci-Fi** — a cool graphite surface with an electric-cyan
  accent (the deep blue-black + bright cyan dark mode is where it shines). Saved settings migrate
  cleanly: `sanitizeThemes`/`sanitizeEnabledPalettes` keep only known preset ids, so a stored `rose`
  is dropped and `scifi` seeded on next save. Names localized in all 6 languages. Still 6 palettes.

## 2026-06-23 (v1.1.0-beta — UI fixes: logo cursor, title wrapping, admin dots)
- **fix: the header logo/wordmark now shows the pointer (hand) cursor**, not the text caret
  (`cursor-pointer` on the brand link).
- **fix: titles no longer wrap too early.** Dropped `text-wrap: balance` on headings — it shortened
  lines and left a premature right rag on list-card titles. Body keeps `text-wrap: pretty`.
- **change: the admin dotted canvas is more visible** in both light and dark (dot opacity + size up).
- **feat(comments): a posted comment now appears instantly (optimistic).** It's rendered with the
  SAME `renderCommentMarkdown` the server uses — so there's no content drift — overlaid on the tree
  via the new, tested `lib/comment-tree.ts` `mergeOptimisticComments`, then the authoritative refetch
  replaces it and clears the overlay. A failed POST removes the optimistic comment and shows the
  error. (Supersedes the old "refetch only" note; the refetch is still the source of truth.) The
  composer + sign-in buttons moved to `CommentForm.tsx` to keep files focused.
- **feat: a themed loading skeleton for blog routes** (`(blog)/loading.tsx` + `.skeleton`) for
  instant feedback on navigation. The subtle pulse follows the motion engine (gated by `data-motion`
  + `prefers-reduced-motion`), so it degrades to a calm static placeholder; sized to roughly match a
  post so the swap to real content barely shifts. `v1.1.0-beta`.
- **feat: a site-wide motion engine for a calmer, more "app-like" feel.** ONE set of tokens
  (`--dur-fast/base/slow` + `--ease`) drives every transition/animation across the public site AND
  admin. A single switch gates all of it: `<html data-motion>` is server-rendered from a new
  `settings.motion.enabled` (default on; no flash, no client JS), and BOTH `data-motion="off"` and
  `prefers-reduced-motion` collapse every duration to `0s` — instant, no per-component branching.
  Toggle in **Admin → Appearance → Rendering**.
- **What moves (kept subtle):** eased hover/focus/colour changes + a tiny press-squash on buttons;
  cross-fade page navigations via Next `experimental.viewTransition` + `::view-transition-*(root)`
  CSS; a gentle scroll-reveal on list cards (`.reveal`). All use cheap `opacity`/`transform` only —
  **no CLS, no render-blocking, no added client bundle** — and degrade to instant/visible where
  unsupported (the reveal is guarded behind `@supports (animation-timeline)` + `data-motion='on'`).
- **chore:** the file-size guard now also exempts the `src/locales/` i18n dictionaries (cohesive
  DATA manifests, like the already-exempt `types.ts`) — adding UI strings no longer trips the cap.
  `v1.1.0-beta`.
- **feat: the site footer is now owner-editable.** New `settings.footer` holds limited inline
  markdown — **bold / italic / underline / link** only — rendered by `lib/inline-md.ts`
  (escape-first like `comment-md`: the whole string is escaped, so only the `<strong>/<em>/<u>/<a>`
  we inject can appear; link hrefs are protocol-checked, `javascript:`/`data:` fall back to plain
  text). `{year}` and `{title}` tokens expand at render. Authored in **Admin → Settings → Site**
  via `FooterField` (textarea + a B/I/U/Link toolbar that wraps the selection + a live preview).
  The public layout renders it in `<footer class="site-footer">`; default = the old "© {year}
  {title} · powered by Quire Blog" line. Pinned by `inline-md.test.ts` (render + link-safety + escape
  + length). i18n in all 6 admin locales. `v1.1.0-beta`.
- **change(typography): retuned the default type scale for long-form reading** (the Reset target).
  Restrained, monotonic heading scale (h1 2.0 → h5 1.0; h5 was 0.9, *below* body — fixed), body
  leading eased 1.75 → 1.7 for an even grey column, code 1.65 → 1.6, h2 1.4 → 1.5 for clearer
  hierarchy. ~66-char measure (`contentWidth` 672) kept — already in the 60–75 cpl comfort zone.
  Updated in BOTH `globals.css :root` and `DEFAULT_TYPOGRAPHY`; readers who customized keep theirs.
- **feat(typography): `text-wrap` polish.** Headings get `text-wrap: balance` (no lone short last
  line), `.prose p` gets `text-wrap: pretty` (better rag) — both progressive, ignored where unsupported.
- **refactor: removed the last hardcoded public text sizes.** Brand wordmark `text-lg` → `.fs-h4`;
  Theme/Palette toggle menu items `text-sm` → `.t-small`; `PostCard` excerpt `leading-relaxed` +
  inline `font-size` → new `.t-body` utility (body role outside `.prose`). Public size grep is now clean.

## 2026-06-23 (v1.1.0-beta — admin overhaul: dotted canvas, shared UI kit, 5-tab settings)
- **feat(admin): a shared UI kit ends the per-page drift.** New `components/admin/kit.tsx` is the
  ONE source for admin chrome — `Card` (canonical surface), `PageHeader` (the title block every
  screen reuses, replacing a copy-pasted `<h1>` on each page), `Tabs` (one component for the
  `underline` + `segment` styles), `StatCard`, `EmptyState`, and table tokens (`TableFrame`/`THEAD`/
  `TROW`). Cards were `rounded-2xl p-5` in Settings but `rounded-xl p-4` elsewhere; now uniform.
  Migrated Overview, Content dashboard, Comments, Trash, Analytics, Activity log + the Media page.
- **feat(admin): a dotted-grid canvas.** `<main>` carries `.admin-canvas` (globals.css) — a CSS
  radial-gradient dot grid, fixed faint neutral per light/dark mode; sidebar + cards float above it.
- **feat(admin): the Overview shows more.** Stat row adds **Comments** (next to Posts/Pages) and
  every tile links to its section; plus a **Quick actions** row and a **Recent activity** card
  (latest 6, gated by `features.activityLog`). The System panel moves to the bottom.
- **feat(admin): Settings regrouped into 5 task-based tabs** — **Site / Content / Appearance / SEO /
  Integrations** (was General / Appearance / Advanced) — so each tab holds 1–2 cards instead of
  cramming five. Still ONE form + ONE save. The Drive-connect redirect now lands on `integrations`.
- **change(admin): the collapse control moved to the top** next to the wordmark (a compact chrome
  button, not a nav row) so it's no longer mistaken for Sign out, which now sits alone under a divider.
- **change(admin): palette selection is frontend-only.** The admin chrome dropped its `PaletteToggle`
  (only light/dark remains); the Appearance tab still sets the site default + reader-switchable
  palettes, with an in-place note. i18n synced across all 6 admin locales. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — ToC panel: "Tiêu đề", combined jump, collapsible everywhere)
- **feat(blog): the post ToC is reworked.** Its title is now **"Tiêu đề"** (Headings) instead of
  "Mục lục"/"Contents" in all 6 locales, and **clicking the title scrolls back to the top**. Under
  the headings, **one line** joins the present **tags / categories / comments** labels and jumps to
  the first existing section (scroll-only, via a shared `TOC_ANCHORS` map + `scroll-mt-24` targets).
  The panel is now **collapsible on every viewport** from a **text-free left-edge handle** (the tab
  shape speaks for itself): default **open + pinned on desktop**, default **closed on mobile**
  (outside-tap / Escape dismiss). When a post has **no headings** the header is a plain,
  non-clickable **"Mục lục"** (`tocIndex`) and only the jump line shows; the panel disappears only
  when there is nothing at all to show. The **comments** label carries its **count in front**
  (e.g. "12 Bình luận", server-rendered). Solid `bg-bg` background so it never shows content
  through; clickable items now get a pointer cursor; phones gain wider side gutters
  (`px-8 sm:px-5`) so the handle clears the text. `v1.1.0-beta`.
- **fix(blog): the jump link pointed at `#undefined`.** `TOC_ANCHORS` was exported from the
  `'use client'` `Toc` module and imported into the Server Component post page; a Server Component
  importing a plain const from a client module gets a client-reference proxy, so `TOC_ANCHORS.tags`
  read as `undefined` on the server — rendering `href="#undefined"` and matching `id="undefined"`
  anchor targets (no build error, since the proxy doesn't throw). Moved `TOC_ANCHORS` to a plain
  `lib/toc.ts` that both sides import. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comment integrations: setup help + links in the admin)
- **feat(admin): each comment integration now shows a one-line setup guide + a link.** Turnstile →
  Cloudflare dashboard; Facebook → Meta for Developers (create app, add Facebook Login, redirect
  `/api/auth/callback/facebook`); Google → a note that it reuses your sign-in and that **letting
  OUTSIDE readers in requires publishing the OAuth consent screen to "Production"** (in "Testing"
  only the owner can sign in), with a link to the Google Cloud consent screen. i18n in all 6 admin
  locales. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comments: a too-deep reply is a clean 400, not a 500)
- **fix(comments): replying past the 3-tier limit (or to a missing parent) now returns 400, not
  500.** Found in a live end-to-end pass on manhhung.me — the depth guard worked but `addComment`
  threw a generic `Error` that fell through to the 500 handler. It now throws a typed
  `CommentInputError` the route maps to 400 with a clear message. Pinned by `comments.test.ts`
  (depth-limit / missing-parent / empty-body guards). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comment integration keys move into the admin)
- **feat: Turnstile + Facebook keys are entered in Admin → Settings, not env.** The optional comment
  integrations no longer need a Vercel redeploy to configure. Keys are SECRETS, kept in a new
  server-only `integration_keys` table (single row) — like `backup_state`, **never in
  `settings.data`** — set via an owner-gated `POST /api/comments/keys` (`CommentKeys.tsx`). Env vars
  of the same name still work as a fallback. **Google stays env-only** (it's the owner's admin
  sign-in — moving it to the admin would deadlock the owner's own login); its toggle just shows the
  "Sign in with Google" button, now clearly described as *letting outside readers sign in*.
- **refactor(auth): NextAuth config is a function so Facebook reads its keys from the DB at runtime;
  the edge middleware now reads the JWT via `getToken`** (new `lib/auth-shared.ts` holds the pure
  `isAuthorized`), so the Supabase client never enters the edge bundle. `getCommentEnv()` is now
  async (reads the key store). Behaviour-preserving for existing env-based setups. `schema.sql`
  updated; `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase C: Google/Facebook login)
- **feat(comments): readers can comment with a Google or Facebook account.** Toggles in
  Admin → Settings (each effective only when its env keys exist — "needs env key" badge). A
  signed-in commenter sees "Commenting as <name>" + a plain comment box: **no name/email fields and
  no Turnstile** — the server **trusts the session** (`getCommenter()`) for identity + provider.
  Logged-out readers still get the manual form **plus** sign-in buttons. Facebook is a new
  commenter-only NextAuth provider (`AUTH_FACEBOOK_ID/SECRET`); Google doubles as the owner's admin
  sign-in. The session now carries `name` + `provider` (`next-auth.d.ts` augmentation); the viewer is
  resolved client-side via `/api/auth/session` since the post page is static. **Signing in to comment
  does NOT grant admin** — `/admin` stays gated to `AUTHORIZED_EMAIL`. i18n: all 6 public + admin
  locales. This completes the 3-phase comment system. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase B: Cloudflare Turnstile)
- **feat(comments): optional Cloudflare Turnstile anti-spam for manual comments.** Toggle in
  Admin → Settings (under Comments). The manual form gates the comment box **behind a Turnstile
  pass** — the widget appears once name/email are filled, and only then does the message box show.
  The POST **verifies the token server-side** (siteverify, fail closed). Enforced **only when the
  toggle is on AND `TURNSTILE_SECRET_KEY` is set**, so turning it on without keys never locks out
  commenting — the admin row shows a "needs env key" badge (`getCommentEnv()` reports which
  integrations are wired; the public SITE key is passed to the widget, no secret leaves the server).
  New `lib/turnstile.ts` + `lib/comment-env.ts` + `components/blog/Turnstile.tsx`; env
  `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (`.env.example` + README). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase A: manual identity, instant, no cache)
- **feat: a text-only reader comment system, off by default (`settings.comments.enabled`).** Phase A
  of three (B = Cloudflare Turnstile, C = Google/Facebook login). What ships now:
  - **Public:** a comment block under each post — name + email + optional website, **limited markdown
    (bold/italic only)**, replies up to **3 tiers**, 1000-char cap. It's a CLIENT island that fetches
    `/api/comments` with `no-store`; the post page stays ISR, a new comment **shows instantly with no
    cache in the way and NO `revalidatePath`** (commenting never touches the ISR path).
  - **Admin → Comments:** every comment (content/post/time/name/from/delete); delete = soft delete →
    **Trash** (restore/purge in a new Comments tab). Settings → General has an **Enable comments**
    toggle. The posts table shows a **comment-count column** when enabled.
  - **Safety:** markdown is escape-first so no link/image/script/raw-HTML survives (Invariant 5);
    email is stored but NEVER sent to the public client; depth enforced server-side; published-post
    check + per-IP rate limit; `/api/comments` is the only public-exempt path, `[id]` DELETE stays
    owner-gated. New table `comments` (+ `schema.sql`). Tests: `comment-md`, `buildCommentTree`,
    `sanitizeComments`. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — per-palette visibility; switcher hides when one is left)
- **feat(appearance): the owner can turn each color palette on/off for visitors.** New
  `settings.enabledPalettes` (allow-list of preset ids). Admin → Appearance shows a "Shown to
  visitors" checkbox per palette; the default palette is locked on so the set is never empty.
  The public + admin palette switcher lists only enabled palettes (`enabledPaletteOptions`), and
  **`PaletteToggle` renders nothing when ≤1 palette is enabled** — so a one-palette site has no
  theme-switch icon at all. The no-FOUC script ignores a stored palette that is no longer enabled
  (falls back to the default, no flash). Disabled palettes remain fully editable. Migration-safe:
  legacy settings with no `enabledPalettes` read as "all on" (`sanitizeEnabledPalettes`, pinned by
  `settings-sanitize.test.ts`). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — soft-delete filter is enforced in one place)
- **refactor: `liveOnly()` (in `lib/db.ts`) is the single home of the soft-delete predicate.**
  Every live read of a soft-deletable table (posts/pages/media/files) now wraps its query in
  `liveOnly(...)` instead of hand-writing `.is('deleted_at', null)` at each of the 9 call sites —
  so the column + null check are defined ONCE and can't drift. Trash views still read the complement
  (`.not('deleted_at','is',null)`) directly. Behaviour-preserving; the `soft-delete.test.ts` suite
  (listing/public/search/single) guards it. First tagged **beta** of the 1.1 line. `v1.1.0-beta`.

## 2026-06-23 (v1.0.18 — verification is one command now, not a reading session)
- **build: `npm run check:all` is the Definition of Done** — typecheck + lint + four static
  invariant checks (`check:routes`, `check:filesize`, `check:no-any`, `check:token-bust`) + the
  vitest suite, all offline/no-creds. Codifies the manual greps that lived in `CHECKLIST.md` /
  `audit/README.md`. A separate `check:consistency:live` cross-checks the `media`/`files` rows
  against the real Blob store (skips cleanly without `.env.local`).
- **test: a minimal vitest seam suite (62 tests, <0.5s)** pinning the load-bearing invariants —
  blob collapse/expand round-trip, shared slug namespace, revalidate SUPERSET, markdown raw-HTML
  escaping + ToC anchor sync, and soft-delete (trashed content never leaks to a live read). Not
  broad coverage by design.
- **refactor: split two oversized modules under the 400-line cap (behaviour-preserving)** —
  `lib/media.ts` → `lib/image.ts` (pure sharp encoding) and `lib/settings.ts` →
  `lib/settings-sanitize.ts` (pure validation/migration); both one-way imports, all re-exports kept.
- **docs: CLAUDE.md restructured for debugging (504 → 199 lines)** — a per-area DEBUG ROUTER + a
  numbered Invariants list (each with its enforcing test/guard) up front; topic detail moved to
  `docs/{conventions,features,seo-pwa,mcp,backups}.md`, loaded on demand. No runtime change. `v1.0.18`.

## 2026-06-23 (v1.0.17 — admin live reads were silently served from the 1h Data Cache)
- **fix(admin): the MCP token list (and every admin live read) could show STALE data —
  most visibly "list token không hiện" after connecting a connector from Claude.** Root cause:
  `dynamic = 'force-dynamic'` does NOT de-cache our `db()` GET reads, because they opt into the
  Data Cache with an explicit `next: { revalidate, tags:['db'] }` — Next only auto-de-caches
  force-dynamic fetches that set NO revalidate (`noFetchConfigAndForceDynamic` in `patch-fetch`).
  So a tagged read stayed in the 1h Data Cache, and an OAuth token minted out-of-band (which
  intentionally does not purge tag `db`) never appeared. Added `export const fetchCache =
  'force-no-store'` — the lever that forces every fetch in a segment to `no-store` regardless of
  its options — to the `/admin` layout (cascades to all admin pages) and the owner-only live API
  routes (`api/mcp/tokens`, `api/files`, `api/media`, `api/media/unused`,
  `api/posts/[slug]/revisions`, `api/backup`). Public pages keep their cached/ISR reads (they set
  neither config). Same class of bug as the 1.0.11–1.0.13 "Backups stuck on Connect". `v1.0.17`.

## 2026-06-23 (v1.0.16 — reading progress bar reaches the top edge on notch/Dynamic Island)
- **fix(ios): the reading progress bar sat below the Dynamic Island / notch instead of at the
  true top edge.** Without `viewport-fit=cover`, iOS Safari lays the page out inside the safe area,
  so the bar's `top: 0` landed at the top of the *content* area (under the island), looking like it
  floated mid-screen. Set `viewportFit: 'cover'` in `generateViewport` so the page fills under the
  island and the fixed bar reaches the real top edge, and added `env(safe-area-inset-*)` padding on
  `body` so the header/content re-clear the island (env() is 0 on devices without insets, so no
  effect elsewhere). `v1.0.16`.
- **docs(readme): rewrote "What it is"** to lead with the actual pitch — open-source (MIT),
  built for people who just want to **write**, **fast load on mobile + desktop**, **readable
  typography**, and **easy to tweak from the admin with no hardcoded values**. Gave the feature
  table a real header row (`Area | What you get`) instead of the blank `&nbsp;` cells.
- **docs(readme): both "Get your own" paths now open by default** (the AI-agent path was
  collapsed and easy to miss). **The agent path now has the agent walk the owner through creating
  the Google OAuth "Web" client** (Cloud Console clicks, consent screen, redirect URI) and collect
  the client ID/secret back, instead of telling the owner to pre-create it alone. `v1.0.15`.

## 2026-06-22 (v1.0.14 — fix Backups card stuck on "Connect" after connecting)
- **fix(backup): the Backups card kept showing "Connect Google Drive" after a successful
  connect** (and "Back up now" stayed disabled). Root cause: the `backup_state` read is Data-Cache-
  eligible (tag `db`, 1h), and the connect write (`setDriveAuth`) didn't `revalidateTag('db')`, so
  `GET /api/backup` served the stale pre-connect "not connected" state until the cache expired.
  `setDriveAuth` / `clearDriveAuth` / `setFolderId` / `recordRun` now bust the `db` tag, so the
  admin reflects connect / disconnect / run / last-status immediately (confirmed via Supabase API
  logs: no `backup_state` re-read occurred after the connect writes). Also added a focus/visibility
  refetch to `BackupFields` so it re-syncs after the OAuth round-trip. `v1.0.14`.

## 2026-06-22 (v1.0.13 — fix Drive connect redirect + tidy Backups layout)
- **fix(backup): `redirect_uri_mismatch` connecting Google Drive.** The consent + token-exchange
  redirect URI was built from `req.nextUrl.origin`, which is a `*.vercel.app` host when the admin
  is reached there (sign-in still works because NextAuth uses `AUTH_URL`) — so it didn't match the
  one URI registered on the OAuth client. New `backupRedirectUri(settings)` derives it from the
  canonical `resolveSiteUrl(settings)` (e.g. `https://manhhung.me/api/backup/callback`), used by
  both `/api/backup/connect` and `/api/backup/callback`. Register that exact URI on the client.
- **ui(backup): the Backups card no longer spans full width.** It now sits in the same two-column
  Advanced grid as MCP + custom CSS, so the section reads evenly. `v1.0.13`.

## 2026-06-22 (v1.0.12 — slugified taxonomy URLs + clearer Overview)
- **fix(seo): category/tag URLs now use the slugified term**, e.g. `/category/suy-nghi` instead of
  `/category/Suy%20ngh%C4%A9`. New `lib/taxonomy.ts` (`termSlug`/`resolveTerm`); post-footer links +
  sitemap emit `termSlug(term)`; the four `category|tag/[slug]` routes resolve the slug back to the
  term (by `slugify` match) and `notFound()` on no match. **Old `%`-encoded URLs still resolve**
  (back-compat raw-term match) so nothing 404s. OG/metadata show the real term name.
- **feat(admin): Overview is clearer.** The media stat card now reads **Images** = original count,
  with a sub-line `N variants · M files` (variants = derived `-thumb`/`-1024`/`-1600` AVIF/WebP;
  files = `files/` blobs) instead of one opaque "Attachments" total. Category/Tag cards show their
  **total count** in the title. The System panel adds **MCP server** (on/off) and **Backups**
  (on when enabled + Drive connected) rows. New `stat*`/`sys*` locale keys in all 6 languages. `v1.0.12`.

## 2026-06-22 (v1.0.11 — full-site backups to Google Drive)
- **feat: full-site backup to the owner's Google Drive** (Admin → Settings → Advanced). One
  snapshot = a single self-contained `.tar.gz` — `db.json` (every text table) + `blob/<pathname>`
  (every binary) + `manifest.json`. Automatic on a schedule (cron, every `intervalDays`, default
  4) with retention (keep the newest `keep`, default 4), plus **Back up now / Restore / Delete**
  in the admin. New `lib/backup.ts` + `lib/gdrive.ts` + `lib/backup-state.ts`; routes
  `/api/backup` (status/run/delete), `/api/backup/restore`, `/api/backup/{connect,callback,disconnect}`.
  Cron (`/api/cron`) calls `maybeRunBackup()`.
- **Drive auth is separate from sign-in.** A dedicated `drive.file` OAuth consent (reuses the
  Google client; login scope untouched) stores a refresh token in the new **`backup_state`** table
  (single row). The token is a SECRET and is kept OUT of `settings.data` (which is sent to the
  client) — only non-secret config (`enabled`/`intervalDays`/`keep`) rides in `settings.backups`;
  status + the snapshot list come from owner-only `/api/backup` (never the token).
- **Restore** replaces every text table (settings upserted; others delete-all + insert with
  `id`/generated `search` stripped) and re-uploads every blob; a pre-restore snapshot is taken
  first. New `backups` activity actions; new `backup*` admin locale keys in all 6 languages; new
  `tar` dependency. Owner one-time setup: enable the Google Drive API + add the callback redirect
  URI to the OAuth client, then **Connect Google Drive**. `v1.0.11`.

## 2026-06-22 (v1.0.10 — hardening: edge guard, Google-only, MCP token expiry)
- **feat(security): `src/middleware.ts` edge owner-guard (defense-in-depth).** Reads the NextAuth
  JWT and blocks `/admin/:path*` (→ sign-in) and owner-only `/api/:path*` (→ 401) BEFORE the route
  runs — so a new admin page or API route is protected even if it forgets `requireOwner()`. Self-
  authed/public paths are allow-listed (`/api/auth`, `/api/cron`, `/api/track`, `/api/search`,
  `/api/mcp` except `/api/mcp/tokens`); add new public/bearer routes to `isPublicApi()`.
- **change(auth): Google is now the ONLY sign-in provider.** Dropped the GitHub OAuth provider
  (`auth.ts`, `.env.example`, README). `AUTH_GITHUB_ID/SECRET` are no longer read.
- **feat(security): MCP tokens now expire 180 days after creation.** New `mcp_tokens.expires_at`
  column (migration `mcp_tokens_add_expires_at`; default in `schema.sql`); `createToken` /
  `mintOAuthToken` set it on insert; `verifyTokenHash` rejects an expired bearer. The admin token
  table shows an **Expires** column (red "Expired" when past). Connectors silently re-authorize
  across the boundary; a manual token must be recreated. New locale keys `mcpColExpires` / `mcpExpired`
  in all 6 languages. The admin remains the sole authority over deletion. `v1.0.10`.

## 2026-06-22 (v1.0.9 — every error page shares one look)
- **refactor: all error/edge screens now route through ONE `ErrorScreen` component** so they can't
  drift. The public 404, the 5xx boundaries (`ErrorView`), and a new **admin 404**
  (`app/admin/not-found.tsx`, for unmatched admin URLs) all render the identical layout (number +
  title + text + actions on theme tokens) — fully consistent per request. Shared `ERROR_LINK` class.
- The public 404 keeps the blog header/footer; the admin 404 renders in the admin shell. (Other 4xx
  like 401/403 stay auth redirects/JSON by design, not pages.) `v1.0.9`.

## 2026-06-22 (v1.0.8 — fix stale admin lists + 5xx/error pages)
- **fix(admin): admin list endpoints showed STALE data (the real "can't delete a token" bug).**
  `db()` GET reads are Data-Cache-eligible (tag `db`, 1h). The admin client-fetched list routes
  weren't `force-dynamic`, so after a delete/upload the cached list still showed the old rows — the
  MCP token list kept showing a just-deleted token, so re-clicking Delete was a no-op on a dead id
  (only toggling MCP off, which calls `revalidateTag('db')`, refreshed it). Marked **`force-dynamic`**
  on every owner-only list route so they always read live: `mcp/tokens`, `files`, `media`,
  `media/unused`, `posts/[slug]/revisions`. Deleting a connection from the admin now takes effect
  immediately, as intended.
- **fix(admin): corrected `api/media` GET header comment** (said "public read" — it is owner-only).
- **feat: 5xx / error pages now match the 404.** Added `error.tsx` (per-segment) + `(blog)/error.tsx`
  (keeps the public shell) + `global-error.tsx` (root-layout failures), all rendering a shared
  `ErrorView` styled identically to the 404 (number + title + text + Try again / Back home, on theme
  tokens). New locale keys `errorTitle`/`errorText`/`tryAgain` in all 6 languages. `v1.0.8`.

## 2026-06-22 (v1.0.7 — MCP: admin is the sole authority over a connection)
- **change(mcp): OAuth tokens are NEVER auto-deleted.** Removed the rolling-window prune
  (`MAX_OAUTH_TOKENS`) — the system no longer removes connections behind the owner's back.
  Lifecycle rule now matches intent: a connection **persists forever** (eternal token, no expiry,
  no prune) until the **owner deletes it in the admin**; an admin delete is final unless the owner
  re-authorizes. Deleting the connector in Claude alone just lets it re-authorize (a new token row;
  the old one persists until the owner removes it). `v1.0.7`.

## 2026-06-22 (v1.0.6 — MCP token list always reflects reality)
- **fix(admin): the MCP token list no longer shows a stale snapshot.** It loaded only on mount, so
  connecting/disconnecting in Claude (out-of-band) left the admin list wrong — "can't delete the old
  one", "don't see the new one". It now **refetches on tab focus / visibility change** and has a
  manual **Refresh** button, so the owner always sees and can revoke every live token/connection.
- **fix(mcp): prune the OAuth rolling window by `id` (monotonic PK), not `created_at`** — removes a
  tie risk where a freshly minted token could be pruned. `v1.0.6`.
- Note: deleting a connector's token revokes that session; the connector can only re-appear if the
  owner re-approves OAuth (authorize is gated by the owner's login). To fully stop access, also
  disconnect in Claude or turn the MCP toggle off.

## 2026-06-22 (v1.0.5 — MCP: authorize once, connect forever)
- **fix(mcp): connecting an OAuth connector once now works indefinitely.** The `/token` exchange
  used to delete the previous "OAuth connector" token on every connect (single slot), so any
  reconnect or second client stranded an earlier session on a dead token → "connected but zero
  tools". Now `mintOAuthToken` **never pre-deletes** (the in-use token survives a re-auth) and keeps
  a small rolling window (`MAX_OAUTH_TOKENS`), so reconnects can't strand a client. Tokens stay
  eternal (no expiry), so claude.ai authorizes once and never has to re-auth.
- **fix(mcp): OAuth tokens are exempt from the manual 5-token cap.** Authorizing can no longer fail
  with "limit reached"; the admin create-token cap counts manual tokens only (`McpTokenInfo.oauth`).
- **docs:** corrected the stale `api/mcp/route.ts` header (it still described a single `MCP_TOKEN`
  bearer) and the CLAUDE.md MCP section. `v1.0.5`.

## 2026-06-22 (v1.0.4 — full-width admin + non-wrapping table headers)
- **feat(admin): admin pages now fill the browser width.** Dropped the `max-w-6xl` lock on the
  admin content column (no longer needed with the column/sidebar layout) — content is full width
  with ~100px gutters on desktop (`lg:px-[100px]`), tighter padding on mobile (`px-4`, `sm:px-6`).
  The fixed save bars (post/page editor, settings) align to the same gutters.
- **fix(admin): table column headers no longer wrap.** Added `whitespace-nowrap` to every admin
  table header row (posts, pages, trash, activity log); columns auto-size to content (auto table
  layout) instead of squeezing a header onto two lines.
- **polish(admin): mobile spacing.** Re-tuned the content gutters/top padding for phones alongside
  the width change. `v1.0.4`.

## 2026-06-22 (v1.0.3 — slim down: dead scripts + deps + comments)
- **chore: removed `@vercel/analytics`.** It duplicated the built-in cookieless analytics and
  shipped extra client JS; dropped the `<Analytics/>` tag + the package. The custom analytics
  (`analytics.ts`, Admin → Analytics) is unchanged.
- **chore: moved 12 pre-Supabase one-off scripts to `scripts/legacy/`** (kept for recovery, not
  deleted). Their parser deps (`gray-matter` → devDeps, `turndown`/`turndown-plugin-gfm`/
  `fast-xml-parser` already dev) no longer sit in production `dependencies`.
- **docs: trimmed verbose comments** across the data layer (`media`/`files`/`posts`/`settings`/
  `blob`/`themes`/`revalidate`) + `layout.tsx` / `PostContent.tsx` to terse, AI-readable notes —
  GOTCHAs and the "why" behind non-obvious decisions kept. No behavior change. `v1.0.3`.

## 2026-06-22 (v1.0.2 — collapsible sidebar + admin polish)
- **feat(admin): the sidebar is now collapsible and icon-led.** Each nav item has an icon
  (`navIcons.tsx`); the rail is narrower (`w-52`, was `w-60`) and a toggle collapses it to
  icon-only (`w-16`), persisted in localStorage and remembered across navigation. Collapsed items
  show a tooltip; the footer controls switch to icon-only too. The fixed settings/editor save bars
  follow the rail via a `--admin-nav-w` CSS variable (no hardcoded offset). All monochrome — no
  hardcoded accent colors/fonts/text sizes, per the project rules.
- **polish(admin): softer cards + a mobile-safe analytics grid.** Added a subtle `shadow-sm` to the
  admin card containers (lifts white cards off the gray canvas, matching the reference) and made the
  Analytics summary cards stack on phones (`grid-cols-1 sm:grid-cols-3`) instead of cramming three
  across. `v1.0.2`.

## 2026-06-22 (v1.0.1 — admin-managed MCP + left sidebar)
- **feat(mcp): MCP is now toggled + tokenized from the admin.** Replaced the single `MCP_TOKEN`
  env var with an Admin → Settings → Advanced panel: an **enable toggle** (`settings.mcp.enabled`)
  and an **access-token manager** — generate up to **5 named tokens**, each shown **once** on
  creation (only its SHA-256 hash is stored in a new `mcp_tokens` table), with last-used time and
  one-click revoke. `verifyMcpToken` now checks the bearer's hash against live tokens while the
  toggle is on. The OAuth `/token` exchange mints a managed token (named "OAuth connector",
  refreshed per connect) instead of returning a static secret. New owner-only
  `/api/mcp/tokens` (+ `/[id]`) routes; activity actions `mcp.token.create|delete`.
- **feat(admin): left vertical sidebar nav.** The admin top bar grew too crowded, so navigation
  moved to a sticky left sidebar (brand → links → theme/palette/cache/sign-out pinned at the
  bottom), with active-route highlighting; it collapses to a hamburger drawer on mobile. New
  `AdminSidebar` (replaces `AdminHeader`); shared `SIDEBAR_NAV` constant keeps every item uniform.
- **change(settings): "Text rendering" moved from Advanced → Appearance.** Font smoothing now sits
  with the other appearance controls; Advanced holds the MCP panel + custom CSS. `v1.0.1`.

## 2026-06-22 (v1.0.0 — MCP server + Trash)
First stable release: the blog can now be operated by an AI agent over MCP, and every
delete is recoverable via a Trash.

### MCP server
- **feat(mcp): remote MCP endpoint at `/api/mcp` (Streamable HTTP).** An MCP client (Claude,
  ChatGPT, …) can operate the blog through the SAME data layer as the admin UI — tools to
  list/get/create/update/delete(→Trash)/restore posts and pages, manage media + files (incl.
  `add_media_from_url`), read taxonomy, and read settings. Content is Markdown verbatim (no
  conversion). Tools live in `src/lib/mcp`; built on `mcp-handler` + `@modelcontextprotocol/sdk`.
- **feat(mcp): one full-access token + a thin OAuth layer.** Auth is a single bearer
  `MCP_TOKEN` ("one token, full power"); connectors that require OAuth obtain it via a minimal
  OAuth 2.1 flow (authorization-code + PKCE) gated by the owner's existing NextAuth login —
  `/api/mcp/{authorize,token,register}` + `/.well-known/oauth-{protected-resource,authorization-server}`.
  Unset `MCP_TOKEN` disables the endpoint entirely.
- **feat(mcp): sensitive settings are blocked.** `get_settings` reads everything, but
  `update_settings` exposes only a safe allowlist (title / description / showDescription) — theme,
  fonts, typography, menu, domain, SEO, language and logos cannot be changed over MCP.

### Trash / soft delete
- **feat(trash): every delete is now a soft delete to a recoverable Trash.** Posts, pages, media
  and files gain a nullable `deleted_at` column (NULL = live, timestamp = trashed). Deleting from
  anywhere (admin tables, media/file libraries, multi-select, "delete all unused") now MOVES the
  item to Trash instead of destroying it — every live read filters `deleted_at is null`, so trashed
  items vanish from the site, lists, search, sitemap/feed/llms and the libraries. Media/file soft
  delete KEEPS the blob, so a published post that links a trashed image keeps rendering; nothing is
  removed from Blob until an explicit purge. A trashed row keeps its slug (still reserved) so
  restore always works.
- **feat(trash): new Admin → Trash page (`/admin/trash`).** Four tabs (Posts / Pages / Media /
  Files), each its own list with **Restore** + **Delete permanently**, plus **Empty trash** per
  tab. Nothing auto-purges — permanent removal is manual only. New unified `POST /api/trash`
  (`{ kind, action: restore|purge|empty, ids? }`), owner-gated; restores revalidate the item's
  surfaces, media/file purges revalidate everything (blobs removed). New activity actions
  (`*.restore` / `*.purge` / `trash.empty`). i18n synced across all 6 locales. `v1.0.0`.

## 2026-06-22 (fix: duplicate favicon)
- **fix(favicon): emit exactly one `<link rel="icon">`.** Next auto-injects a `<link>` for
  `app/favicon.ico` **in addition to** the metadata `icons.icon`, so the page shipped two
  conflicting favicons (the bundled `vb` default declaring `sizes="256x256"` + the owner's custom
  one) and browsers often picked the wrong/bundled one — the custom favicon looked like it wasn't
  loading. Moved the default to `public/favicon.ico` (no auto-inject) and drive the icon solely via
  `generateMetadata` (`settings.faviconUrl || '/favicon.ico'`). `v0.9.29`.

## 2026-06-22 (audit fixes: self-hosted font, link hardening)
- **fix(build): self-host Inter — no more Google Fonts dependency.** Replaced `next/font/google`
  (which fetched Inter at build → broke offline / restricted-CI / Google-outage builds) with
  self-hosted variable woff2 (`public/fonts/`, subsetted by `unicode-range` in `globals.css`). The
  OG image already self-hosts the same Inter as `.woff`, so the whole app is now Google-free; one
  typeface everywhere, fully local. The latin subset is preloaded.
- **fix(security): sanitize link hrefs.** `PostContent` now drops `javascript:`/`data:`/`vbscript:`
  link schemes (marked v5+ stopped sanitizing) — `[x](javascript:…)` no longer renders an
  executable href. Raw HTML was already escaped, so this closes the remaining vector.
- **fix(toc): de-dupe heading ids.** Two identical headings used to emit the same `id` (broken ToC
  anchors); now 2nd → `foo-2`, 3rd → `foo-3`, with `PostContent` and `extractHeadings` sharing the
  counter so anchors line up.
- **fix(auth): normalize the owner email** (trim + lowercase both sides) so a provider returning a
  different case / stray whitespace can't lock the owner out.
- **fix(images): parse image-placement fragments as exact tokens** (`#left`/`#right`/`#wide`/
  `#left-wide`) so a stray fragment like `#bright` no longer matches `right`.
- **chore: add `typecheck` script** (`tsc --noEmit`). `v0.9.28`.

## 2026-06-22 (docs: slim CLAUDE.md)
- **docs(claude): CLAUDE.md 560 → 358 lines (−36%) with zero rules lost.** Deduped the "why"
  (delegated to ARCHITECTURE.md via a header note), deleted the standalone Portability section
  (its rule lives in Blob; rationale in ARCHITECTURE), compressed the data-layer table + the
  descriptive sections (SEO/Editor/Settings/PWA/etc.) to essentials, and collapsed the legacy
  scripts table to a one-line list. Every HARD RULE and GOTCHA kept verbatim (caching DO-NOTs,
  header `h-9`/no-`items-baseline`, one-font + grep checks, `hr{margin:0}`, i18n sync, versioning).
- **docs(claude): fixed a stale contradiction** — removed the dangling "`blob.ts` readJson/readText
  return fallback" line; those were already removed in P1.5 (the doc said so two sections earlier).

## 2026-06-22 (docs: DB schema + working principles)
- **docs(setup): added `scripts/schema.sql`** — the full Postgres schema (all 9 tables,
  indexes, the `posts.search` generated tsvector, RLS, and the `analytics_summary`/
  `analytics_totals` RPCs), transcribed from the live database. Self-hosters can now create
  the whole DB in one run; previously the repo had no schema at all (the migration script
  assumed the tables existed). Idempotent.
- **docs(readme): rewrote the install guide** — a step-by-step **Local setup** (prerequisites,
  clone → run `schema.sql` → Supabase keys → Blob token → OAuth app → env → run) and added the
  missing **Supabase / `schema.sql`** step to both Vercel deploy paths (manual + AI agent).
- **docs(claude): added a "Working principles" section** (think-before-coding, simplicity,
  surgical changes, goal-driven verification) at the top of CLAUDE.md, adapted to this repo —
  notably that verification = `npm run build` + `npm run lint` (no test suite). Pure docs — no
  version bump.

## 2026-06-22 (auto-sized header logo)
- **feat(logo): the header logo is auto-compressed to the chosen size.** The owner's picked logo
  (`logoUrl`) is ALWAYS kept untouched; on every settings save we (re)build one small WebP scaled to
  the header width at **2x for retina** (`renderLogo` in `lib/files.ts`, via sharp, never upscaled
  past the source) and serve THAT in the header (`logoRenderUrl`). The previous derived file is
  deleted each regeneration, so exactly one ever lives on the store (under `files/logo-*.webp`, hidden
  from every grid). Regenerates only when the source or `logoWidth` changes (or none exists yet);
  cleared when the logo is removed/hidden. Vector (svg) / animated (gif) logos are served as-is (no
  derived file). Cuts the header image payload from the full-size original to a few KB — the main
  PageSpeed "image delivery" win.
- **fix(cls): the logo now reserves its space.** The `<img>` carries `width`+`height` (`logoRenderHeight`
  = displayed height at `logoWidth`), so the header no longer shifts as the logo loads. `v0.9.27`.

## 2026-06-22 (one-font rule — absolute, no exceptions)
- **change(typography): one typeface for EVERYTHING, hard rule.** Removed the last monospace
  spots in admin (hex inputs, raw-Markdown source editor, code-token button, activity badge) — the
  whole app, public and admin, now renders in the single site font (`--font-sans`); `grep font-mono
  src` is empty.
- **feat(og): the OG image follows the custom font too.** When the owner uploads a font, `lib/og.ts`
  appends `?font=<blobUrl>` and the `/og` route renders the card in it (Blob host only, SSRF-guarded;
  Inter stays the glyph fallback). With no custom font it stays Inter — so the share image always
  matches the site's one font.
- **docs:** recorded the rule (one font + zero hardcoded font/size, everywhere incl. admin + OG; a
  custom font governs the whole site) in CLAUDE.md conventions + the Typography/OG sections. `v0.9.26`.

## 2026-06-22 (type scale re-tuned + one font everywhere)
- **change(typography): smaller, calmer default scale.** List-card titles (H2) were reading as
  banners — the whole scale was re-tuned down to a restrained ~1.18 ratio off an 18px body:
  `h1 1.95 / h2 1.4 / h3 1.2 / h4 1.15 / h5 0.9 rem` (was `2.26 / 1.74 / 1.45 / 1.24 / 0.9`),
  with line-heights/letter-spacing balanced per role for long-form reading. Reset restores these.
- **change(typography): one typeface for everything.** Code blocks + inline code now reuse the
  site font (Inter or the uploaded face) instead of a separate monospace stack — no font family
  is ever auto-added on the reading site. (Admin keeps functional monospace for the hex inputs +
  raw-Markdown source editor, a deliberate tool affordance.)
- **chore(typography): full site sweep, no stray hardcoded sizes.** Search inputs now use the
  `.fs-h2`/`.fs-h3` roles; the only remaining fixed public sizes are the brand wordmark and the
  404 numeral (deliberate display). Admin's arbitrary `text-[10px]/[11px]` badges normalized to
  `text-xs`; admin chrome otherwise stays on Tailwind's standard scale by design (it must NOT
  resize when the owner tunes the reader's content sizes). `v0.9.25`.

## 2026-06-21 (full per-role typography + per-weight fonts)
- **feat(typography): every text role fully tunable, zero hardcoded sizes.** Nine roles —
  h1–h5, body, small (dates/meta/related/ToC/pagination/search), caption, code — each with its
  own **size / line-height / letter-spacing**, emitted as CSS vars (`--fs-*`, `--lh-*`, `--ls-*`).
  All public reading + secondary text now maps to a role (new `.t-small` utility replaced every
  `text-sm`); only brand wordmark, search box, and the 404 numeral stay as deliberate one-offs.
  Defaults are tuned to read well; reset restores them exactly.
- **feat(typography): custom font per weight.** Four upload slots (Regular 400 / Medium 500 /
  SemiBold 600 / Bold 700) sharing one family — one `@font-face` per weight, so headings/bold are
  crisp (the site disables faux-bold). `POST /api/files/font` takes a `weight`; `settings.customFont`
  is now `{ family, faces[] }`. Old single-file shape migrates to the 400 slot.
- **change(admin): Settings tabs finalized** — Appearance holds colors + font (4 slots) + the
  per-role text-size table; Advanced holds the font-smoothing toggle + custom CSS. `v0.9.24`.

## 2026-06-21 (fonts + typography controls + settings tabs)
- **feat(typography): custom font upload.** Admin → Settings → Appearance can upload a typeface
  (`.woff2/.woff/.ttf/.otf`); it's stored on Blob under `files/` (separate from the media grid),
  registered via `@font-face`, and applied site-wide (`--font-sans`, Inter stays the fallback).
  `POST /api/files/font` → `{ url, family }`; `settings.customFont`. Remove restores Inter.
- **feat(typography): body size + reading rhythm + smoothing.** The scale now also covers normal
  body text (`--fs-base`); new controls for **line spacing** (`--lh-body`), **letter spacing**
  (`--ls-body`), and a **font-smoothing (anti-alias)** toggle. Stored in `settings.typography`,
  injected as a `:root` override; each group has its own reset-to-default.
- **change(admin): Settings split into 3 tabs** — General, Appearance, Advanced. Colors + font +
  text sizes live under Appearance; spacing/smoothing + custom CSS under Advanced. `v0.9.23`.

## 2026-06-21 (typography follow-up)
- **change(typography): list cards use H2, not H1.** Single post/page titles (and category/tag
  list-page headings) stay H1; post titles inside listings step down to H2 so the listing reads
  calmer. `v0.9.22`.

## 2026-06-21 (typography scale)
- **feat(typography): one site-wide heading scale (H1–H5), no hardcoded sizes.** Heading
  sizes now flow from five CSS variables (`--fs-h1`…`--fs-h5`) instead of per-element
  `text-[…]` values. Defaults follow the owner's spec — H1 ≈ 30% larger than H2, H2 20%
  larger than before (and 20% larger than H3), H4 10% larger than body text, H5 20% smaller
  (body = 1.125rem): `2.26 / 1.74 / 1.45 / 1.24 / 0.9 rem`. **Every title** (single post,
  single page, list cards, category/tag list pages, draft preview) uses **H1**.
- **feat(editor): H4 + H5 buttons** in the post/page editor toolbar (alongside H1–H3); the
  public renderer + `.prose` now style `h4`/`h5`.
- **feat(settings): "Heading sizes" card** (Admin → Settings) to customize each level (rem)
  with a live preview and a **reset-to-default** button. Stored in `settings.typography`,
  injected as a `:root` override after `globals.css`. `v0.9.21`.

## 2026-06-21 (uploads)
- **fix(media/files): browser-direct uploads — large files no longer fail.** Images and
  attachments now upload straight from the browser to Vercel Blob (`/api/media/blob-token` +
  `/api/media/register`, `/api/files/blob-token` + `/api/files/register`), bypassing the
  serverless **4.5MB request-body limit** that was silently dropping bigger files. The metadata
  is registered server-side (dimensions + thumbnail fetched back for images), the new item
  appears in the grid/list immediately (no refresh), and success/failure is always reported.
  Removed the old `POST /api/media/upload` and `POST /api/files`. `v0.9.20`.

## 2026-06-21 (analytics follow-up)
- **feat(analytics): scroll-depth / average read %.** A `<ScrollDepth/>` beacon on posts sends
  the max % of the page reached on leave (`analytics_scroll` table); the dashboard shows an
  overall "avg. read depth" and a per-page % in Top pages. `v0.9.19`.
- **feat(analytics): 24-hour range (hourly buckets).** New 24h option before 7d; the chart
  buckets by hour for it (day otherwise), via a `bucket` arg on `analytics_summary`. `v0.9.19`.
- **feat(admin): View column on the content tables.** Posts and Pages now show all-time total
  views per item (`analytics_totals` RPC → `getViewTotals`). `v0.9.19`.
- **change(analytics): keep events forever.** Dropped the 1-year cron purge — the full history
  is retained. `v0.9.19`.
- **change(admin): Analytics moved next to the home tab** in the admin nav. `v0.9.19`.

## 2026-06-21 (admin + analytics batch)
- **feat(analytics): self-hosted, cookieless page-view analytics.** New Postgres
  `analytics_events` table + `analytics_summary` RPC, a fire-and-forget `<Track/>` beacon
  (`POST /api/track`, runs after the response, never makes a page dynamic), and an
  **Admin → Analytics** page: total views, unique visitors, a daily bar series, and top
  pages over 7d / 30d / 1y. Visitors are counted by a salted IP+user-agent hash — no
  cookies, no PII stored; bots and admin/api paths are dropped. The hourly cron purges
  events older than a year. `v0.9.18`.
- **feat(admin): multi-select delete in the library.** Checkboxes + "Delete selected" on
  both the Images grid and the Files list (atomic batch delete; new `deleteFilesBatch` +
  `POST /api/files/delete`). `v0.9.18`.
- **feat(admin): Files tab lists the site icons.** The favicon / app icon uploaded in
  Settings now appear in a read-only group (tagged "Settings", `getSiteIcons` +
  `GET /api/files/icons`). An intro under the Library title explains image versions vs
  files-as-is. `v0.9.18`.
- **feat(admin): richer System panel.** The Overview system card now shows the live URL,
  branch, framework + Node runtime, and deep-links to the Vercel dashboard, Blob stores,
  the Supabase project, and the GitHub commit. `v0.9.18`.
- **feat(public): search opens in an overlay.** The header search icon opens a modal
  search-in-place (instant local title/tag + debounced body FTS) instead of navigating to
  `/search` (which still exists for deep links / no-JS). New `GET /api/search/index` serves
  the lean index. `v0.9.18`.

## 2026-06-21 (later)
- **style(post): match the single-post title to the list card title.** The `/[slug]` post
  heading now uses the same size + weight as the home/list card title (`text-[1.35rem]
  font-semibold`) so a post reads consistently from the listing into the article. `v0.9.17`.

## 2026-06-21
- **perf(images): intrinsic width/height + eager LCP image.** Body images now render with their
  stored pixel dimensions (from the `media` table) so the browser reserves the box before bytes
  arrive — eliminates layout shift (CLS). The first body image loads eagerly with
  `fetchpriority=high` (likely the LCP element) instead of lazily. `v0.9.16`.
- **feat(reading): server-side syntax highlighting (Shiki).** Code blocks are highlighted at
  render with Shiki (Vitesse light/dark, muted to fit the minimal surface) — zero client JS.
  Dual-theme tokens swap with the site's dark mode via CSS. Unknown languages / failures fall
  back to the plain escaped block. `v0.9.16`.
- **feat(search): full-text search over the article body.** The public search now also queries
  the Postgres `search` tsvector (`/api/search`, `websearch_to_tsquery('simple')`) so matches
  inside post bodies surface, merged after the instant local title/tag results. `v0.9.16`.
- **feat(admin): filter + status tabs on the posts table.** A folded title/tag search box and an
  All/Published/Draft segmented control to find posts fast as the archive grows. `v0.9.16`.
- **feat(reading): back-to-top button + wide-image mobile clamp.** A themed scroll-to-top button
  appears past the first viewport on posts; `img-wide` figures clamp to the column on phones so
  they never force horizontal scrolling. `v0.9.16`.

## 2026-06-22
- **fix(cache): tag Supabase reads + `revalidateTag('db')` on every save.** GET reads now carry
  the `db` tag (cache-eligible, so pages stay ISR); each write helper in `revalidate.ts` calls
  `revalidateTag('db','max')` alongside its `revalidatePath` superset, so a re-rendered page
  always reads fresh from Postgres — closes the window where an ISR page could serve up-to-1h
  stale data after an edit. `v0.9.15`.
- **feat(media): cron backfills missing thumbnails.** `finalizePendingThumbs` generates a
  `-thumb.webp` for any media row without a thumb (e.g. migration imports), so the library grid
  never has to load full-size originals. Runs hourly with the variant sweep. `v0.9.15`.
- **chore: code + docs cleanup after the Supabase move.** Removed the dead vanity-domain
  priming (`getSettings()` calls in read paths), tidied the data layer, and rewrote the caching
  / Blob / data-model docs (CLAUDE/ARCHITECTURE/README) to match the Postgres model; legacy
  `_index.json` scripts flagged as pre-migration. `v0.9.15`.
- **fix(media): render the canonical lowercase Blob host.** The store id is mixed-case in the
  token but the public host is lowercase; `blobBase()` now lowercases it so image URLs are
  canonical (avoids uppercase/lowercase duplicate-URL SEO). `v0.9.14`.
- **change(media): drop the vanity media domain — serve images straight from Vercel Blob.**
  Removed the `mediaBaseUrl` setting + `BLOB_PUBLIC_BASE` env + the `setMediaBase`/`publicBase`
  machinery; `expandBlob`/`blobOrigin` now always use the Blob store host. Fixes broken
  thumbnails in the media library (the proxy returned a restrictive CSP), simplifies the data
  layer (removed the now-dead `getSettings()` priming from every read), and keeps content
  store-relative so a future move (e.g. → R2) is still just a token/base swap. `v0.9.13`.
- **feat(seo): image sitemap + Article image.** `sitemap.xml` now lists each post's images
  (`<image:image>`) and the post's `BlogPosting` JSON-LD carries an `image` (featured, else the
  first body image), so search engines associate every image with its manhhung.me page even
  though the files are on the Blob host. New `extractImageUrls` helper. `v0.9.13`.
- **feat(admin): activity log — transparent record of admin actions.** Every mutation
  (post/page create·update·delete, media/file upload·delete, icon upload, settings save,
  taxonomy change, cache clear) is recorded to a Postgres `activity_log` table and shown on
  a new **Admin → Log** page (newest first, with a Clear button). Logging is toggleable in
  Settings → Features (`activityLog`, default on); writes happen via `after()` so they never
  slow the action. New `src/lib/activity.ts`, `GET/DELETE /api/activity`. `v0.9.12`.
- **feat(admin): System panel on the Overview.** Shows hosting (Vercel) + region + environment
  + commit, the database (Supabase · region · ref) with a live reachability check, and the
  media storage host. `v0.9.12`.
- **fix(media): deleting an image now removes EVERY version, original included.** Delete attempts
  the original + thumbnail + all four display variants for any raster (idempotent / no-op when a
  file is absent), regardless of the `variants` flag, so nothing is ever left orphaned on the
  store. Upload already keeps the untouched original. `v0.9.12`.
- **feat(storage): move all TEXT content from Vercel Blob to Supabase Postgres (P1.5).** Posts,
  pages, revisions, media/file metadata and settings now live in Postgres tables; the
  `_index.json` manifests + `.md` files are gone. Binaries (images, attachments, icons) stay on
  Vercel Blob, referenced store-relative (still portable, e.g. to Cloudflare R2). This kills the
  whole class of no-DB bugs at the root: **deleted images can no longer "come back"** (each row
  delete is atomic — no concurrent manifest read-modify-write to clobber), reads are always
  fresh + transactional (no `?ts` cache-bust needed; removed), and **admin save is faster** —
  the read-modify-write of the manifest is now a single atomic upsert. New `src/lib/db.ts`
  (server-only `service_role` client; reads cache-eligible for ISR, writes `no-store`).
  A Postgres `tsvector` column is in place for future body search. Schema lives in the
  `Quire Blog` Supabase project (ap-southeast-1). `v0.9.11`.
- **perf(save): display-variant (AVIF/WebP) encoding moved OFF the save request.** `savePost`/
  `savePage` return immediately after the DB write; `finalizeContentMedia` runs in the
  background via `after()` (the original always renders meanwhile). An hourly Vercel Cron
  (`/api/cron`) sweeps any still-pending variants AND keep-alives the Supabase free-tier
  project so it never pauses. `v0.9.11`.
- **fix(media): atomic batch delete — fixes "deleted unused images come back".** Root cause was
  a lost-update race, not matching: deleting several unused images fired separate requests that
  each read the same manifest and wrote their own copy, so the last write clobbered the earlier
  removals (a no-DB concurrency bug). New `deleteMediaBatch` removes ALL given URLs in ONE
  manifest read-modify-write (single delete now delegates to it), and a **"Delete all unused"**
  button (`POST /api/media/delete`) sweeps the whole unused set atomically. Blob-file cleanup is
  best-effort after the write and only touches variants that were actually generated (faster).
  `v0.9.10`.
- **fix(media): surface a silent no-match delete + add an owner diagnostic.** If the delete
  endpoint matched nothing (URL still present in the returned list), the library now shows an
  explicit error toast instead of leaving the image silently in place. Added owner-only
  `GET /api/media/debug?url=…` reporting the manifest size, the extracted match key, how many
  entries matched, a sample of stored URLs, and the configured media base — ground truth for a
  "stuck" delete. `v0.9.9`.
- **fix(media): delete now matches host-independently + writes manifest first.** Root-caused the
  "deleted image stays / re-appears in unused check" once more: the match relied on
  `collapseBlob` stripping the URL host, which silently found nothing if the primed host didn't
  equal the URL's host — so the manifest was never rewritten. Now `deleteMedia`/`deleteFile`
  match by the extracted `media/…` / `files/…` **pathname** (works for any host or a collapsed
  path, no `getSettings` priming needed), and write the reduced manifest **before** the blob-file
  cleanup so the removal sticks even if the (slower) file deletes stall. Dropped the per-delete
  settings read too (faster). `v0.9.8`.
- **style(theme): nicer public palette trigger icon** — replaced the swatch-grid glyph with
  three overlapping color circles (cleaner, clearly "color theme"). `v0.9.7`.
- **fix(media)/perf(admin): authoritative-from-write deletes (approach A).** The image/file
  delete endpoints now return the **true post-delete list, built from the in-memory manifest
  they just wrote — no Blob re-read** — and the library adopts it directly. This removes the
  read-after-write/eventual-consistency window that made a deleted image seem to "come back",
  and makes a failed server delete visible instead of silently optimistic. Hardened
  `deleteMedia`/`deleteFile`: only rewrite the manifest when an entry actually matched (never
  wipe it on a transient read failure), and sweep the original + thumb + all four display
  variants for any raster (regardless of the stored `variants` flag). `v0.9.6`.
- **chore: version in README title + repo link on the Overview pill.** The README H1 now
  carries the version (`# Quire Blog (v0.9.x)`, kept in sync on each bump), and the admin
  Overview version pill links to the repo root (`/quire`) instead of the releases page.
  `v0.9.5`.
- **feat(theme): polish the palette pickers + localize palette names.** Admin Settings →
  Appearance: the preset cards are more compact and spaced out, borderless — the selected
  palette reads via full opacity + a bold name while the rest sit dimmed (no rings/borders).
  Public switcher: a clearer swatch-grid trigger icon (the artist-palette glyph was ambiguous)
  and a wider preview chip that shows each palette's basic colors (heading/body/link/meta).
  Palette names (Mono/Sepia/Forest/Ocean/Rosé/Amber) are now **localized** via a `paletteNames`
  dict in all six admin + six public locales (no longer hardcoded in `themes.ts`).
- **chore(admin-nav): rename nav items.** "Pages / Posts" → **Content**; the appearance
  switcher now shows a fixed **"Appearance"** label instead of the current palette's name.
  Both across all six admin locales. `v0.9.4`.
- **feat(library): rename the media page to "Library" and split it into two tabs** — **Images**
  (the existing media library, unchanged) and **Files**, a new catch-all store for non-image
  attachments (PDF, zip, docx, audio…). Files upload to the `files/` Blob prefix with their own
  manifest (`files/_index.json`), with upload / copy-URL / download / delete; the site icons
  under `files/` (favicon, app icon) are excluded from the tab. New `GET/POST /api/files` +
  `DELETE /api/files/by`; nav label + page title updated across all six locales. `v0.9.3`.
- **fix(media): delete now removes ALL versions of an image from Blob and actually takes
  effect.** Two bugs in `deleteMedia`: (1) it didn't prime the vanity media base before
  `collapseBlob`, so when a custom media host was configured the deleted URL never collapsed to
  its `media/…` pathname — nothing matched and the delete silently no-op'd (the image stayed in
  the library, including "unused" items). (2) display variants (`-1024/-1600` AVIF+WebP) were
  only removed when the manifest `variants` flag was true, leaving orphans if it was stale. Now
  it primes settings first and unconditionally sweeps the thumb + all four variants for any
  raster original. `v0.9.2`.
- **docs(deploy): expanded the "Deploy to Vercel" guide into two clear methods** — (A) manual
  via the Vercel dashboard (fork → Blob store → env vars → OAuth callback → sign in), noting the
  two `vercel.json` settings to adjust for yourself (the `sin1` region is just the author's
  nearest region — change it; the 60s upload `maxDuration` can exceed the free plan); and (B) handing the whole
  install to an AI agent with Vercel + GitHub access (generic — OpenClaw / Hermes / Claude / …)
- **docs(license): make the code-vs-content split explicit.** The platform code stays
  **MIT** — free to use/modify/redistribute with **no attribution required**. Clarified that
  the blog **content** published with it (the author's writing/images, e.g. manhhung.me) is
  **© all rights reserved** and not covered by MIT. Added a "Scope" note to `LICENSE`, a
  two-layer README License section, `"license": "MIT"` in package.json, and an **MIT pill** on
  the admin Overview (links to the LICENSE) so the open-source status shows in-app too
- **chore(audit): add `audit/` log + repeatable audit procedure** (`audit/README.md`): an
  8-section pass (baseline → security → logic → perf → code quality → layout → i18n → docs)
  recorded as dated reports, so each comprehensive review starts from the last clean line.
  First report `audit/2026-06-22-comprehensive.md`. CLAUDE.md points to it; CHECKLIST gains a
  **Layout / visual** section (was missing despite the owner's alignment sensitivity)
- **fix(layout): de-duplicate the public header icon-button class into `ICON_BTN`**
  (`components/ui/iconButton.ts`). Search / palette / theme / menu each re-typed the same
  `h-10 w-10 … text-meta hover:bg-rule` string — a drift risk the "one shared class" rule
  forbids; now all four import the constant (same pattern as `ADMIN_NAV`)
- **chore: full project audit (tech / security / perf / logic) — clean.** No vulnerabilities or
  logic bugs found: every write/delete route is owner-gated, palette colors are hex-validated
  before the `<style>` emit, custom CSS strips `</style`, raw HTML in markdown is escaped,
  preview tokens use `timingSafeEqual`, RSS/sitemap output is escaped, icon upload is
  type+kind-whitelisted. Fixed stale docs/comments only: corrected the `themes.ts` header to the
  per-palette model, the CHECKLIST "Clean unused → Check unused" (read-only) line, README feature
  list (palettes/PWA/time-machine/icons) + Blob prefixes, and the ARCHITECTURE data model
  (`revisions/`, `files/`, per-palette settings) + theming/PWA design notes
- **feat(theme): visitor palette switcher (6 palettes) on public + admin headers** — like the
  dark/light toggle but for color palette. `PaletteToggle` writes `<html data-palette>` +
  localStorage; `themesToCss` emits every palette's vars so switching is instant (no reload), and
  a no-FOUC script applies the saved palette before paint. Mode (light/dark) × palette are now
  orthogonal axes
- **feat(settings): every palette is independently customizable** — admin color editor now edits
  ANY of the 6 palettes (picker = which one you're editing), each saved under `settings.themes`;
  "Set as default" picks the visitor default; per-mode reset restores that palette's built-in
  colors. Replaces the old single `theme` (auto-migrated into the default palette on read)
- **fix(settings): favicon / app icon upload moved out of the media library** to a dedicated
  `files/` store (`POST /api/files/upload`, `lib/files.ts`, `IconUpload`). **Accepts `.ico`** (the
  media library rejected it) plus PNG/SVG/JPG/WebP/GIF; site icons no longer clutter the grid

## 2026-06-21
- **feat(pwa): installable app on iPhone + Android** — add to the home screen and launch
  standalone (full-screen, no browser chrome). Dynamic `app/manifest.ts` (name/theme/icon from
  settings) + apple-touch-icon + `appleWebApp` + per-mode `theme-color` (`generateViewport`).
  New **App icon** picker in Settings (next to the favicon); icon resolves appIcon → favicon →
  bundled `public/app-icon.png`. **Installable + standalone only — no service worker / no
  offline** (kept thin on purpose; admin & API are never cached). `resolveAppIcon` in settings.ts
- **feat(settings): 6 built-in color presets** (Mono / Sepia / Forest / Ocean / Rosé / Amber),
  each a full light+dark palette tuned for readable contrast in both modes (`lib/themes.ts`).
  Appearance now opens with a palette picker (live light/dark preview swatches); selecting one
  fills both modes, and `settings.themePreset` remembers the choice so each mode's "reset"
  restores THAT preset's colors. Every color stays fully editable + savable after picking;
  the public site still renders only `theme` via `themeToCss`, so nothing is hardcoded
- **change(media): replaced the destructive "Clean unused" button with a read-only "Check
  unused" audit** (`GET /api/media/unused`, `lib/media-usage.ts`; removed `lib/sweep.ts` +
  `POST /api/media/sweep`). It badges media referenced by no post/page/settings in the grid
  and offers a "show unused only" filter — the owner deletes by hand. Now also scans **revision
  snapshots**, so an image kept only in the time machine is no longer flagged (the old sweeper
  ignored revisions and could permanently delete an image a restore still needed)
- **fix(admin): header wordmark/menu now share one h-9 box → perfectly aligned.** Removed the
  `v0.x.y` badge from beside the logo; the running version (now a link to GitHub releases)
  lives only on the Overview page. Alignment rule documented in CLAUDE.md (no more baseline drift)
- **feat(admin): media library shows each image's resolution** (`w×h`). Uploads now capture
  dimensions for svg/gif/webp too (not just jpg/png); `backfill-media-dimensions.mjs` filled the
  existing library (45 images)
- docs: corrected the changelog dates — entries had drifted into the future (up to 06-25);
  remapped to the real git timeline (work happened 06-19 → 06-21 only)
- **docs: added `ROADMAP.md`** (Vercel-or-Docker from one codebase, publishing from Markdown
  note apps, optional AI assist) and refreshed the guidance files for self-hosters: README
  stack/versions + Node 20.9+ requirement + roadmap pointer, and corrected the stale
  "full purge on every save" wording in README/ARCHITECTURE to the current scoped
  invalidation (`src/lib/revalidate.ts`). Added an `engines.node` field to `package.json`.

- **feat(admin): manage categories & tags (new Phân loại tab).** A third tab on the content
  dashboard lists every category and tag with its usage count and lets you **rename** (merges
  into an existing term) or **remove** it across ALL posts in one action (`updateTerm` →
  `POST /api/taxonomy`, owner-only; rewrites each affected `.md` + the index, then full purge)
- **feat(admin): open-in-new-tab row action.** Each published post/page row gets an
  open-in-new-tab icon (left of edit) → its public URL; drafts omit it (would 404)
- **fix(admin): mobile-friendly content tables.** Secondary columns now hide on small screens
  (posts: date `sm`, categories `md`; pages: slug `sm`) so Title + Status + actions always fit
  and the status pill never wraps awkwardly. The tab + new-post row wraps on mobile too
- **fix(admin): header alignment + bigger logo.** The `Quire Blog` wordmark, its `v0.x.y` badge
  and the menu now share one vertically-centred line (was baseline-misaligned)
- **fix(admin): header polish.** Wordmark enlarged to logo size (`text-xl`); the version
  (`v0.7.5`) sits next to it and links to GitHub releases (replaces the removed footer link).
  Every header item now shares a fixed-height (`h-9`) `ADMIN_NAV` box so the row stays
  perfectly aligned on one line (fixes the recurring "menu not lined up" drift)
- **feat(admin): cleaner, responsive header + no footer.** The admin top bar is now one
  uniform row of text links: a `Quire Blog` wordmark (bold `blog`) replaces the old bold
  "Quản trị" brand; the first nav link is now **Trang chủ** (was "Quản trị"). The three
  right-side controls (theme, clear-cache, sign-out) are styled as the SAME text links as the
  menu — no longer button-shaped — and the theme control shows the applied theme as a **word**
  instead of a sun/moon icon. On mobile the whole menu collapses behind a **hamburger** toggle
  instead of spilling inline. Removed the `Quire Blog vX · changelog` admin footer. New
  `AdminHeader` client component; `ADMIN_NAV` shared style; `ThemeToggle` gains `variant='text'`;
  `CacheButton` gains a `className`. Locale key `navAdmin` → `navHome` (all 6 languages)
- **feat(seo): richer robots.txt policy.** Replaces the bare allow-all with three groups:
  major search engines + reputable AI assistants (Googlebot/Bingbot…, GPTBot/ClaudeBot/
  PerplexityBot/Google-Extended…, paired with `/llms.txt`) are explicitly allowed; aggressive
  SEO/data scrapers (`BAD_BOTS`: AhrefsBot, SemrushBot, MJ12bot, DotBot, PetalBot, Bytespider…)
  get `Disallow: /` to save crawl budget/bandwidth; `*` stays welcoming so unknown good bots
  (incl. new AI crawlers) keep working. Bot lists are editable consts atop `app/robots.ts`.
  Still gated by `seo.robots`; `/admin` + `/api` always off-limits
- **docs(claude): document media portability / no vendor lock-in.** New "Portability"
  section in CLAUDE.md: content is stored vendor-host-free (store-relative refs), the vanity
  domain already fronts media, Vercel coupling is isolated to `src/lib/blob.ts`, and a
  step-by-step path to migrate to an S3-compatible store (e.g. Cloudflare R2) without
  rewriting content or breaking public URLs
- chore(release): pre-release audit — `build`, `lint`, `tsc` all clean; verified every
  write/delete API route is owner-gated; removed an unused var in `remap-original-images.mjs`

## 2026-06-20
- **feat(seo): dynamic OG cards for the home, category and tag pages** (same card as
  posts/pages). Home: top line = domain, bottom = site description. Category: top line = the
  name; tag: top line = `#name` (the # marks it as a tag); both bottom = domain. Honors the
  dynamic-OG toggle + fallback image like the rest;
  new `ogCardUrl`/`siteDomain` helpers in `lib/og.ts`. The OG `site` line is now length-capped
- **fix(blog): desktop table-of-contents pinned to the viewport's left edge (50px in).**
  It was absolutely positioned against the centered content column's left edge, so wide /
  full-bleed images broke out into the gutter and overlapped it. Now `fixed` to the viewport,
  vertically centred (clears header/footer), with a max-height scroll for long lists
- **fix(admin): even header action cluster.** The "Clear cache" button was missing `text-sm`
  (oversized text) and changed width while busy (the `…` suffix), making it look lopsided next
  to the nav. Clear-cache + sign-out now share one `HEADER_ACTION` class constant
  (`components/admin/headerActions.ts`) so they can't drift again; busy state is shown by
  dimming, not a width-changing label. Convention added to CLAUDE.md
- **refactor(cache): all invalidation centralized in `src/lib/revalidate.ts` + scoped purges.**
  Edits now apply reliably and without dumping the whole site each time: a new post refreshes
  only the list/taxonomy surfaces (home, pagination, every category/tag page, feed/sitemap/llms)
  and leaves other post bodies warm; editing/deleting a post also refreshes its own page;
  editing a static page touches just its URL + sitemap; settings still purge the whole site and
  now re-warm it. Each helper is a deliberate SUPERSET of affected surfaces, so a change is
  never under-purged (the old "applies late" bug). One accepted minor staleness: the related-
  posts box on other posts (self-heals ≤1h, or use "Clear all cache")
- **fix(admin): editor save now calls `router.refresh()`** (PostForm + PageForm, matching
  SettingsView) so the client Router Cache is dropped — saves show on the next navigation
  instead of lagging behind a stale RSC. Pairs with the `staleTimes` config fix below
- **feat(security): baseline security response headers on every route** (`next.config.ts`
  `headers()`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics off). HSTS is
  already added by Vercel. CSP deliberately deferred (needs nonces + Report-Only rollout for
  the inline theme script + Analytics + OG + Blob images)
- fix(config): `experimental.staleTimes.static` was set to `0`, which Next 16 rejects (min 30)
  and silently ignored — leaving static routes on the ~5min client-cache default. Set to `30`
  (lowest accepted), so soft-nav freshness now matches the documented intent
- **refactor(cache): ISR pages + full purge on save (replaces the earlier force-dynamic).**
  Public pages are ISR-cached again for speed (`revalidate = 3600`; `/[slug]` prerendered via
  `generateStaticParams`), but every admin write now calls a single `revalidatePath('/',
  'layout')` that purges the WHOLE site — so an edit (content, theme/background, anything) is
  live on the next request. Reliable this time because it's ONE cache layer (no
  `unstable_cache`), the Full Route Cache is per-deployment (no cross-deploy stale), and Blob
  reads are `?ts`-busted (fresh on every regeneration). `blob.ts` reads switched from
  `cache: 'no-store'` to `{ next: { revalidate } }` so pages can be ISR-cached
- fix(settings): changing site settings (e.g. background color) now applies immediately —
  the save purges the cached layout/theme site-wide
- feat(admin): "Clear all cache" button is back and actually works — purges everything
  (`revalidatePath('/', 'layout')`) then warms the home + newest detail pages (`/api/cache/clear`)
- admin is fully `force-dynamic` (uncached) so the editor/media/settings always reflect the
  current Blob state; client Router Cache fully off (`staleTimes { dynamic: 0, static: 0 }`)

- **refactor(cache): removed the data cache entirely — content is now always fresh.**
  `unstable_cache` + tag revalidation kept fighting Blob's read-after-write and serving
  stale content (new posts missing, **deleted media reappearing**, settings not applying,
  cross-deploy Data Cache persistence). Replaced with: reads use `React.cache()` only
  (request-scoped dedup), and every public page + SEO route is `force-dynamic`. An edit
  now shows on the next plain reload — no rebuild, no "Clear cache" step
- removed the admin "Clear cache" button and `/api/cache/clear` (no cache to clear); the
  `/[slug]` page is no longer SSG (`generateStaticParams` dropped) — it renders fresh;
  dropped all cache-key versioning. Blob store confirmed in Singapore beside the functions
- fix(media): deleting an image in the library now sticks (it was the data cache re-serving
  the old manifest after the delete) — addressed by the always-fresh reads above

- fix(media): inserted images that didn't show. A `<picture>` gives NO fallback when a
  chosen `<source>` 404s, but `PostContent` emitted AVIF/WebP sources for every jpg/png
  *by convention* — so any image whose deferred variants weren't generated rendered blank.
  Now `<picture>` is emitted ONLY for originals whose variants are confirmed (media index
  `variants:true`, passed to `PostContent`); everything else is a plain `<img>` of the
  original, which always loads. Save routes also `revalidateTag('media')` so the
  optimized `<picture>` appears once variants exist. Existing broken posts self-heal
- fix(type): body text now renders at full weight — removed `-webkit-font-smoothing:
  antialiased` (body + the `<html>` `antialiased` class) which thinned glyphs and made
  reading look lighter than the old blog; dropped the negative body `letter-spacing`
  (-0.011em) that cramped accented Vietnamese. Font stays Inter; heading tracking kept
- fix(media): uploads were intermittently failing ("lúc ăn lúc không"). Root causes
  fixed: (1) the whole multi-file upload now does ONE read-modify-write of the manifest
  (`addMediaBatch`) instead of one per file, removing the lost-update race that dropped
  entries; (2) collision naming (`logo` → `logo-2`) now checks the ACTUAL store
  (`listBlobs`) ∪ manifest, so a stale manifest read can't pick a name that already
  exists; (3) `uploadFile` sets `allowOverwrite` as a final safety net so a re-upload
  never hard-throws "blob already exists"
- fix(editor): dragging an image into the editor now inserts reliably — the drop handler
  read a stale (null) editor from its capture closure; it now uses a live `editorRef`.
  Multiple dropped images upload sequentially and insert in order
- feat(seo): pagination is now path-based — `/page/2`, `/category/x/page/2`,
  `/tag/x/page/2` (was `?page=2`). Page 1 stays at the bare path; out-of-range or `/page/1`
  → 404 (no duplicate-content URLs). New `parsePathPage`; shared `BlogListing` component
- feat(read): blog list now shows reading time per post (gated by the readingTime
  feature). `readingMinutes` is computed from the body at save and stored in the index;
  `backfill-reading-time.mjs` filled it for existing posts. Index cache key → `v3`
- fix(ui): single post/page title now uses the same type scale as the blog-list title
  (one title format)

- feat(media): defer heavy variant encoding to save-time — drop/upload stores only the original + thumbnail (`variants:false`); the AVIF/WebP @1024/1600 set is generated by `finalizeContentMedia` on post/page save, only for images kept in the content (an image dropped then discarded never pays the AVIF encode). Save routes get `maxDuration=60`
- feat(media): "Clean unused" library button (`POST /api/media/sweep`, `lib/sweep.ts`) deletes media referenced by no post/page/settings — clears orphans
- feat(media): responsive image pipeline — jpg/png keep the **untouched original** + auto-generate `-1024`/`-1600` in **AVIF + WebP** + a `-thumb.webp`; `PostContent` renders `<picture>` so the browser auto-picks the lightest format/size. Library shows resolution + "download original"; delete removes all variants. svg/gif/webp stored as-is. HEIC dropped. Upload route `maxDuration=60`
- migration(blob): moved store to Singapore (`sin1`) — copied all blobs, collapsed stored URLs to pathnames, swapped `BLOB_READ_WRITE_TOKEN` (all envs), bumped cache keys for a clean cutover; media refs now store-relative end to end
- refactor(blob): store image refs **store-relative** (pathnames, not absolute URLs). `collapseBlob` on write / `expandBlob` on read in the data layer (posts/pages/settings); UI unchanged. Removes storeId lock-in — switching Blob store/region/provider needs no content rewrite. Idempotent, backward-compatible (old absolute URLs self-heal on next save)
- perf(region): `vercel.json` pins functions to `sin1` (Singapore) — was running in `iad1` (US-East), ~200ms from Vietnam; Singapore is ~40ms (Blob store also moved to Singapore, see above)

- feat(i18n): 4 new UI languages — German, Japanese, Simplified Chinese, Korean (now en/vi/de/ja/zh/ko); **English is the default**
- refactor(i18n): strings moved to `src/locales/{<code>,admin/<code>}.ts`; `langs.ts` is the single source of truth (`SITE_LANGS` + `isSiteLang`); `satisfies` enforces every key in every language; `formatDate` is now Intl-per-locale (vi keeps custom form); language picker wraps
- fix(admin): language switch is now instant (optimistic `I18nProvider` state), no longer waits for the save round-trip
- fix(i18n): localize ~32 strings that were hardcoded Vietnamese (settings cards, reader-feature toggles, SEO fields, time machine, editor toasts) — they now translate in all 6 languages
- feat(admin): "Clear cache" button in the header (purges every data-cache tag + reloads) for an immediate "see my changes now" escape hatch

- feat(admin): clearer theme colour picker. The native `<input type="color">` swatch was tiny
  with default chrome, so it didn't read as clickable — enlarged it and stripped the inner
  padding/border so it's one clean colour chip. Clicking it opens the browser's full picker
  (2D area + hue + HEX); the hex field is now monospace/uppercase alongside.
- refactor(theme): every public-UI colour now comes from the theme tokens — no hardcoded
  `neutral-*`/`white`/`black`. Exposed `--c-*` as Tailwind utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`) via `@theme inline`. **All lines +
  faint surfaces (TOC border, dropdowns, header/footer, code blocks, hovers, preview banner) use
  `--c-rule`**, so one colour in Admin → Giao diện drives them. Also fixes a dark-mode bug where
  code blocks stayed light (hardcoded `#f4f4f2` had no dark override).
- fix(editor): over-spaced bullet/numbered list items. TipTap wraps each item's content in a
  `<p>`, which inherited the 1.4em paragraph margin — items now sit tight + even (only genuine
  multi-paragraph items keep spacing). Shared `.prose` rule, so the editor matches the render.
- feat(editor): rounded out the toolbar to match standard markdown editors — **numbered list**,
  **task list** (GFM `- [ ]`, renders as checkboxes), **inline code**, **horizontal rule**, and
  **insert table** (the Table extension had no way to create one from the UI). Added the TipTap
  **Placeholder** extension so the empty-state hint actually shows (the old root `data-placeholder`
  rendered nothing). New deps: `@tiptap/extension-task-list`, `-task-item`, `-placeholder`.

- feat(admin): **Media domain (CDN)** field in Settings → SEO (`mediaBaseUrl`) — set a vanity
  host for public media URLs from the UI instead of an env var. Owner setting wins, falls back
  to `BLOB_PUBLIC_BASE`; pushed into the Blob layer via `setMediaBase()` on each settings read.
  New admin i18n keys `mediaDomain`/`mediaDomainHint` (all 6 locales). Data-layer reads
  (`posts`/`pages`/`media`) now prime `getSettings()` before `expandBlob`, so the field alone
  drives media URLs reliably (no cold-start ordering race) — the env var is no longer required
- fix(header): render the logo with a plain `<img>` instead of `next/image`. The optimizer
  only allows hosts whitelisted in `next.config` at build time, so a runtime-configurable media
  domain (Settings → Media domain / a Cloudflare Worker) made the optimized logo 404. A plain
  tag loads from whatever host the setting yields — no build coupling, no env, never breaks on a
  domain change. Logos are small + CDN-cached, so the lost optimization is negligible
- feat(seo): `/sitemaps.xml` 308-redirects to `/sitemap.xml` (alias for the plural form / old
  search-console submissions; no second sitemap to keep in sync)
- feat(media): optional vanity domain for public media URLs via `BLOB_PUBLIC_BASE` (e.g. a
  Cloudflare Worker on `files.<domain>` proxying the Blob store). `publicBase()` rewrites only
  rendered media URLs (`expandBlob` + `blobOrigin` preconnect); internal data reads stay on the
  store host (no proxy hop, `?ts` cache-bust intact). `collapseBlob` also strips the vanity host
- fix(content): restored 41 broken post images across 19 imported posts. A prior media wipe
  (removed small/resized versions) left these `media/...` refs 404ing. Re-fetched the ORIGINAL
  full-size files from the source WordPress site via the Rocket.net file API (the public domain
  is behind a Cloudflare challenge that blocks direct fetch), stripping WP `-WxH` resize
  suffixes; uploaded to Blob, rewrote the markdown, rebuilt `media/_index.json`. New scripts:
  `check-image-links.mjs` (audit), `remap-original-images.mjs` (recover + remap)
- feat(seo): SEO tab — JSON-LD schema, `sitemap.xml`, `robots.txt`, `llms.txt`, RSS `feed.xml`, dynamic OG image (`/og`, edge runtime), canonical `siteUrl`; all toggleable
- feat(read): client-side `/search` (lean pre-folded index), table of contents (desktop, sticky), reading-progress bar, related posts, reading time
- feat(admin): `Tính năng` tab — toggle reader features (search/toc/related/readingTime/progressBar); `Link nháp` HMAC draft-preview links (`/preview/[slug]`)
- feat: `@vercel/analytics`; themed `(blog)/not-found.tsx`
- perf: every Blob read wrapped in `unstable_cache` (tags posts/pages/media/settings) → `/[slug]` is now real SSG; `staleTimes { dynamic: 0, static: 180 }`; logo via `next/image`; modern `browserslist` drops legacy-JS polyfills; editor serialization debounced
- fix: public reads degrade to fallback instead of 500; bump `getSettings` cache key (Data Cache persists across deploys)
- refactor(dry): consolidate 3 toggle components into `ui/Switch.tsx`; one `<hr>` divider standard (50% left); no all-caps; drop dead classes
- docs: add `ARCHITECTURE.md`; refresh README caching/usage
- perf: replace `resolveUrl` (`list()` API call) with direct `blobUrl()` — halves Blob read latency
- perf: `getPublicPosts`, `getSettings`, `getPublicPages` cached via `unstable_cache` — cross-request cache with tag-based invalidation
- perf: `getPost` / `getPage` wrapped with `React.cache()` — deduplicates generateMetadata + page render calls
- perf: `[slug]/page.tsx` — `generateStaticParams` + `dynamicParams = true` for ISR (falls back to dynamic due to `revalidate: 0` Blob fetches, but structure is correct)
- perf: all admin write routes call `revalidateTag` / `revalidatePath` after save/delete
- fix: `BLOB_READ_WRITE_TOKEN` regex corrected to `vercel_blob_rw_` (was `vercelblob_rw_`)
- feat: `next.config.ts` — added Vercel Blob image remote patterns
- docs: CLAUDE.md expanded with Blob access, caching model, ISR, data layer reference, scripts

## 2026-06-19
- init: project bootstrapped by Claude Code
- feat: env-driven OAuth providers (Google and/or GitHub)
- feat: Blob-backed posts + media data layer (no database)
- feat: NextAuth v5 GitHub auth with single-owner authorization
- feat: admin dashboard, TipTap markdown editor, media library
- feat: public blog (home, post detail, category, tag) in Vietnamese UI
