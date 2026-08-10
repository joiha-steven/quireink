import { BrandWord } from 'quireink'

// Outlines, not live text: the admin renders in whatever chrome font the owner picked, so as
// text this would have been a different logo per install.
export function Default() {
  return <div className="p-4 text-neutral-900"><BrandWord /></div>
}

export function Sizes() {
  return (
    <div className="flex items-end gap-6 p-4 text-neutral-900">
      <BrandWord height={14} />
      <BrandWord height={20} />
      <BrandWord height={32} />
      <BrandWord height={48} />
    </div>
  )
}

export function InTheRailHeader() {
  return (
    <div className="w-56 rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900">
      <BrandWord />
      <p className="mt-3 text-xs text-neutral-500">quireink.com</p>
    </div>
  )
}
