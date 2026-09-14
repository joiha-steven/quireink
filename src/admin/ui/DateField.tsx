// A date-and-time field drawn in the admin's own language.
//
// It replaces `<input type="datetime-local">`, whose popup calendar is the browser's — a
// blue Chrome control that no stylesheet can reach, sitting in a monochrome admin. The
// calendar was rejected as ugly and out of keeping with the design. The input half of
// the native control was fine; the calendar half is what this file redraws.
//
// The VALUE stays the `datetime-local` string ("YYYY-MM-DDTHH:mm"), so every caller and
// every save path is untouched.
//
// ⚠️ IT PRINTS IN THE ADMIN'S LANGUAGE, not the machine's. Weekday, month and the closed
// field all used `Intl` with no locale, which means whatever the device is set to: a
// Vietnamese admin read "Sep 14, 2026, 7:59 AM" on the button and "14 thg 9, 2026, 14:30" on
// the line directly under it, because that line had already been moved off the machine's
// locale. `formatWallClock`'s own note names both halves of that mistake and this field was
// the last place in the admin still making them.
//
// The closed field goes through `formatWallClock` rather than through a Date of its own for
// the second half: `new Date("2026-03-08T02:30")` is read in the MACHINE's zone, and an hour
// that zone does not have is silently moved to one it does — so a post scheduled for 02:30
// from a browser in New York printed back as 03:30 while the stored value stayed 02:30.
import { useEffect, useId, useRef, useState } from 'react'
import { CONTROL, NOTE, SETTING_LABEL } from '@/admin/components/kit'
import { useAdminLang, useAdminT } from '@/admin/components/I18nProvider'
import { dateLocale, formatWallClock } from '@/i18n/format'
import type { SiteLang } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Monday-first weekday initials, from Intl rather than an i18n table of seven × six. */
function weekdayInitials(lang: SiteLang): string[] {
  const fmt = new Intl.DateTimeFormat(dateLocale(lang), { weekday: 'narrow' })
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
  const lang = useAdminLang()
  const [open, setOpen] = useState(false)
  // The label is a caption over a button, not a `<label>` over an input: the control here is
  // the button that opens the calendar. Naming it by both ids reads the caption and then the
  // date it currently holds, which is what a `<label>` around a native field would have said.
  const id = useId()
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

  const monthLabel = new Intl.DateTimeFormat(dateLocale(lang), { month: 'long', year: 'numeric' }).format(view)
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
      <span id={`${id}-label`} className={SETTING_LABEL}>{label}</span>
      <button
        type="button"
        id={`${id}-value`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setView(new Date(shown.getFullYear(), shown.getMonth(), 1)); setOpen((v) => !v) }}
        className={`${CONTROL} mt-2 flex w-full items-center justify-between text-left`}
      >
        {/* `value &&`, because the closed field now prints the STRING rather than a Date
            built from it: an empty value used to fall back to today through `picked`, and
            through `formatWallClock` it would come back as an empty button instead. Nothing
            hands this field an empty value today; a blank control that looks broken is the
            wrong way to find out that something started to. */}
        <span>{value && valid ? formatWallClock(value, lang) : '—'}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="px-1 text-sm font-medium">{monthLabel}</span>
            <div className="flex">
              <button type="button" aria-label={t.dateMonthPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className={NAV}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m14 6-6 6 6 6" /></svg>
              </button>
              <button type="button" aria-label={t.dateMonthNext} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className={NAV}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m10 6 6 6-6 6" /></svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {weekdayInitials(lang).map((w, i) => <span key={i} className="py-1">{w}</span>)}
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
              aria-label={t.dateTime}
              value={`${pad(shown.getHours())}:${pad(shown.getMinutes())}`}
              onChange={(e) => setTime(e.target.value)}
              className={`${CONTROL} w-28 tabular-nums`}
            />
            {/* TWO SHORTCUTS, and the second is the one a scheduler actually reaches for.
                "Now" answers "publish this" and is one click; a post being QUEUED is almost
                always queued for a morning, and picking tomorrow 9:00 out of the grid is
                three — find the month, find the cell, then type the time. */}
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const at = new Date()
                  at.setDate(at.getDate() + 1)
                  at.setHours(9, 0, 0, 0)
                  onChange(toValue(at))
                  setView(new Date(at.getFullYear(), at.getMonth(), 1))
                }}
                className={`${NOTE} hover:text-neutral-900 dark:hover:text-white`}
              >
                {t.dateTomorrow}
              </button>
              <button type="button" onClick={() => { onChange(toValue(new Date())); setView(new Date(today.getFullYear(), today.getMonth(), 1)) }} className={`${NOTE} hover:text-neutral-900 dark:hover:text-white`}>
                {t.dateNow}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
