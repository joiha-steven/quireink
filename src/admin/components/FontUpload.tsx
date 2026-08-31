// Custom typeface uploader — one slot per weight (Regular/Medium/SemiBold/Bold).
// Each file goes to POST /api/files/font (stored under files/ on Blob), and all
// slots share one family so headings/bold render with their real weight (the site
// disables faux-bold). Parent owns state + save.
import { useRef, useState } from 'react'
import type { ApiResponse, FontSettings, FontFace } from '@/types'
import { FONT_WEIGHTS } from '@/content/themes'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { PANEL } from './kit'

type Props = {
  value: FontSettings
  onChange: (font: FontSettings) => void
}

const WEIGHT_LABEL: Record<number, keyof AdminStrings> = {
  400: 'fontWeight400',
  500: 'fontWeight500',
  600: 'fontWeight600',
  700: 'fontWeight700',
}

export function FontUpload({ value, onChange }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<number | null>(null)
  // Which weight slot the hidden file input is currently targeting.
  const pickWeight = useRef<number>(400)

  async function upload(file: File, weight: number) {
    setBusy(weight)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('weight', String(weight))
      const res = await fetch('/api/files/font', { method: 'POST', body })
      const json = (await res.json()) as ApiResponse<FontFace & { family: string }>
      if (!json.success || !json.data) throw new Error(json.error)
      const { url, family } = json.data
      const faces = [...value.faces.filter((f) => f.weight !== weight), { weight, url }].sort((a, b) => a.weight - b.weight)
      // Keep the existing family; adopt the derived one only for the first upload.
      onChange({ family: value.family || family, faces })
      notify(t.uploaded)
    } catch {
      notify(t.uploadFailed, 'error')
    } finally {
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeWeight(weight: number) {
    const faces = value.faces.filter((f) => f.weight !== weight)
    onChange(faces.length ? { ...value, faces } : { family: '', faces: [] })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-neutral-500 dark:text-neutral-400">{t.fontHint}</p>
      <div className="text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">{t.fontFamilyLabel}: </span>
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{value.family || t.fontDefault}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f, pickWeight.current)
        }}
      />

      {/* Two to a line. Four weights, one per full-width row, put a two-word label at one end
          and its Upload button at the other with ~400px of nothing between them — measured
          2026-08-31, the same hole the pen card had. A weight and its button are a pair; the
          grid keeps them a pair, and the four rows become two. */}
      <div className={`${PANEL} sm:grid sm:grid-cols-2`}>
        {FONT_WEIGHTS.map((w) => {
          const has = value.faces.some((f) => f.weight === w)
          return (
            <div key={w} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300" style={{ fontWeight: w }}>
                {t[WEIGHT_LABEL[w]] as string} · {w}
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-xs ${has ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-500 dark:text-neutral-600'}`}>
                  {has ? t.fontUploaded : '—'}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    pickWeight.current = w
                    inputRef.current?.click()
                  }}
                >
                  {busy === w ? t.loading : has ? t.fontReplace : t.fontChoose}
                </Button>
                {has && busy === null && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeWeight(w)}>
                    {t.removeSelection}
                  </Button>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}