// Settings turned into CSS: the type scale, and the owner's uploaded typeface.
//
// Split out of `content/settings.ts` on 2026-08-22, when that file reached its 400-line
// ceiling for the third time. The seam is the one `settings-resolve.ts` was cut on and it
// is by AUDIENCE: everything left in `settings.ts` answers "what is stored and how is it
// read back", and these two answer "what stylesheet does that turn into". Their only
// callers are `web/layout.ts` and `web/admin/spa.ts`, which want a string to put in a
// <style> and care about none of the storage above. `settings.ts` re-exports both, so no
// import site moved.

import type { FontSettings, TypographySettings } from '@/types'
import { TYPE_ROLES } from '@/content/themes'
import { fontFormat } from '@/content/settings-type'

// Per-role type CSS vars on :root (+ optional font-smoothing). Injected after globals.css
// (same defaults), so a saved scale wins and a fresh install still works.
//
// ⚠️ BOOK MODE IS ONE NUMBER, AND IT IS EMITTED TWICE. Do not "simplify" this to one block.
//
// The rule: in book mode the reading text runs larger than the article, and every gap around
// it moves by the same factor. Type and the space between it are one system — enlarging the
// words alone gives crowded reading, not bigger reading. So `--sp` carries the scale exactly
// as `--fs-<role>` does.
//
// Emitting the block a SECOND time on `.book-overlay` is the whole mechanism, because the
// obvious version does not work: a `var()` inside a custom property is substituted where that
// property is DECLARED, not where it is used. `--fs-body` declared on `:root` resolves
// `var(--type-scale, 1)` against `:root`, where the scale is undefined, and the resolved
// `calc(1.13rem * 1)` is what inherits — so overriding `--type-scale` on a descendant changes
// nothing. This file used to claim the opposite, and book mode rendered at EXACTLY the
// article's size since the port. Measured 2026-07-29, every ratio 1.000.
//
//   #a { --scale:1; --unit:calc(10px * var(--scale,1)) }  ->  calc(10px * 1)
//   #b { --scale:2 }                        (inherits #a's) ->  calc(10px * 1)   <- the trap
//   #c { --scale:2; --unit:calc(10px * var(--scale,1)) }  ->  calc(10px * 2)   <- the fix
//
// Re-declaring the identical text on `.book-overlay` re-substitutes it THERE. The numbers
// still live in one place: this function. Pinned by `web/typography.test.ts`.
function scaledVars(t: TypographySettings): string {
  const roles = TYPE_ROLES.map((r) => {
    const s = t.roles[r]
    return `--fs-${r}:calc(${s.size}rem * var(--type-scale, 1))`
      + `;--lh-${r}:${s.line};--ls-${r}:${s.spacing}em`
  }).join(';')
  // The article's spacing unit. Scale-dependent, so it belongs in this block and nowhere
  // else: a second definition on :root elsewhere would win or lose by source order and the
  // book overlay would go back to unscaled gaps.
  //
  // `--density` (settings/shape, 2026-08-29) multiplies in HERE for exactly the reason the
  // block above is emitted twice: a var() inside a custom property resolves where the
  // property is DECLARED. Reading the density anywhere else would bake in whatever value
  // :root happened to hold and the knob would silently do nothing — the same trap that had
  // book mode rendering at the article's size for a release. The fallback keeps a stylesheet
  // rendered before the setting existed identical to one rendered after it.
  return `${roles};--sp:calc(1rem * var(--type-scale, 1) * var(--density, 1))`
}

export function typographyToCss(t: TypographySettings): string {
  const vars = scaledVars(t)
  const smooth = t.smoothing ? `body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}` : ''
  return `:root{${vars}}.book-overlay{${vars}}${smooth}`
}

// Emit one @font-face per uploaded weight for the owner typeface and point
// --font-reading at it (Inter stays the fallback). Empty when no font is set.
export function fontToCss(f: FontSettings): string {
  if (!f.family || f.faces.length === 0) return ''
  const faces = f.faces
    .map((face) => {
      const fmt = fontFormat(face.url)
      const src = `url('${face.url}')${fmt ? ` format('${fmt}')` : ''}`
      return `@font-face{font-family:'${f.family}';font-weight:${face.weight};font-style:normal;src:${src};font-display:swap}`
    })
    .join('')
  // An uploaded custom font styles the reader's words (article, comments, editor),
  // matching the built-in fontPreset scope — the chrome stays Inter.
  return faces + `:root{--font-reading:'${f.family}', var(--font-inter)}`
}
