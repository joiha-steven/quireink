// A date-and-time field drawn in the admin's own language.
//
// It replaces `<input type="datetime-local">`, whose popup calendar is the browser's — a
// blue Chrome control that no stylesheet can reach, sitting in a monochrome admin. The
// owner's verdict on it: "lịch đang rất xấu, không hợp design tổng thể." The input half of
// the native control was fine; the calendar half is what this file redraws.
//
// The VALUE stays the `datetime-local` string ("YYYY-MM-DDTHH:mm"), so every caller and
// every save path is untouched. Weekday and month names come from `Intl` in the browser's
// locale — a device-level display choice, like the collapse state of the rail.
import { useEffect, useRef, useState } from 'react'
import { CONTROL, NOTE, SETTING_LABEL } from '@/admin/components/kit'
import { useAdminT } from '@/admin/components/I18nProvider'

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Monday-first weekday initials, from Intl rather than an i18n table of seven × six. */
function weekdayInitials(): string[] {
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
  // 2024-01-01 is a Monday; six more days follow it.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const t = useAdminT()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const picked = value ? new Date(value) : new Date()
  const valid = !Number.isNaN(picked.getTime())
  const shown = valid ? picked : new Date()
  // The month the grid is LOOKING AT, which is not always the month of the value.
  const [view, setView] = useState(() => new Date(shown.getFullYear(), shown.getMonth(), 1))

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key) }
  }, [open])

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(view)
  // Monday-first offset of the 1st (getDay: Sun=0), then a 6-week grid so the height never jumps.
  const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.getFullYear(), view.getMonth(), 1 - lead + i)
    return d
  })
  const today = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const pickDay = (d: Date) => {
    const next = new Date(d)
    next.setHours(shown.getHours(), shown.getMinutes())
    onChange(toValue(next))
  }
  const setTime = (hhmm: string) => {
    const [hh, mm] = hhmm.split(':').map(Number)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return
    const next = new Date(shown)
    next.setHours(hh, mm)
    onChange(toValue(next))
  }

  const NAV =
    'grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'

  return (
    <div className="relative" ref={box}>
      <span className={SETTING_LABEL}>{label}</span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setView(new Date(shown.getFullYear(), shown.getMonth(), 1)); setOpen((v) => !v) }}
        className={`${CONTROL} mt-2 flex w-full items-center justify-between text-left`}
      >
        <span>{valid ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(picked) : '—'}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="px-1 text-sm font-medium">{monthLabel}</span>
            <div className="flex">
              <button type="button" aria-label="←" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className={NAV}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m14 6-6 6 6 6" /></svg>
              </button>
              <button type="button" aria-label="→" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className={NAV}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m10 6 6 6-6 6" /></svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-neutral-400 dark:text-neutral-500">
            {weekdayInitials().map((w, i) => <span key={i} className="py-1">{w}</span>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.getMonth() === view.getMonth()
              const isPicked = valid && sameDay(d, picked)
              const isToday = sameDay(d, today)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={`grid h-8 place-items-center rounded-lg text-sm tabular-nums ${
                    isPicked
                      ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900'
                      : `${inMonth ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-600'} hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                          isToday ? 'ring-1 ring-inset ring-neutral-300 dark:ring-neutral-600' : ''
                        }`
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
            {/* The native TIME input keeps its text half only — no popup, so nothing blue. */}
            <input
              type="time"
              value={`${pad(shown.getHours())}:${pad(shown.getMinutes())}`}
              onChange={(e) => setTime(e.target.value)}
              className={`${CONTROL} w-28 tabular-nums`}
            />
            <button type="button" onClick={() => { onChange(toValue(new Date())); setView(new Date(today.getFullYear(), today.getMonth(), 1)) }} className={`${NOTE} hover:text-neutral-900 dark:hover:text-white`}>
              {t.dateNow}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
