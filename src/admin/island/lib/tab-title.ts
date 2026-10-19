// Re-title the tab when the address changes under an open page (no reload, so the server's
// `<title>` would otherwise go stale). The site part is stamped on `<html>` by the server.
import { tabTitleText } from '@/admin-shared/tab-title'

export function retitle(parts: string[]): void {
  document.title = tabTitleText(parts, document.documentElement.dataset.siteTitle ?? '')
}
