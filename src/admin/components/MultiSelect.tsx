// Multi-select with inline create. Used for categories and tags.
import { useState } from 'react'
import { useAdminT } from './I18nProvider'

type Props = {
  label: string
  value: string[]
  options: string[]
  placeholder?: string
  onChange: (next: string[]) => void
  lowercase?: boolean
}

export function MultiSelect({ label, value, options, placeholder, onChange, lowercase = false }: Props) {
  const t = useAdminT()
  const [draft, setDraft] = useState('')
  // Every not-yet-picked term is offered (no cap — the editor must show them all);
  // typing filters the list by substring so a long taxonomy stays navigable.
  const q = draft.trim().toLowerCase()
  const suggestions = options.filter((o) => !value.includes(o) && (!q || o.toLowerCase().includes(q)))

  function add(item: string) {
    const v = item.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className={`flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-white dark:bg-neutral-200 dark:text-neutral-900 ${lowercase ? 'lowercase' : ''}`}>
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={t.removeAria}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          }
        }}
        placeholder={placeholder ?? t.multiPlaceholder}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400"
      />
      {suggestions.length > 0 && (
        <div className="scroll-fade flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pb-4">
          {suggestions.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className={`rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 ${lowercase ? 'lowercase' : ''}`}
            >
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
