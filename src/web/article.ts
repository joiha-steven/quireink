// The article page: a post or a static page at /{slug}.
//
// Split out of the router so the router stays a routing table. Returns null when the slug
// is not publicly readable, and the caller turns that into a 404 — a renderer that decides
// status codes is a renderer that eventually returns a 200 with an apology on it.

import type { Post } from '@/types'
import { getPost, getPublicPosts, getRelatedPosts } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getMediaRefs } from '@/media/media-refs'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getMailStatus } from '@/news/mail'
import { getCommentEnv } from '@/comments/comment-env'
import { issueStamp } from '@/comments/stamp'
import { chromeLabels, siteFooter, siteHeader, subscribeCard } from '@/web/chrome'
import { heroImage, byline, authorBox } from '@/web/article-blocks'
import { getSeriesForPost } from '@/content/series'
import { collapseBlob } from '@/media/blob'
import { renderPostContent } from '@/render/post-content'
import type { ImageDims, ReadyOriginals } from '@/render/figures'
import { extractHeadings } from '@/utils'
import { TOC_ANCHORS } from '@/render/toc'
import { termSlug } from '@/content/taxonomy'
import { formatCount, formatDate, t } from '@/i18n/i18n'
import { PUBLIC_SHEET, scriptTag } from '@/web/assets'
import { ogImageUrl } from '@/render/og'
import { isPublicallyVisible, clampExcerpt, readingMinutes, toPlainText, wordCount } from '@/utils'
import { renderDocument, pageStyles } from '@/web/layout'
import { blogPostingSchema } from '@/render/schema'
import { postInfoPanel, termLinks } from '@/web/post-info'

import { escapeAttr, escapeHtml } from '@/utils'

/** What a search engine will actually print, and the whole reason this number exists.
 *  It was 200 under a comment that said "a search engine truncates there" — and eleven lines
 *  further down, a second comment said the wall is "~160". Both could not be right, and the
 *  one at 200 was the one the constant followed, so five of ten pages shipped a description
 *  whose tail was written and never read (measured 2026-08-25). 160 is where Google stops;
 *  `clampExcerpt` cuts at the last whole word before this and then ADDS a three-character
 *  ellipsis, so the bound is 157 and not 160: at 160 the printed string measured 161-162,
 *  which is over the wall by exactly the punctuation that says it was cut. */
const META_DESC_MAX = 157

/** How much of a post the share card carries: six lines at the card's body size. A card is
 *  read whole, so it is not bound by where a search result stops. */
const OG_DESC_MAX = 320

/**
 * Media facts the renderer needs: which originals have responsive variants, and the
 * intrinsic size of each. Read once per render rather than per image.
 */
async function mediaFacts(): Promise<{ ready: ReadyOriginals; dims: ImageDims }> {
  const ready: ReadyOriginals = new Map()
  const dims: ImageDims = new Map()
  for (const r of await getMediaRefs()) {
    const key = collapseBlob(r.url)
    // The NUMBER, not a boolean: it says which widths exist on disk, and the renderer may
    // only name those. See `ReadyOriginals` — a <picture> naming a missing file fails.
    if (r.variants) ready.set(key, r.variants)
    if (r.width && r.height) dims.set(key, { width: r.width, height: r.height })
  }
  return { ready, dims }
}

export async function renderArticle(slug: string): Promise<string | null> {
  const settings = await getSettings()
  const s = t(settings.language)
  const post = await getPost(slug)
  const page = post ? null : await getPage(slug)

  // Posts and pages share one /{slug} namespace (Invariant 2), so at most one matches.
  // A draft or a future-dated post is not public: same rule as the frozen tree, and the
  // reason `/preview/{slug}` exists separately.
  if (post && !isPublicallyVisible(post.status, post.date)) return null
  if (page && page.status !== 'published') return null
  const item = post ?? page
  if (!item) return null

  const { ready, dims } = await mediaFacts()
  const body = await renderPostContent({
    markdown: item.content, readyOriginals: ready, imageDims: dims,
  })

  let header = `<header><h1 class="reading-font fs-h1 font-semibold">${escapeHtml(item.title)}</h1></header>`
  // The post's own picture, above the body. '' unless the owner turned a hero on AND this
  // post has an image — a page never has one, which is why it is set inside the post branch.
  let hero = ''
  let footer = ''
  /** The series card, which sits ABOVE the body rather than in the footer with the rest. */
  let lead = ''
  if (post) {
    const { features } = settings
    // The meta line sits ABOVE the title, matching the list cards, and it is chrome: the
    // date, the length of the read, and the way into book mode. It read "14 min" with the
    // word count missing entirely — the suffixes are in the locale table for a reason.
    const category = features.categoryLabel ? post.categories[0] : undefined
    // The figures are wrapped and the units are not: the IDE chrome sets a literal apart
    // from the words around it, and it cannot do that to a bare text node.
    const length = features.readingTime
      ? ` · <span class="num">${formatCount(wordCount(post.content), settings.language)}</span>`
        + ` ${escapeHtml(s.wordsSuffix)}`
        + ` · <span class="num">${readingMinutes(post.content)}</span> ${escapeHtml(s.readingSuffix)}`
      : ''
    // Desktop and tablet only, hidden by CSS on a narrow screen: two columns of type in
    // a phone-width viewport is worse than one, not better.
    // The separator is INSIDE the span, so it goes when the button does. It was a bare text
    // node, which left every phone-width article ending its meta line on a stray middot.
    const book = features.bookMode
      ? `<span class="meta-book"> · <button type="button" class="book-mode-toggle" data-book-open>${
        escapeHtml(s.bookMode)}</button></span>`
      : ''
    // `post-meta` is the handle the wide layout hides it by: above the rail breakpoint the
    // same facts are in the right gutter, one per line, and two copies would be two copies.
    header = `<header>
<p class="t-small text-meta post-meta">${category
      ? `<a class="link-accent" href="/category/${escapeAttr(termSlug(category))}">${escapeHtml(category)}</a> · `
      : ''}<time datetime="${escapeAttr(post.date)}">${
      escapeHtml(formatDate(post.date, settings.language, settings.timezone))}</time>${length}${
      // Who wrote it, when the owner has said. '' on every blog that has not.
      byline(settings, s.bylinePrefix)}${book}</p>
<h1 class="reading-font mt-2 fs-h1 font-semibold">${escapeHtml(item.title)}</h1>${
      // Standfirst: the excerpt, so a long read opens on a sentence rather than a wall.
      features.deck && post.excerpt ? `
<p class="deck">${escapeHtml(post.excerpt)}</p>` : ''}
</header>`

    // The series card. Three things the port dropped, each of which the data and the locale
    // strings were already carrying: the name LINKS to the series page (nothing on the site
    // linked there, so `/series/<slug>` existed and was unreachable), the header says which
    // part of how many, and it sits at the top of the post rather than after it.
    const series = await getSeriesForPost(post.slug)
    const seriesBox = series && series.posts.length > 1
      ? `<aside class="series"><p class="series-head"><a class="link-accent" href="/series/${
          escapeAttr(series.slug)}">${escapeHtml(series.name)}</a> · ${escapeHtml(s.seriesPartPrefix)} ${
          series.currentIndex + 1}/${series.posts.length}</p><ol>${
          series.posts.map((p) => (p.slug === post.slug
            ? `<li aria-current="page">${escapeHtml(p.title)}</li>`
            : `<li><a href="/${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a></li>`)).join('')
        }</ol></aside>`
      : ''
    // Tags and categories, each on its own labelled line, over a rule. The rule is the
    // article ending; without it the taxonomy reads as one more paragraph.
    // The run of terms is wrapped so the IDE chrome can bracket it into an array literal.
    const list = (html: string) => `<span class="term-list">${html}</span>`
    const taxo = [
      post.tags.length
        ? `<p>${escapeHtml(s.tagLabel)}: ${list(termLinks(post.tags, 'tag', true))}</p>` : '',
      post.categories.length
        ? `<p>${escapeHtml(s.categoryLabel)}: ${
          list(termLinks(post.categories, 'category'))}</p>` : '',
    ].filter(Boolean).join('')
    // The anchors are their own empty elements rather than ids on the paragraphs, because
    // above the rail breakpoint those paragraphs are `display:none` — and an anchor with no
    // box cannot be scrolled to, so the contents list's last row would have died silently on
    // every desktop. These two always have a box, and they mark the end of the article
    // whichever copy of the taxonomy the reader is actually being shown.
    const anchors = `<span class="anchor" id="${TOC_ANCHORS.tags}"></span>`
      + `<span class="anchor" id="${TOC_ANCHORS.categories}"></span>`
    const taxoBlock = taxo
      ? `${anchors}<hr class="taxo-rule"><footer class="post-taxo t-small text-meta">${taxo}</footer>`
      : ''

    // One pointer forward, right where the reader finishes (approved 2026-08-27). The
    // next part of the series when there is one, else the ADJACENT post — the older
    // neighbour first, because the index is newest-first and a reader who just finished
    // this post is walking back through the archive; only the oldest post points forward.
    let readNextBlock = ''
    if (features.readNext) {
      let target: Post | null = null
      let readLabel = s.readNext
      if (series && series.currentIndex >= 0 && series.currentIndex < series.posts.length - 1) {
        target = series.posts[series.currentIndex + 1] ?? null
        readLabel = s.readNextSeries
      } else {
        const all = await getPublicPosts()
        const at = all.findIndex((p) => p.slug === post.slug)
        target = at >= 0 ? all[at + 1] ?? all[at - 1] ?? null : null
      }
      if (target) {
        readNextBlock = `<hr><section class="read-next"><p class="read-next-label">${
          escapeHtml(readLabel)}</p><p class="read-next-title reading-font"><a class="link-accent" href="/${
          escapeAttr(target.slug)}">${escapeHtml(target.title)}</a></p></section>`
      }
    }

    const related = features.related ? await getRelatedPosts(post.slug, settings.relatedCount) : []
    const relatedBlock = related.length
      ? `<hr><section class="related"><h2>${escapeHtml(s.relatedTitle)}</h2><ul>${
          related.map((r) => `<li><a class="link-accent" href="/${escapeAttr(r.slug)}">${escapeHtml(r.title)}</a>`
            + `<p class="t-small text-meta">${escapeHtml(formatDate(r.date, settings.language, settings.timezone))}</p></li>`).join('')
        }</ul></section>`
      : ''
    // The right gutter, above the rail breakpoint only. It carries the same facts as the
    // meta line and the taxonomy, so both of those are hidden at that width.
    // `ready` goes through WHOLE: it maps an original to its variant-set version, and the
    // version is what decides whether the 512 width may be named.
    // `dims` keyed store-relative, same as `ready` (Invariant 3). Both come from the one
    // table read `mediaFacts` already did.
    hero = heroImage(post, settings, ready,
      dims.get(collapseBlob(post.featuredImage || post.coverImage || '')))
    lead = postInfoPanel(post, settings, s) + seriesBox
    // Tags first (they belong to the post), then the person, then the ways onward. '' unless
    // the owner has filled in both a name and a bio.
    footer = taxoBlock + authorBox(settings) + readNextBlock + relatedBlock
  }

  // The table of contents is server-rendered markup, so a reader without JavaScript still
  // gets a working index of the article. The bundle only adds the active-section highlight.
  // Only on posts, only when the owner has it on, and only when there is more than one
  // heading — a contents list with one entry is furniture, not navigation.
  const headings = post && settings.features.toc ? extractHeadings(post.content) : []
  // It OPENS with the post's title (a click is "back to the top") and CLOSES with one jump
  // to whatever end-of-article sections exist, so every post has a usable index even with
  // no headings at all. Rendering only the headings made a post with none lose its rail
  // entirely, and a post with two show a bare pair of links with nowhere to return to.
  const endLabel = post
    ? [post.tags.length ? s.tagLabel : '', post.categories.length ? s.categoryLabel : '',
      settings.comments.enabled ? s.commentsHeading : ''].filter(Boolean).join(' / ')
    : ''
  const endAnchor = post && post.tags.length ? TOC_ANCHORS.tags
    : post && post.categories.length ? TOC_ANCHORS.categories
      : TOC_ANCHORS.comments
  // Nest visually ONLY when the post MIXES levels: an H2 row takes a dot marker and an H3
  // row goes smaller. A post that is all one level stays uniform.
  const mixed = headings.some((h) => h.level === 2) && headings.some((h) => h.level === 3)
  const row = (href: string, text: string, extra = '') =>
    `<li><a class="rail-row link-accent t-small${extra}" href="${escapeAttr(href)}">${escapeHtml(text)}</a></li>`
  const toc = post && settings.features.toc && (headings.length > 0 || endLabel)
    ? `<nav class="toc rail" aria-label="${escapeAttr(s.tocIndex)}">
<div class="rail-inner">
<h2>${escapeHtml(s.tocIndex)}</h2>
<ul>${row('#top', post.title, ' is-active')}${
      headings.map((h) => row(`#${h.id}`, h.text,
        mixed ? (h.level === 3 ? ' rail-sub' : ' rail-lead') : '')).join('')
    }${endLabel ? row(`#${endAnchor}`, endLabel, ' toc-end') : ''}</ul>
</div>
</nav>`
    : ''

  // The comment thread is a MOUNT POINT, not markup: the island fetches it. The article
  // page is cached HTML (Invariant 1) and a comment is not a post, so rendering the thread
  // here would force a choice between flushing the whole page cache whenever a stranger
  // types something and serving a stale thread. Fetching avoids both.
  // The site key rides on the mount point, so the island can put up the widget without a
  // second round trip. It is a PUBLIC key by design; the secret half never leaves here.
  const commentEnv = post && settings.comments.enabled ? await getCommentEnv() : null
  const usingTurnstile = settings.comments.turnstile && commentEnv?.turnstileConfigured === true
  const turnstile = usingTurnstile
    ? ` data-turnstile="${escapeAttr(commentEnv.turnstileSiteKey)}"`
    : ''
  // No Turnstile means the blog's own gate (ADR 0032): a signed challenge, minted here so
  // the island needs no round trip. It is per-render and therefore per-cached-page, which
  // is why the island can ask for a fresh one when a long-cached page hands back a stale
  // stamp — the page stays cacheable and nothing is stored server-side.
  const stamp = commentEnv && !usingTurnstile
    ? ` data-stamp="${escapeAttr(JSON.stringify(issueStamp()))}"`
    : ''
  // A flag, not a key: the island only needs to know whether to draw the Google button and
  // ask who the reader is. The client id lives on the server and travels in the redirect.
  const googleAuth = settings.comments.googleAuth && commentEnv?.googleConfigured
    ? ' data-google="1"'
    : ''
  const commentsMount = post && settings.comments.enabled
    ? `<section id="comments" data-post="${escapeAttr(post.slug)}"${turnstile}${stamp}${googleAuth}></section>`
    : ''

  const { configured: mailConfigured } = await getMailStatus()

  // Clamped again on the way OUT, and this is the narrower need `EXCERPT_MAX_CHARS` talks
  // about: an excerpt is stored at up to 280 so the front page's lead standfirst has
  // something to print, and a search engine truncates a description past ~160 regardless.
  // That sentence was true while the constant above said 200. They agree now.
  // Same shape as `OG_DESC_MAX` below — each surface states its own bound, and none of them
  // reaches back to shorten what everybody else gets.
  const description = clampExcerpt(
    post?.metaDescription || post?.excerpt || toPlainText(item.content).slice(0, 300),
    META_DESC_MAX,
  )

  // The reading-progress bar is markup plus a scroll-driven CSS animation, with no script
  // behind it: it therefore works with JavaScript switched off, and costs nothing on the
  // main thread. `@supports` in the sheet hides it on an engine without scroll timelines,
  // so the failure mode is absence rather than a bar stuck at zero.
  const progress = settings.features.progressBar
    ? '<div class="progress" aria-hidden="true"><div class="progress-fill"></div></div>'
    : ''

  // The one bundle a reader loads, and the strings it will show them. Each island inside
  // it checks for its own markup first, so a post with no code blocks and no images runs
  // a few cheap queries that find nothing rather than downloading a file each.
  const shell = {
    bodyData: {
      ...chromeLabels(settings),
      copyCode: s.copyCode,
      copiedCode: s.copiedCode,
      backToTop: s.backToTop,
      quoteCopy: s.quoteCopy,
      quoteCopied: s.quoteCopied,
      lightboxPrev: s.lightboxPrev,
      lightboxNext: s.lightboxNext,
      lightboxClose: s.lightboxClose,
      commentsHeading: s.commentsHeading,
      commentsEmpty: s.commentsEmpty,
      commentReply: s.commentReply,
      commentDeleted: s.commentDeleted,
      commentName: s.commentName,
      commentEmail: s.commentEmail,
      commentEmailNote: s.commentEmailNote,
      commentWebsite: s.commentWebsite,
      commentBody: s.commentBody,
      commentSubmit: s.commentSubmit,
      commentError: s.commentError,
      commentChecking: s.commentChecking,
      commentSignInGoogle: s.commentSignInGoogle,
      commentAs: s.commentAs,
      commentSignOut: s.commentSignOut,
      commentSignInError: s.commentSignInError,
      bookMode: s.bookMode,
      bookModePrev: s.bookModePrev,
      bookModeNext: s.bookModeNext,
      bookModeClose: s.bookModeClose,
      bookModeSmaller: s.bookModeSmaller,
      bookModeLarger: s.bookModeLarger,
      ...(post && settings.features.resume ? { resumePrompt: s.resumePrompt } : {}),
    },
    scripts: scriptTag('core') + scriptTag('post'),
  }

  const site = resolveSiteUrl(settings)
  return renderDocument(
    settings,
    {
      title: `${post?.metaTitle || item.title} · ${settings.title}`,
      description,
      canonical: site ? `${site}/${item.slug}` : undefined,
      // Absolute, always: `resolveSiteUrl` falls back to SITE_URL and then to localhost,
      // and a relative og:image is ignored by every scraper.
      image: ogImageUrl(settings, site, {
        title: post?.metaTitle || item.title,
        featuredImage: post?.featuredImage,
        // The CARD's description, which is not the search snippet and should not be capped
        // like one. `description` above is bounded by META_DESC_MAX (157) because a
        // meta description longer than that is truncated by the engine anyway; the card has
        // six lines of its own to fill, and a share preview that stops mid-thought after two
        // of them is the reason it looked thin. An AUTHORED meta description still wins --
        // those are words somebody chose -- and only the derived case runs longer.
        desc: post ? clampExcerpt(post.metaDescription || toPlainText(item.content), OG_DESC_MAX) : undefined,
        date: post ? formatDate(post.date, settings.language, settings.timezone) : undefined,
      }),
      ogType: post ? 'article' : 'website',
      // Only a POST, and only when the owner has the setting on. A page (About, Colophon)
      // gets none: a `WebPage` object restating the title and the canonical tells a crawler
      // nothing the tags beside it did not already say.
      jsonLd: post && settings.seo.autoSchema
        ? blogPostingSchema(post, settings, site, {
            description,
            // The same card the OG tags point at, so the two never disagree about what the
            // picture for this post is.
            image: ogImageUrl(settings, site, {
              title: post.metaTitle || item.title,
              featuredImage: post.featuredImage,
            }),
          }) ?? undefined
        : undefined,
      stylesheet: PUBLIC_SHEET,
    },
    pageStyles(settings),
    // `book-text` is the owner's book-typography switch: indented paragraphs, a tighter
    // lead between them, justified with hyphens once the column is wide enough. It sits on
    // the shell rather than on .prose so the editor and the reading view can share it.
    `${progress}<div class="wrap${settings.features.bookText ? ' book-text' : ''}">
${siteHeader(settings, { mailConfigured })}
<div class="with-rail"><main id="content">
<article>
${hero}
${header}
${lead}
${toc}
<div id="post-body" class="prose">${body}</div>
${footer}
</article>
${post && mailConfigured ? subscribeCard(settings) : ''}
${commentsMount}
</main></div>
${siteFooter(settings, { mailConfigured })}
</div>`,
    shell,
  )
}
