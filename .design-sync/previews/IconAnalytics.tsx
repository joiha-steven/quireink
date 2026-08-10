import { IconAnalytics } from 'quireink'

// The icons are propless and draw in `currentColor` at a fixed size, so a card showing the
// bare glyph reads as blank. Each cell puts it somewhere it is actually used.
export function Default() {
  return (
    <div className="flex items-center gap-3 p-4 text-neutral-700">
      <IconAnalytics />
      <span className="text-sm">IconAnalytics — the Analytics rail entry</span>
    </div>
  )
}

export function InheritsColour() {
  return (
    <div className="flex items-center gap-6 p-4">
      <span className="text-neutral-900"><IconAnalytics /></span>
      <span className="text-neutral-500"><IconAnalytics /></span>
      <span className="text-neutral-300"><IconAnalytics /></span>
    </div>
  )
}

export function InContext() {
  return (
    <div className="w-56 p-2">
      <span className="flex items-center gap-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
        <IconAnalytics />
        Analytics
      </span>
      <span className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500">
        <IconAnalytics />
        Analytics
      </span>
    </div>
  )
}
