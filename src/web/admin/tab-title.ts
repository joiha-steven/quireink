// The server's half of the tab title: the shared text builder, escaped for a `<title>` element.
import { escapeHtml } from '@/utils'
import { tabTitleText } from '@/admin-shared/tab-title'

export { PRODUCT_NAME, tabTitleText } from '@/admin-shared/tab-title'

export function tabTitle(parts: string[], siteTitle: string): string {
  return escapeHtml(tabTitleText(parts, siteTitle))
}
