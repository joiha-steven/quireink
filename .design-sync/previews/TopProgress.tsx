import { TopProgress } from 'quireink'

// A 2px bar pinned to the top of the viewport, driven by the router's pending state. It is
// deliberately thin, so the cell frames it against the page chrome it actually sits above.
export function Default() {
  return (
    <div className="relative h-24 w-full overflow-hidden border border-neutral-200 bg-white">
      <TopProgress />
      <div className="p-4 text-sm text-neutral-500">Page content sits under the bar.</div>
    </div>
  )
}
