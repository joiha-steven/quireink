// Line icons for the admin sidebar — one uniform style (viewBox 24, stroke 1.8,
// round caps, currentColor) so the rail reads as a single set. Sized by the caller.

// Quire Ink line set: quiet 20px drawings with a lighter 1.55 stroke. Shapes favour
// open contours and asymmetric details so the set feels editorial, not like a
// generic dashboard icon pack.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.55, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const C = 'h-5 w-5 shrink-0'

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5M10 20v-6h4v6" />
    </svg>
  )
}
export function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M3 19h18" />
      <path d="m5 15 4-5 4 2 6-7" />
      <circle cx="5" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
export function IconContent() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M5 4.5h10.5L19 8v12H5z" />
      <path d="M15.5 4.5V8H19M8.5 12h7M8.5 15.5h5" />
    </svg>
  )
}
export function IconMedia() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  )
}
export function IconNewsletter() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}
export function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
    </svg>
  )
}
export function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M16 14v6" />
      <circle cx="8" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </svg>
  )
}
export function IconLog() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M4 5v14h16" />
      <path d="M7 15h3v-4h3V8h3V5h3" />
    </svg>
  )
}
export function IconComment() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  )
}
export function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  )
}
export function IconCache() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  )
}

export function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1 .9-1.1 1.8" />
      <path d="M12 16.5h.01" />
    </svg>
  )
}
export function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}
// Collapse/expand chevrons (caller rotates by state if desired).
// The icon switch's own mark: four squares, i.e. "the glyphs". Drawn rather than borrowed
// because every other glyph here already names a destination, and reusing one would make the
// footer row read as a link to that screen.
export function IconGlyphs() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  )
}

export function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

// "Everything else" (ADR 0024 step 6). Three dots, which is the mock's own mark for the row
// that holds comments, trash, log, settings and help — and the one glyph in this set that
// names no destination, because that row does not have one.
export function IconMore() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
