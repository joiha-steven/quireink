// Free-text input with a styled suggestion dropdown — replaces `<input list>` +
// `<datalist>`, whose native popup can't be styled (wrong font, cramped rows, no
// hover). You can type a brand-new value or pick an existing one. The list inherits
// the admin font + control chrome and highlights on hover, matching everything else.
import { useEffect, useRef, useState } from 'react'
import { CONTROL } from './kit'

export function Combobox({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  options: string[]
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Suggestions that contain what's typed, minus an exact match (nothing to pick then).
  const needle = value.trim().toLowerCase()
  const matches = options
    .filter((o) => o.toLowerCase().includes(needle) && o.toLowerCase() !== needle)
    .slice(0, 8)

  // Close when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>}
      <div ref={wrapRef} className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={placeholder}
          className={`${CONTROL} w-full`}
        />
        {open && matches.length > 0 && (
          <ul className="absolute z-20 mt-1 scroll-fade max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {matches.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the pick registers before the input blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(o)
                    setOpen(false)
                  }}
                  className="block w-full px-3.5 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}
