import { Button } from 'quireink'

// Monochrome, but three ranks: a solid fill for the action you came to do, a strong OUTLINE
// for one that destroys something, and secondary's faint border for everything else.
export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button variant="primary">Save changes</Button>
      <Button variant="secondary">Preview</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="danger">Delete forever</Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button variant="primary" disabled>Save changes</Button>
      <Button variant="secondary" disabled>Preview</Button>
      <Button variant="danger" disabled>Delete forever</Button>
    </div>
  )
}

// The editor's real toolbar row: primary last, on the right.
export function InAFormFooter() {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 p-4">
      <Button variant="danger">Move to trash</Button>
      <div className="flex items-center gap-2">
        <Button variant="ghost">Discard</Button>
        <Button variant="secondary">Save draft</Button>
        <Button variant="primary">Publish</Button>
      </div>
    </div>
  )
}

// `whitespace-nowrap` and `shrink-0` are load-bearing: beside a long label a button with
// neither gets squeezed until its own text wraps.
export function BesideLongText() {
  return (
    <div className="flex w-96 items-center gap-4 p-4">
      <p className="text-sm text-neutral-600">
        The render cache holds every page body, keyed by content. Clearing it forces the next
        visitor to pay for a fresh render.
      </p>
      <Button variant="secondary">Clear cache</Button>
    </div>
  )
}
