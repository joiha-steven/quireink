// A minimal self-contained HTML page for the newsletter confirm / unsubscribe links
// (they open in the reader's browser from an email, so they can't be a React route
// that assumes the app shell). Server-only; text is pre-escaped by the caller's i18n.

// One escaper for both pages, and it escapes `"` as well as the text-node characters:
// several of these values land inside an attribute (`href`, `action`). Two local copies is
// how the pages drifted apart in the first place, with only one of them attribute-safe.
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The same warning the escaper carries, one level up: the two pages had the whole document
// written out twice — doctype, head, and a `<style>` block that agreed line for line except
// where it did not. Only the STYLE below differs between them now, and only by the button.
const BASE_CSS = `
  :root { color-scheme: light dark }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 32rem;
         margin: 12vh auto; padding: 0 1.25rem; line-height: 1.6; color: #1a1a1a; background: #fff }
  @media (prefers-color-scheme: dark) { body { color: #e5e5e5; background: #111 } }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem } p { color: #666 } a { color: inherit }
  @media (prefers-color-scheme: dark) { p { color: #aaa } }`

const BUTTON_CSS = `
  button { font: inherit; cursor: pointer; margin-top: .75rem; padding: .6rem 1.1rem; border-radius: .5rem;
           border: 1px solid #ccc; background: #f5f5f5; color: inherit }
  @media (prefers-color-scheme: dark) { button { border-color: #444; background: #1c1c1c } }`

function page(title: string, body: string, tail: string, css = ''): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${BASE_CSS}${css}
</style></head><body>
<h1>${esc(title)}</h1>
${body ? `<p>${esc(body)}</p>` : ''}
${tail}
</body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export function resultPage(title: string, body: string, homeUrl: string, homeLabel: string): Response {
  return page(title, body, `<p><a href="${esc(homeUrl)}">${esc(homeLabel)} →</a></p>`)
}

// Confirmation page with a single POST button — used so a state-changing action
// (unsubscribe) never fires on a bare GET (email link scanners / prefetchers issue
// GETs and would otherwise unsubscribe a reader with no click). `action` is the URL the
// button POSTs to (carrying the token).
export function confirmPage(title: string, body: string, button: string, action: string): Response {
  return page(
    title,
    body,
    `<form method="post" action="${esc(action)}"><button type="submit">${esc(button)}</button></form>`,
    BUTTON_CSS,
  )
}
