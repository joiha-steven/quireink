import { IconCache } from 'quireink'

// The nav icons are propless and fixed at 20px in `currentColor`, so a card showing the bare
// glyph reads as blank. Each cell puts it where the admin actually uses it.
export function Default() {
  return (
    <div className="flex items-center gap-3 p-4 text-neutral-700">
      <IconCache />
      <span className="text-sm">IconCache — the Cache rail entry</span>
    </div>
  )
}

export function InheritsColour() {
  return (
    <div className="flex items-center gap-6 p-4">
      <span className="text-neutral-900"><IconCache /></span>
      <span className="text-neutral-500"><IconCache /></span>
      <span className="text-neutral-300"><IconCache /></span>
    </div>
  )
}

export function InSidebarRow() {
  return (
    <div className="w-56 p-2">
      <span className="flex items-center gap-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
        <IconCache />
        Cache
      </span>
      <span className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500">
        <IconCache />
        Cache
      </span>
    </div>
  )
}
