// A snippet for a tour expression that reads rules out of the page's stylesheets.
//
// The public sheets are served inside `@layer base` and `@layer theme` (ADR 0072,
// `src/web/css-layers.ts`), so their media blocks sit one level down rather than at the top of
// `cssRules`, and a flow that lifts a rule out to apply it has to put it back in its layer or it
// weighs more than the real one does.

/** Defines `unlayer(list)`: every rule of a sheet as `{ rule, layer }`, layer '' when none. */
export const UNLAYER = `
  const unlayer = (list, layer = '') => [...list].flatMap((r) => r instanceof CSSLayerBlockRule
    ? unlayer(r.cssRules, layer ? layer + '.' + r.name : r.name) : [{ rule: r, layer }])`
