// Page shell: fetch this view's props, then render the component tree the frozen tree
// rendered from a server component. The tree itself is unchanged.

import { useAdminT } from '@/admin/components/I18nProvider'
import { LibraryTabs } from '@/admin/components/LibraryTabs'
import { PageHeader } from '@/admin/components/kit'

// No view fetch: both libraries load their own rows, and always did.
export default function Media() {
  const t = useAdminT()
  return (
    <div>
      {/* The intro sentence moved into the sheet's closing line (LibraryTabs): the
          page head carries the NAME, the sheet carries the page. */}
      <PageHeader title={t.libraryTitle} />
      <LibraryTabs />
    </div>
  )
}
