import { PencilIcon } from 'quireink'

// The icons are propless and draw in `currentColor` at a fixed size, so a card showing the
// bare glyph reads as blank. Each cell puts it somewhere it is actually used.
export function Default() {
  return (
    <div className="flex items-center gap-3 p-4 text-neutral-700">
      <PencilIcon />
      <span className="text-sm">PencilIcon — edits the row</span>
    </div>
  )
}

export function InheritsColour() {
  return (
    <div className="flex items-center gap-6 p-4">
      <span className="text-neutral-900"><PencilIcon /></span>
      <span className="text-neutral-500"><PencilIcon /></span>
      <span className="text-neutral-300"><PencilIcon /></span>
    </div>
  )
}

export function InContext() {
  return (
    <div className="flex w-72 items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2">
      <span className="truncate text-sm text-neutral-800">What a static blog gives up</span>
      <button type="button" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
        <PencilIcon />
      </button>
    </div>
  )
}
