import { BrandMark } from 'quireink'

// Height-driven: the letterforms have fixed proportions, so height is the only sizing that
// cannot distort them. Drawn in `currentColor` from the same art the sign-in page uses.
export function Default() {
  return <div className="p-4 text-neutral-900"><BrandMark /></div>
}

export function Sizes() {
  return (
    <div className="flex items-end gap-6 p-4 text-neutral-900">
      <BrandMark height={16} />
      <BrandMark height={22} />
      <BrandMark height={40} />
      <BrandMark height={64} />
    </div>
  )
}

// The collapsed rail: `Qi` is the same logo at the size where the full word would be a smear.
export function InCollapsedRail() {
  return (
    <div className="flex w-16 flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-white py-4 text-neutral-900">
      <BrandMark />
      <span className="h-px w-8 bg-neutral-200" />
    </div>
  )
}
