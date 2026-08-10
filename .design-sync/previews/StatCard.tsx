import { StatCard, IconContent, IconComment, IconMedia } from 'quireink'

export function Basic() {
  return <StatCard label="Posts" value={128} />
}

export function WithIconAndSub() {
  return <StatCard label="Comments" value={341} sub="12 awaiting moderation" icon={<IconComment />} />
}

// `href` wraps the whole tile in a link and adds the hover lift.
export function Linked() {
  return <StatCard label="Media" value="1.4 GB" sub="612 originals" icon={<IconMedia />} href="/admin/media" />
}

// The row the dashboard actually renders.
export function AsARow() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Posts" value={128} icon={<IconContent />} href="/admin/content" />
      <StatCard label="Pages" value={9} href="/admin/content" />
      <StatCard label="Comments" value={341} sub="12 pending" icon={<IconComment />} href="/admin/comments" />
      <StatCard label="Media" value="1.4 GB" icon={<IconMedia />} href="/admin/media" />
    </div>
  )
}
