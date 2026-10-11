// The appearance contract (`content/appearance-contract.ts`) in the shape the theme checker
// reads (`theme/types.ts`, ADR 0072). One list feeds both: the names custom CSS may rely on are
// the names a theme may select, so the two can never disagree about what is promised.
//
// A promised selector is written as CSS (`.fc`, `header.site`, `html.dark`, `#comments`); every
// class and id in it is a name a theme may use. Its surface comes with it, except `shared`,
// which the checker counts for neither side: furniture both surfaces draw cannot show that a
// sheet styled one of them.

import type { ThemeContract, ThemeSurface } from '@/theme'
import { PROMISED_ATTRIBUTES, PROMISED_SELECTORS, PROMISED_VARS } from '@/content/appearance-contract'

/** Every `.class` and `#id` in one promised selector, in order. */
function namesIn(selector: string): { kind: 'class' | 'id'; name: string }[] {
  return [...selector.matchAll(/([.#])(-?[A-Za-z_][\w-]*)/g)].map((m) => ({
    kind: m[1] === '.' ? 'class' : 'id',
    name: m[2]!,
  }))
}

export function themeContract(): ThemeContract {
  const classes = new Set<string>()
  const ids = new Set<string>()
  // Every surface a name is promised under. A name promised under two (`header.site` and
  // `footer.site` share `.site`) belongs to the one surface only when every entry agrees.
  const seen = new Map<string, Set<string>>()
  for (const selector of PROMISED_SELECTORS) {
    for (const { kind, name } of namesIn(selector.name)) {
      ;(kind === 'class' ? classes : ids).add(name)
      const key = `${kind === 'class' ? '.' : '#'}${name}`
      seen.set(key, (seen.get(key) ?? new Set()).add(selector.surface))
    }
  }
  const surfaceOf = new Map<string, ThemeSurface>()
  for (const [key, surfaces] of seen) {
    const [only] = [...surfaces]
    if (surfaces.size === 1 && (only === 'blog' || only === 'front')) surfaceOf.set(key, only)
  }
  return {
    classes,
    ids,
    attributes: new Set(PROMISED_ATTRIBUTES.map((a) => a.name.toLowerCase())),
    surfaceOf,
    vars: new Set(PROMISED_VARS.flatMap((group) => group.vars.map((v) => v.name))),
  }
}
