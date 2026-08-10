import { Link } from 'quireink'

// A real anchor throughout, so middle-click and "open in new tab" keep working; only a plain
// left click on an /admin href routes in place.
export function InternalRoute() {
  return (
    <div className="p-4 text-sm">
      <Link href="/admin/content" className="text-neutral-900 underline underline-offset-2">
        Back to content
      </Link>
    </div>
  )
}

export function ExternalHref() {
  return (
    <div className="p-4 text-sm">
      <Link href="https://quireink.com" className="text-neutral-900 underline underline-offset-2">
        View the site
      </Link>
    </div>
  )
}

export function AsARow() {
  return (
    <div className="w-64 p-2 text-sm">
      <Link href="/admin/content" className="block rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100">Content</Link>
      <Link href="/admin/media" className="block rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100">Media</Link>
      <Link href="/admin/settings" className="block rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100">Settings</Link>
    </div>
  )
}
