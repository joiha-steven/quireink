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

import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
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

// A single figure/img subtree, narrowed from turndown's DOM node (no `any`).
type FigureEl = {
  getAttribute(name: string): string | null
  querySelector(sel: string): { getAttribute(name: string): string | null; textContent: string | null } | null
}

/** Tag every markdown image in a converted subtree as a gallery item. */
function markGridItems(md: string): string {
  return md.replace(/(!\[[^\]]*\]\([^)\s]+?)\)/g, '$1#grid)')
}

export function makeTurndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  td.use(gfm)
  // WordPress/Ghost/Medium all wrap captioned images in <figure><img><figcaption>.
  // Quire Ink renders a figure caption from the image alt, so fold the caption INTO the
  // alt rather than leaving a separate italic paragraph under the image.
  td.addRule('figureCaption', {
    filter: 'figure',
    replacement: (content, node) => {
      const el = node as unknown as FigureEl
      // A WordPress gallery is a <figure> wrapping one nested <figure><img> per photo.
      // Turndown has already converted those children, so `content` holds all of them —
      // whereas the single-image path below reads querySelector('img'), which is the
      // FIRST one, and silently dropped the rest of the gallery. One page here lost 139
      // of its 169 photographs that way. Tag each image `#grid` instead, which is how
      // Quire Ink regroups a run of images back into a grid.
      if ((el.getAttribute('class') ?? '').includes('wp-block-gallery')) {
        return `\n\n${markGridItems(content).trim()}\n\n`
      }
      const img = el.querySelector('img')
      const src = img?.getAttribute('src') ?? ''
      if (!src) return content
      const cap = el.querySelector('figcaption')?.textContent ?? img?.getAttribute('alt') ?? ''
      const alt = cap.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
      return `\n\n![${alt}](${src})\n\n`
    },
  })
  return td
}

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

/** The whole pipe: platform HTML in, publishable Markdown out. */
export function htmlToMarkdown(td: TurndownService, html: string): string {
  return html ? cleanImportMarkdown(td.turndown(cleanImportHtml(html))) : ''
}

// ---- small shared tools ---------------------------------------------------------------

/** Collision-suffixing slug allocator, one per import run. */
export function slugTracker(): (base: string) => string {
  const used = new Set<string>()
  return (base: string): string => {
    let slug = base || 'untitled'
    let n = 2
    while (used.has(slug)) slug = `${base}-${n++}`
    used.add(slug)
    return slug
  }
}

// Decode HTML entities platforms leave in plain-text fields (titles/excerpts),
// including double-encoded ones (&amp;amp; → &). Two passes.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
}
export function decodeEntities(s: string): string {
  let out = s
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
  }
  return out
}

export { deriveExcerpt }
