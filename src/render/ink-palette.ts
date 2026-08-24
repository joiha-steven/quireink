// One chosen colour becomes the four the pen needs — and an install that chose nothing gets
// the measured inks, unchanged, under the same hash it had yesterday.
//
// Added 2026-08-24 with `InkSettings`. The shape of that setting is the whole trick: every
// field is an OVERRIDE and '' means the built-in, so the values ADR 0018 measured stay in
// the code where they can still be corrected, rather than being copied into every install's
// database on first save.

import type { InkSettings } from '@/types'
import {
  PEN_AUX_DARK, PEN_AUX_LIGHT, PEN_DARK, PEN_LIGHT, PEN_LINE_DARK, PEN_LINE_LIGHT,
  type PenInk,
} from '@/render/pen'
import { darkStroke, lineInk } from '@/render/pen-derive'

/**
 * Every colour the two pen sheets need, resolved. Four maps and two pairs, because a
 * pigment is not one value: the sweep, the same sweep pre-mixed into a dark page, and a
 * ballpoint-strength version for the gestures that are LINES rather than areas.
 */
export type InkPalette = {
  light: Record<string, string>
  dark: Record<string, string>
  lineLight: Record<string, string>
  lineDark: Record<string, string>
  auxLight: Record<string, string>
  auxDark: Record<string, string>
}

/** The measured inks (ADR 0018), which is what an install that has chosen nothing gets. */
export const BUILT_IN_INKS: InkPalette = {
  light: PEN_LIGHT,
  dark: PEN_DARK,
  lineLight: PEN_LINE_LIGHT,
  lineDark: PEN_LINE_DARK,
  auxLight: PEN_AUX_LIGHT,
  auxDark: PEN_AUX_DARK,
}

/**
 * All empty: '' means "the built-in ink". Lives HERE rather than beside the other settings
 * defaults because the admin needs it for its Reset button, and `content/settings.ts`
 * reaches the database on import — a client bundle cannot follow it there.
 */
export const DEFAULT_INKS: InkSettings = {
  yellow: '', green: '', pink: '', blue: '', orange: '',
  ring: '', underline: '', selection: '', selectionDark: '',
}

const INKS: PenInk[] = ['yellow', 'green', 'pink', 'blue', 'orange']

/** The pen's data-URIs carry a bare hex; the setting stores one with a '#' on the front. */
const bare = (hex: string) => hex.replace(/^#/, '').toLowerCase()

/**
 * A signature for the chosen inks, and '' when nothing is chosen.
 *
 * The empty case is load-bearing rather than an optimisation: it is what lets every install
 * that has never opened the colour card keep the prebuilt sheets, prebuilt hashes and
 * prebuilt bytes it has always had.
 */
export function inkSignature(inks: InkSettings): string {
  const parts = [...INKS, 'ring' as const, 'underline' as const]
    .map((key) => inks[key as keyof InkSettings] || '')
  return parts.some(Boolean) ? parts.join('|') : ''
}

/**
 * The four maps, built from the built-ins plus whatever the owner has overridden.
 *
 * An overridden ink derives its own dark and line variants; the ones left alone keep the
 * measured values, INCLUDING their hand-tuned exceptions (dark yellow is warmed by hand so
 * it does not read as the green — a formula cannot make that judgement, and a default can).
 */
export function resolveInks(inks: InkSettings): InkPalette {
  if (!inkSignature(inks)) return BUILT_IN_INKS
  const light = { ...PEN_LIGHT }
  const dark = { ...PEN_DARK }
  const lineLight = { ...PEN_LINE_LIGHT }
  const lineDark = { ...PEN_LINE_DARK }
  for (const ink of INKS) {
    const chosen = inks[ink]
    if (!chosen) continue
    light[ink] = bare(chosen)
    dark[ink] = darkStroke(chosen)
    lineLight[ink] = lineInk(chosen, 'light')
    lineDark[ink] = lineInk(chosen, 'dark')
  }
  // The other two pens: the pencil an underline defaults to and the ballpoint a ring does.
  // Same rule, and the dark twin is derived the same way — brighter than a highlighter's
  // dark mix, because a line owes the page visibility rather than a text-contrast ceiling.
  const auxLight: Record<string, string> = { ...PEN_AUX_LIGHT }
  const auxDark: Record<string, string> = { ...PEN_AUX_DARK }
  if (inks.underline) {
    auxLight.graphite = bare(inks.underline)
    auxDark.graphite = lineInk(inks.underline, 'dark')
  }
  if (inks.ring) {
    auxLight.red = bare(inks.ring)
    auxDark.red = lineInk(inks.ring, 'dark')
  }
  return { light, dark, lineLight, lineDark, auxLight, auxDark }
}
