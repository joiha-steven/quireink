// The shared half of every importer: HTML in, clean Markdown out, plus the small tools
// each platform parser needs (entity decoding, unique slugs, excerpts).
//
// Split out of `wordpress.ts` on 2026-08-23, when Ghost, Substack and Medium arrived.
// The seam is by JOB: a platform module knows where that platform keeps its fields and
// nothing about Markdown; this file knows Markdown and nothing about any platform.
//
// The deterministic cleanup lives here ON PURPOSE, and there is no AI in it: shortcodes,
// non-breaking spaces and blank-line pileups have exact fixes, and an exact fix should
// never be outsourced to a model. (An agent CAN be asked to polish imported posts further
// — that is a cookbook recipe, working through the same revisioned saves as everything.)

import { toMarkdown } from '@/md/to-markdown'
import { parseHtml } from './html-parse'
import { fromHtml } from './html-to-md'
import { deriveExcerpt } from '@/utils'

export type ImportedPost = {
  title: string
  slug: string
  date: string
  status: 'draft' | 'published'
  categories: string[]
  tags: string[]
  excerpt: string
  content: string
  /** URL path this item lived at on the platform it left — the persister 301s it to the new slug. */
  path?: string
}
export type ImportedPage = { title: string; slug: string; status: 'draft' | 'published'; content: string; path?: string }
export type ImportResult = { posts: ImportedPost[]; pages: ImportedPage[]; skipped: number }

// ---- deterministic cleanup ----------------------------------------------------------

// Shortcodes WordPress-family sites leave as literal text once the plugin that read
// them is gone. Conservative on purpose: [caption] unwraps to its inner content (the
// image is the payload), [embed]url[/embed] unwraps to the URL (the reader renders
// known embeds from a bare link), and only KNOWN no-content codes are dropped outright.
// An unknown [thing] stays: it might be the author writing about shortcodes.
const DROP_SHORTCODES = /\[\/?(?:gallery|playlist|audio|video|contact-form(?:-7)?|su_[a-z_]+|vc_[a-z_]+|et_pb_[a-z_]+)\b[^\]]*\]/gi

export function cleanImportHtml(html: string): string {
  return html
    .replace(/\[caption\b[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1')
    .replace(/\[embed\b[^\]]*\]([\s\S]*?)\[\/embed\]/gi, '$1')
    .replace(DROP_SHORTCODES, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\ufeff]/g, '')
}

export function cleanImportMarkdown(md: string): string {
  return md
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * The whole pipe: platform HTML in, publishable Markdown out.
 *
 * Through this product's OWN syntax tree rather than a second Markdown writer. `turndown` had
 * opinions about how a table, a nested list and an escaped bracket are spelled, and this repo
 * already has one set of those in `md/to-markdown.ts`; two sets is how the editor and the
 * importer come to disagree about a document neither of them changed.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  const children = fromHtml(parseHtml(cleanImportHtml(html)))
  return cleanImportMarkdown(toMarkdown({ type: 'document', children }))
}

// ---- small shared tools ---------------------------------------------------------------

/** Collision-suffixing slug allocator, one per import run. */
export function slugTracker(): (base: string) => string {
  const used = new Set<string>()
  return (base: string): string => {
    // ⚠️ THE SUFFIX HANGS OFF THE STEM, NOT OFF WHAT CAME IN. `slugify` returns '' for a title
    // written in an alphabet it does not fold — Japanese, Arabic, Thai, an emoji, punctuation
    // alone — so a run with two such posts named the first `untitled` and the second `-2`,
    // because the loop rebuilt the name out of the empty string it was handed rather than out
    // of the name it had just chosen. Every post after that: `-3`, `-4`.
    const stem = base || 'untitled'
    let slug = stem
    let n = 2
    while (used.has(slug)) slug = `${stem}-${n++}`
    used.add(slug)
    return slug
  }
}

// Decode HTML entities platforms leave in plain-text fields (titles/excerpts),
// including double-encoded ones (&amp;amp; → &). Two passes.

export { deriveExcerpt }
export { decodeEntities } from './entities'
