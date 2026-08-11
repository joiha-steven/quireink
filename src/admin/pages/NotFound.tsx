// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import Link from '@/admin/router'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function NotFound() {
  const t = useAdminT()
  return (
    // `data-admin-404` so "the router found nothing" is a fact something can READ, rather than
    // the string "404" appearing somewhere in the text. The tour asserted on the text and
    // failed on the Help page, whose troubleshooting table has a row about an old URL that
    // 404s — a correct page reported as a broken one, which is the kind of false alarm that
    // teaches people to ignore a red run.
    <div className="py-24 text-center" data-admin-404>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">404</p>
      <Link href="/admin" className="mt-3 inline-block text-sm underline">{t.navHome}</Link>
    </div>
  )
}
