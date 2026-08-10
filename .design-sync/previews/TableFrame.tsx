import { TableFrame } from 'quireink'

// TableFrame supplies the rounded, bordered surface plus the inner scroll box; the caller
// supplies thead/tbody. Both are needed — a table as the frame's direct child squares off
// the card's corners.
export function Basic() {
  return (
    <TableFrame>
      <thead className="whitespace-nowrap border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
        <tr>
          <th className="px-4 py-3 font-medium">Referrer</th>
          <th className="px-4 py-3 text-right font-medium">Views</th>
          <th className="px-4 py-3 text-right font-medium">Share</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['google.com', '2,841', '44%'],
          ['news.ycombinator.com', '1,663', '26%'],
          ['(direct)', '1,319', '21%'],
          ['x.com', '402', '9%'],
        ].map(([a, b, c]) => (
          <tr key={a} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
            <td className="px-4 py-3">{a}</td>
            <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{b}</td>
            <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{c}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  )
}

export function SingleColumn() {
  return (
    <TableFrame>
      <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
        <tr><th className="px-4 py-3 font-medium">Redirect</th></tr>
      </thead>
      <tbody>
        <tr className="border-b border-neutral-100 last:border-0"><td className="px-4 py-3">/old-post → /new-post</td></tr>
        <tr className="border-b border-neutral-100 last:border-0"><td className="px-4 py-3">/feed.xml → /rss.xml</td></tr>
      </tbody>
    </TableFrame>
  )
}
