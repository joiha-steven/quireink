// In-page anchor ids the post ToC jumps to, set on the matching blocks in the
// post page. Kept in a plain (non-'use client') module so BOTH the Server
// Component page and the client `Toc` import the real values: importing a plain
// const from a 'use client' module into a Server Component yields a client
// reference proxy whose props read as `undefined`, which rendered `href="#undefined"`
// and `id="undefined"` and broke the jump.
// `comments` is the id the COMMENTS SECTION already carries (`article.ts` writes
// `<section id="comments">`, and `comment-auth.ts` bounces a returning commenter to
// `#comments`). It read `post-comments` here for as long as this constant has existed, so
// the contents list's last row pointed at an element that has never been on the page: on a
// post with no tags and no categories the row says "Comments" and, measured 2026-09-02,
// moved the page zero pixels. Reported as issue #63.
//
// `infoTags`/`infoCategories` are the SAME facts in the gutter panel. Above the rail
// breakpoint the end-of-article block is `display:none` and the panel is the only copy on
// screen, so the last row has to be able to land there instead; an id may exist once, so
// the two copies cannot share one name. `assets/js/toc.ts` decides which is live.
export const TOC_ANCHORS = {
  tags: 'post-tags',
  categories: 'post-categories',
  comments: 'comments',
  infoTags: 'post-info-tags',
  infoCategories: 'post-info-categories',
}
