# Site-level behaviour

## Homepage mode — [`docs/homepage.md`](../homepage.md)

What `/` serves: the post list, a chosen page, or the composed front page. Its own file, both
because it is long and because it is the one feature somebody installing Quire Ink reads before
they have a blog to configure. [ADR 0014](../decisions/0014-homepage-modes.md).
## The language a piece is written in — ADR 0056, `src/content/translations.ts`

- **Two columns, on posts and pages:** `lang` and `tr_group`. `lang` NULL means *nobody has
  said*, which is not the same fact as *the site's language* — only a piece that NAMES its
  language joins an hreflang pair, so a blog that has never touched this advertises nothing.
- **What it changes on the page:** `<html lang>` (hyphenation, quote marks, the CJK fallback
  face, and the voice a screen reader reads in), the `hreflang` set, the sitemap's alternates,
  and one line under the title with links to the other languages.
- **The switcher's label is in the PIECE's language**, and every link carries `lang` as well as
  `hreflang` — a screen reader in a Vietnamese document pronounces "English" as Vietnamese
  otherwise, which is the one way a switcher is worse than none. The rest of the chrome stays in
  `settings.language`; ADR 0056 says why that stops there.
- **In the editor** (Attributes → Language, Translation group): a select with *Same as the blog*
  first, and a text field offering the groups already in use. Under it, the group's current
  members — drafts included — so a typo in the name shows as an empty line rather than as
  nothing at all.
- **A LIST marks each title too** (`langAttr`, same file). An article page can put the piece's
  language on `<html>` and let everything inherit; a listing holds thirty pieces under one root
  and cannot. Without the attribute, `:lang()` matches that root, so a Korean headline on a
  Vietnamese blog is drawn in whichever Han face the system reaches for and read aloud in a
  Vietnamese voice. Six surfaces carry it: the feed cards, the magazine front's headline,
  standfirst and opening lines, the archive rows, the not-found page's three newest, and the
  series box inside an article.
  ⚠ On the piece's own words ONLY — the headline, the standfirst, the excerpt. The date, the
  category and the reading time beside them are the site speaking, and ADR 0056 turns down "the
  whole page follows the piece". A `lang` on the card would hand the date to the wrong language
  in order to win the title.
  ⚠ And nothing at all when the piece agrees with the site, which is every card on a
  monolingual blog: `lang` inherits, so repeating the root's own answer thirty times says
  nothing and buries the one card where it matters.
  ⚠ **A piece can only name one of the eleven languages the interface speaks** (`locales/langs.ts`).
  A guest post in Polish or Icelandic stores NULL and renders in the site's language, because
  `lang` is typed as `SiteLang`. The seed carries four such posts. Widening it to any BCP-47 tag
  is a decision ADR 0056 did not take.

## A scrolling box in an article can be reached without a mouse

- **`tabindex="0"` on `.table-scroll` and `.math-block`.** Both take their own horizontal
  scrollbar when what they hold is wider than the reading measure, and neither was a tab stop —
  so the columns past the right edge were reachable by dragging and by nothing else. Measured at
  a 320px viewport on the seeded blog: four of six tables overflow, and **seven of seven**
  display formulas. Shiki has always put the same attribute on `<pre>`, so the code block was
  the one already right; finding it is what said the other two were the group.
- **No `aria-label` with it**, which is the other half of the usual advice and is declined here.
  A name would have to be a word in the reader's language, and `renderPostContent` takes
  markdown and media facts — no settings, no locale — with `bodyKey` content-addressed over
  exactly those. Threading a language in would put the site's language into every cached body on
  the blog. The house answered this once already: the paper look's "Table 1." labels are drawn
  by CSS counters from a per-language stylesheet, not written into the body.

## URL redirects — `src/server/redirects.ts`, Admin → Settings → Server & connections

- **What:** owner-managed 301 (permanent) / 302 (temporary) redirects, plus an automatic
  301 whenever a post/page slug is renamed (so existing links + search results survive a
  move). Rows live in the `redirects` table (`source` unique, `destination`, `permanent`).
- **Served as a real HTTP 301/302 before any route runs** (`src/web/redirects.ts`, registered
  in `app.ts` as the last middleware before the routes). The lookup is skipped for `/admin`,
  `/api`, `/uploads/` and `/assets/`, and **fails open**: an unreadable table logs and lets the
  request through rather than taking the site down. `Location` is the destination **exactly as
  stored** — a path stays relative, an absolute URL stays absolute — and the query string is
  not carried over, because the destination is the whole of the new URL. ⚠ Do not "improve"
  this by resolving against the request: TLS terminates at the proxy, so the origin sees
  `http://` and every redirect would point there.
  ⚠ Between the port and 2026-08-02 the rows were stored and **nothing served them**, which
  made the auto-301 below silently untrue: every rename in that window lost its old URL.
  There is no in-process cache; the frozen tree's 60s one paid for an HTTP fetch to PostgREST,
  and here the lookup is an indexed read of a local file on the same thread.
- **Live content always wins, and three places enforce it.** Saving a post/page at slug X
  deletes any redirect whose `source` is `/X` (`clearRedirectForPath`), so a live URL is
  never shadowed by a stale redirect and a rename-back (A→B then B→A) cannot create a
  self-loop. **Restoring** one from the Trash does the same, because trashing a post and
  then pointing its path elsewhere is an ordinary thing to do and the row coming back has
  to win. And `saveRedirect` **refuses** a single-segment source that live content already
  holds (`live_content:`), rather than saving a row that would quietly make a post
  unreachable. A trashed slug is still redirectable: the restore is the other half.
- **Admin:** a Redirects card (list + add + delete) in Settings → Server & connections. `source` is normalized
  (leading slash, no query/trailing slash); `destination` is a path or an absolute http(s) URL;
  a self-redirect is rejected. CRUD via the owner-gated `/api/redirects` (+ `/:id`).
