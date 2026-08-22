// Shared chrome for the public header's 40px icon buttons (search, palette,
// theme, menu). They are sibling controls on ONE row, so they import this single
// string and can never drift in size/padding/colour — same rule as ADMIN_NAV for
// the admin bar. Colours come from theme tokens (text-meta / bg-rule), never
// hardcoded neutrals. Adding an icon button = reuse this, do not hand-roll.
export const ICON_BTN =
  'flex h-10 w-10 items-center justify-center rounded-lg text-meta hover:bg-rule'
