import { RowActions, TableFrame, StatusPill } from 'quireink'

// Three compact icon buttons: open in a new tab, edit, delete. `viewHref` is optional, and a
// draft has nothing public to open, which is the whole difference between the two cells.
export function Published() {
  return (
    <div className="flex justify-end p-4">
      <RowActions editHref="/admin/content/what-a-static-blog-gives-up" viewHref="/what-a-static-blog-gives-up" onDelete={() => {}} />
    </div>
  )
}

export function DraftNoViewLink() {
  return (
    <div className="flex justify-end p-4">
      <RowActions editHref="/admin/content/measuring-a-page" onDelete={() => {}} />
    </div>
  )
}

// Where they actually live: the right-hand column of a content row.
export function InATableRow() {
  return (
    <TableFrame>
      <tbody>
        <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
          <td className="px-4 py-3 text-sm">What a static blog gives up</td>
          <td className="px-4 py-3"><StatusPill published label="Published" /></td>
          <td className="px-4 py-3">
            <RowActions editHref="/admin/content/what-a-static-blog-gives-up" viewHref="/what-a-static-blog-gives-up" onDelete={() => {}} />
          </td>
        </tr>
        <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
          <td className="px-4 py-3 text-sm">Notes on measuring a page</td>
          <td className="px-4 py-3"><StatusPill published={false} label="Draft" /></td>
          <td className="px-4 py-3">
            <RowActions editHref="/admin/content/measuring-a-page" onDelete={() => {}} />
          </td>
        </tr>
      </tbody>
    </TableFrame>
  )
}
