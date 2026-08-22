// Pure builders for every email the blog sends (confirm a sign-up; broadcast one or
// more posts; notify a comment reply). Kept separate from the send path so they're
// unit-testable and shared between the real send and the admin preview/test send. All
// interpolated values are escaped; the reply's `contentHtml` is the already-sanitized
// comment markdown (bold/italic only, escaped at source).
//
// DESIGN — the email is meant to read like the blog, not like a form letter:
//  - Colours come from the owner's OWN palette (`ThemeColors`, light mode), so the mail
//    matches whatever theme the site wears. Nothing is hardcoded but pure black/white.
//  - Table layout + inline styles on every element. Mail clients strip <style> blocks,
//    collapse margins and ignore flex/grid; a 600px centred table is the one thing that
//    renders the same in Gmail, Outlook and Apple Mail.
//  - Light only (`color-scheme: light`). A dark variant needs a <style> media query,
//    which the clients that most need it are the likeliest to strip — a half-applied
//    dark theme reads worse than a clean light one.
//  - No web font: a mail client will not load one, so it falls back mid-render. The
//    stack leads with the system UI face, which is what Inter is standing in for anyway.
//  - The masthead is the owner's real LOGO when there is a mail-safe one (see
//    `lib/email-brand.ts`), falling back to the site name as text. Images are blocked by
//    default in a lot of inboxes, so the logo's `alt` is the site title: with images off
//    the masthead still reads correctly instead of collapsing to nothing.

import type { Dict } from '@/locales/types'
import type { ThemeColors } from '@/types'
import { escapeHtml } from '@/utils'

// `dateLabel` is preformatted by the caller (which knows the site language), so these
// builders stay pure string functions with no locale plumbing.
// Resolved by `lib/email-brand.ts` — an ABSOLUTE url plus the display box, because an
// inbox has no origin to resolve a relative path against and no CSS to size the image.
export type EmailLogo = { url: string; width: number; height?: number }

// Everything a message needs to look like the site. Bundled rather than passed as four
// more positional arguments to each builder.
export type EmailBrand = {
  title: string
  base: string
  theme: ThemeColors
  logo?: EmailLogo | null
}

export type EmailPost = {
  slug: string
  title: string
  excerpt?: string | null
  coverImage?: string | null
  dateLabel?: string
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif"
const WIDTH = 600

// Absolute URL for an image ref that may be stored store-relative ("/uploads/…").
const absolute = (base: string, url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`)

// The masthead: the logo when there is one, else the site name set small and quiet.
// Either way it links home and reads as the site title when images are blocked.
function masthead(brand: EmailBrand): string {
  const { theme: c, title, base, logo } = brand
  const inner = logo
    ? `<img src="${escapeHtml(logo.url)}" width="${logo.width}"${logo.height ? ` height="${logo.height}"` : ''} alt="${escapeHtml(title)}" style="display:block;border:0;width:${logo.width}px;max-width:100%;height:auto;">`
    : `<span style="font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:0.02em;color:${c.meta};">${escapeHtml(title)}</span>`
  return `<a href="${escapeHtml(base)}" style="color:${c.meta};text-decoration:none;">${inner}</a>`
}

// The page shell: background, centred column, masthead, content, footer rule.
function shell(brand: EmailBrand, content: string, footer: string, preheader = ''): string {
  const c = brand.theme
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `</head>` +
    `<body style="margin:0;padding:0;background-color:${c.bg};">` +
    // Inbox preview line — shown in the list, never on the page.
    (preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.bg};">` +
    `<tr><td align="center" style="padding:40px 20px;">` +
    `<table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${WIDTH}px;text-align:left;">` +
    // Masthead: logo or site name — quiet either way; the post title is the headline.
    `<tr><td style="padding-bottom:22px;line-height:1;">${masthead(brand)}</td></tr>` +
    `<tr><td style="border-top:1px solid ${c.rule};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    // The gap belongs ABOVE the closing rule: `padding-top` on the bordered cell would
    // draw the border first and push the space below it, so the rule ends up glued to
    // the button. A zero-height spacer row keeps them apart.
    `<tr><td style="padding:30px 0 36px;">${content}</td></tr>` +
    `<tr><td style="border-top:1px solid ${c.rule};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="font-family:${FONT};font-size:12px;line-height:1.7;color:${c.meta};padding-top:18px;">${footer}</td></tr>` +
    `</table></td></tr></table></body></html>`
  )
}

// Solid call-to-action. A table, not a padded <a>: Outlook drops padding on inline
// elements, so the button would collapse to bare text.
function button(c: ThemeColors, href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="background-color:${c.heading};border-radius:6px;">` +
    `<a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${c.bg};text-decoration:none;">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  )
}

const para = (c: ThemeColors, text: string, size = 16) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.65;color:${c.text};">${text}</p>`

// Why-am-I-getting-this + the opt-out. Both are what a legitimate newsletter carries,
// and spam filters look for the pair.
const broadcastFooter = (c: ThemeColors, tx: Dict, siteTitle: string, base: string, token: string) =>
  `${escapeHtml(tx.nlFooterWhy.replace('{site}', siteTitle))}<br>` +
  `<a href="${escapeHtml(`${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)}" style="color:${c.meta};text-decoration:underline;">${escapeHtml(tx.nlUnsubFooter)}</a>`

// One post inside a broadcast. `lead` = the single-post (or first-of-digest) treatment:
// cover image + larger title + button. The rest are a compact list.
function postBlock(c: ThemeColors, tx: Dict, base: string, post: EmailPost, lead: boolean): string {
  const url = `${base}/${post.slug}`
  const cover =
    lead && post.coverImage
      ? `<a href="${escapeHtml(url)}"><img src="${escapeHtml(absolute(base, post.coverImage))}" width="${WIDTH}" alt="" style="display:block;width:100%;max-width:${WIDTH}px;height:auto;border:0;border-radius:8px;margin-bottom:22px;"></a>`
      : ''
  const size = lead ? 26 : 19
  const title =
    `<h1 style="margin:0 0 ${lead ? 10 : 6}px;font-family:${FONT};font-size:${size}px;line-height:1.3;letter-spacing:-0.015em;font-weight:700;color:${c.heading};">` +
    `<a href="${escapeHtml(url)}" style="color:${c.heading};text-decoration:none;">${escapeHtml(post.title)}</a></h1>`
  const date = post.dateLabel
    ? `<p style="margin:0 0 ${lead ? 14 : 10}px;font-family:${FONT};font-size:13px;line-height:1.5;color:${c.meta};">${escapeHtml(post.dateLabel)}</p>`
    : ''
  const excerpt = post.excerpt ? para(c, escapeHtml(post.excerpt), lead ? 16 : 15) : ''
  const cta = lead
    ? button(c, url, tx.bcastRead)
    : `<a href="${escapeHtml(url)}" style="font-family:${FONT};font-size:14px;font-weight:600;color:${c.link};text-decoration:none;">${escapeHtml(tx.bcastRead)} &rarr;</a>`
  return `${cover}${title}${date}${excerpt}${cta}`
}

// Broadcast: ONE post (full treatment) or several (a digest — the newest leads, the
// rest follow as a list). `openToken` appends the 1x1 open-tracking pixel; omitted for
// the preview and the test send, so neither pollutes the open rate.
export function broadcastEmail(
  tx: Dict,
  brand: EmailBrand,
  posts: EmailPost[],
  unsubToken: string,
  openToken?: string,
): { subject: string; html: string } {
  const { title: siteTitle, base, theme } = brand
  const [lead, ...rest] = posts
  const blocks = [postBlock(theme, tx, base, lead, true)]
  for (const p of rest) {
    blocks.push(
      `<div style="margin-top:32px;padding-top:30px;border-top:1px solid ${theme.rule};">${postBlock(theme, tx, base, p, false)}</div>`,
    )
  }
  const pixel = openToken
    ? `<img src="${escapeHtml(`${base}/api/newsletter/open?t=${encodeURIComponent(openToken)}`)}" width="1" height="1" alt="" style="display:block;border:0;">`
    : ''
  const subject = posts.length === 1 ? `${lead.title} — ${siteTitle}` : `${tx.bcastDigestSubject.replace('{n}', String(posts.length))} — ${siteTitle}`
  const html = shell(
    brand,
    blocks.join(''),
    `${broadcastFooter(theme, tx, siteTitle, base, unsubToken)}${pixel}`,
    lead.excerpt ?? lead.title,
  )
  return { subject, html }
}

// Double opt-in email: the link that flips a pending subscriber to confirmed.
export function confirmEmail(tx: Dict, brand: EmailBrand, confirmUrl: string): { subject: string; html: string } {
  const { title: siteTitle, theme } = brand
  const content =
    `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${theme.heading};">${escapeHtml(tx.nlConfirmSubject)}</h1>` +
    para(theme, tx.nlConfirmIntro.replace('{site}', escapeHtml(siteTitle))) +
    button(theme, confirmUrl, tx.nlConfirmButton)
  return {
    subject: `${tx.nlConfirmSubject} — ${siteTitle}`,
    html: shell(brand, content, escapeHtml(tx.nlConfirmIgnore), tx.nlConfirmButton),
  }
}

export function replyEmail(
  tx: Dict,
  brand: EmailBrand,
  postSlug: string,
  postTitle: string,
  replierName: string,
  contentHtml: string,
): { subject: string; html: string } {
  const { title: siteTitle, base, theme } = brand
  const url = `${base}/${postSlug}#comments`
  const intro = tx.replyIntro.replace('{name}', escapeHtml(replierName)).replace('{title}', escapeHtml(postTitle))
  const content =
    para(theme, intro) +
    `<blockquote style="margin:0 0 20px;padding:2px 0 2px 16px;border-left:3px solid ${theme.rule};font-family:${FONT};font-size:16px;line-height:1.65;color:${theme.text};">${contentHtml}</blockquote>` +
    button(theme, url, tx.replyRead)
  return { subject: `${tx.replySubject} — ${siteTitle}`, html: shell(brand, content, '', intro) }
}
