// How the highlighter pen draws, site-wide. `==text==` in a post, and `==text==#green` when
// the writer wants one of the other four inks.
//
// Sits beside Galleries because the two settings are the same KIND of thing and carry the
// same constraint: both are defaults for something that appears inside a post body, and both
// are applied as CSS rather than markup, because rendered bodies are cached under a hash of
// their Markdown and a default that rewrote the HTML would leave every cached body wearing
// the old one.
//
// The colours are not a setting. A highlighter's pigment is a physical fact about the pen,
// not a palette choice — see `web/ink.css.ts`.

import type { HighlightSettings } from '@/types'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const LABEL = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300'

const STROKES: HighlightSettings['stroke'][] = ['marker', 'swipe', 'double']

export function HighlightFields({ highlight, onChange }: {
  highlight: HighlightSettings
  onChange: (h: HighlightSettings) => void
}) {
  const t = useAdminT()
  const labels: Record<HighlightSettings['stroke'], string> = {
    marker: t.strokeMarker,
    swipe: t.strokeSwipe,
    double: t.strokeDouble,
  }

  return (
    <div className="space-y-2">
      <span className={LABEL}>{t.highlightStroke}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
        {STROKES.map((stroke) => (
          <button
            key={stroke}
            type="button"
            onClick={() => onChange({ ...highlight, stroke })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              highlight.stroke === stroke
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500'
            }`}
          >
            {labels[stroke]}
          </button>
        ))}
      </div>
      <p className={NOTE_TEXT}>{t.highlightStrokeHint}</p>
    </div>
  )
}
