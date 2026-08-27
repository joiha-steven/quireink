# 0034 — The import finishes the move

Date: 2026-08-27
Status: accepted

## Context

Every importer converted the words and left everything else where it was. The images kept
their URLs on the old host — the posts read perfectly right up until the old hosting
lapses, which is usually a month later, when nobody connects the two events. And nothing
answered for the old URL shapes: WordPress's `/2020/05/hello/` and Substack's `/p/hello`
land on a 404 the day the domain moves, which is precisely the day the search results and
every inbound link still point at them.

Both gaps were documented honestly — on the public comparison page, and as jobs 1 and 2 of
the move-in skill, done by hand or by an agent. A documented gap is still a gap: the pitch
says a blog moves in over one afternoon, and the two most dangerous steps of that afternoon
were homework.

## Decision

**Redirects at import time.** Each parser keeps the URL path a *published* item lived at
(`<link>` in WXR; `/p/<slug>` for Substack, whose custom-domain publications share paths
with nobody; nothing for Medium and Ghost, where the old path either cannot point here or
is already the new one). The persist loop writes a 301 into the same table the owner's
redirects live in — one row per item whose old path differs from its new slug, refused when
it would shadow live content, because the redirect middleware answers before the router.

**Images by batch, not at import time.** `import/images.ts` re-reads the content and asks
"what is still remote?" — no import-time state at all. The admin client (and the
`import_images` MCP tool) loop it: each call fetches up to five images through the SSRF
guard and the upload caps, stores them in the media library, rewrites every reference, and
reports what remains. Stateless-by-rescan means a crash loses nothing, a proxy timeout can
never end the story mid-import, and a blog imported *before* this existed is served exactly
as well as one imported today.

The importer parsers stay pure (no I/O) — the seam from the convert.ts split holds. The
fetch guards are the ones `add_media_from_url` shaped: outbound fetches are the one byte
path no reverse proxy can see.

## Consequences

- The pitch is now true as written: import, and the old links keep working while the
  pictures live at home. The move-in skill's jobs 1 and 2 shrink to "press the button and
  read the failure list".
- A failed fetch is reported, not retried forever: callers stop when a batch moves nothing.
  What failed stays remote and keeps working while the old host is up — the failure list is
  the owner's checklist before cancelling the old hosting.
- A rescan finds ANY remote image, not just imported ones. That is the point — but it means
  a deliberately hot-linked image is also brought home when the owner presses the button.
  Pressing it is the consent.
