// Which answers the service worker (`sw.ts`) may keep as a page's offline copy.
//
// Only a 200 from this origin that was not redirected: a 404 or a 500 kept would be served back
// offline as though it were the page, and `Cache.put` rejects a redirect outright.
//
// And never one the server marked `private`. A theme preview is the owner's page at a reader's URL
// (`web/theme-preview.ts`) and goes out `private, no-store`; kept here it would be that path's
// offline copy, a preview bar included, until the path was next read online. `no-store` alone is
// not the test: a reader's page goes out `public, no-store` while the owner has switched the page
// cache off, and offline reading kept those before previews existed.
export function keepsOffline(res: Response): boolean {
  if (!res.ok || res.status !== 200 || res.redirected) return false
  const cacheControl = (res.headers.get('cache-control') ?? '').toLowerCase()
  return !/(^|[\s,])private([\s,=]|$)/.test(cacheControl)
}
