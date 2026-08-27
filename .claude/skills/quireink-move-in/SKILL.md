---
name: quireink-move-in
description: Move an existing blog into Quire Ink from WordPress, Ghost, Substack or Medium — running the import (which writes the old URLs' redirects and brings the images home by itself), checking its failure list, and cleaning up what the converter could not know. Use when the user is migrating a blog, has an export file, or asks whether their old posts can come across.
---

# Moving a blog in

The importer's job is the deterministic half: HTML in, clean Markdown out, dead shortcodes
swept, unique slugs. Everything it cannot know is the job below, and most of a migration
going badly happens after the upload succeeds.

## Run the import

**Admin → Settings → System → Import.** Upload the export file; the server works out whose
it is.

| From | The file | What it is |
|---|---|---|
| WordPress | `.xml` | Tools → Export → All content (a WXR file) |
| Ghost | `.json` | Labs → Export content |
| Substack | `.zip` | The ZIP they email you (`posts.csv` + a `posts/` folder) |
| Medium | `.zip` | The ZIP they email you (`posts/*.html`) |

Substack and Medium go to the same place: nobody remembers which is which, so the server
tells them apart by structure rather than asking. **The cap is 100 MB per file** — an
export past it has to be split, and the answer is `file_too_large` (413), which is a limit
and not a crash. A wrong file is rejected with a specific reason
(`not_a_wordpress_export`, `not_a_ghost_export`, `not_a_zip`) before anything is parsed.

Posts and pages both come across, with their dates and their slugs. The count of skipped
items comes back with the result — read it out, do not swallow it.

## Then: check what the software did, and do the two jobs it left you

**1. The images (check the failure list).** The admin import fetches every image that
still points at another host into the media library and rewrites the posts, batch by
batch, right after the upload — the button shows the pace. Over MCP the same work is the
`import_images` tool: call it in a loop until `remaining` is 0, and stop early when a
call reports `moved: 0`, because what is left only fails. **The failure list is the
owner's checklist**: each failed URL stays pointing at the old host and keeps working
only while the old hosting is up. Fetch the strays by hand with `add_media_from_url`,
or tell the owner plainly which images will die with the old server. Do not let them
cancel the old hosting before this list is empty or accepted.

**2. The old URLs (mostly written for you).** A published WordPress item's path
(`/2019/07/some-post/`) and a Substack post's `/p/some-post` become 301s at import time,
in the same table as the owner's own redirects — the response says how many. What that
cannot cover: Medium (its old URLs live on medium.com), a category/tag/feed URL shape,
and anything unpublished. Check **Settings → SEO → Redirects** against the export and
add what matters by hand.

**3. What the converter could not know.** Shortcodes with no meaning outside their old
plugin, embeds that were an iframe, footnotes that were a plugin's markup, galleries. The
sweep removes the dead ones; it cannot invent the intent. Read ten posts — the oldest, the
most popular, and any with tables, code or media — and fix by hand what is wrong. An agent
may polish imported posts further, through the same revisioned saves as everything else,
but **no AI is used inside the importer on purpose**: shortcodes and blank-line pileups
have exact fixes, and an exact fix should never be handed to a model.

**4. Everything that is not posts.** Subscribers, comments, tags-as-taxonomy, the theme,
and anything a plugin owned do not come across. Say this out loud early. A newsletter list
in particular has to be exported from the old platform and imported to the new one as its
own job, with the subscribers' consent intact.

## Order of operations for a real migration

1. Install and claim the blog, but **do not point the domain at it yet**.
2. Import the export. Read the skipped count, the redirect count, and the image
   failure list — the import writes the 301s and fetches the images itself.
3. Fetch any failed images by hand, then check a sample of posts with the old site's
   DNS unresolved (or images blocked) so a still-live old host cannot fool you.
4. Fill in the redirects the import could not know (see job 2).
5. Read ten posts properly. Fix what the converter mangled.
6. Set `SITE_URL`, take a snapshot, move the domain.
7. Only then let the old hosting lapse.

## Do not

- Do not import twice "to be safe". Slugs are made unique on save, so a second run gives
  every post a duplicate under `-2`, and cleaning that up is worse than the import was.
- Do not promise comments or subscribers will come with them.
- Do not turn off the old blog on the same day. Its images are still doing work.
