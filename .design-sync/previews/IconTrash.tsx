import { IconTrash } from 'quireink'

// The nav icons are propless and fixed at 20px, drawn in `currentColor`. A card showing the
// bare glyph reads as blank at card scale, so every icon preview shows it the three ways the
// admin actually uses it: at rest, at the size it ships, and inside the sidebar row it was
// drawn for.
export function Default() {
  return (
    <div className="flex items-center gap-3 p-4 text-neutral-700">
      <IconTrash />
      <span className="text-sm">IconTrash — 20px, stroke 1.55, currentColor</span>
    </div>
  )
}

export function InheritsColour() {
  return (
    <div className="flex items-center gap-6 p-4">
      <span className="text-neutral-900"><IconTrash /></span>
      <span className="text-neutral-400"><IconTrash /></span>
      <span className="text-neutral-300"><IconTrash /></span>
    </div>
  )
}

// The real context: a sidebar row, selected and unselected.
export function InSidebarRow() {
  return (
    <div className="w-56 p-2">
      <span className="flex items-center gap-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
        <IconTrash />
        Trash
      </span>
      <span className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500">
        <IconTrash />
        Trash
      </span>
    </div>
  )
}
