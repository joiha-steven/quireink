import { RouterProvider, Link, Card } from 'quireink'

// Every `Link`, `usePathname` and the top progress bar read this context; outside it they
// throw. The card shows the navigation it makes possible.
export function WrappingNavigation() {
  return (
    <RouterProvider>
      <Card title="Where to next">
        <div className="flex flex-col items-start gap-1 text-sm">
          <Link href="/admin" className="text-neutral-800 underline underline-offset-2">Dashboard</Link>
          <Link href="/admin/content" className="text-neutral-800 underline underline-offset-2">Content</Link>
          <Link href="/admin/settings" className="text-neutral-800 underline underline-offset-2">Settings</Link>
        </div>
      </Card>
    </RouterProvider>
  )
}
