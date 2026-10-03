// THE KIT'S COMPONENT CLASSES: one short name in the markup, standing for a long utility list.
//
// WHY THEY EXIST. Every admin screen is server-rendered HTML (ADR 0054), and the kit's
// primitives were written as utility strings — so every field, key and switch carried its whole
// class list into the page, once per control. Measured 2026-10-03 on `/admin/settings`: 880 KB of
// HTML, 505 KB of it inside `class` attributes, one field's 516-character list repeated 93 times
// and one button's 856-character list 28 times. The page was mostly the same few sentences of
// CSS vocabulary, said again for every control.
//
// WHY A NAME AND NOT A HAND-WRITTEN RULE. The obvious move is a `.kit-field { … }` in
// `admin.css` with the declarations typed out. That is a second copy of every utility it uses,
// translated by hand — `utilities.css` records exactly why the admin stopped doing that (one right
// expansion per utility, and the composed ones need the custom-property technique or a second
// utility silently overwrites the first) — and it would put the component OUTSIDE
// `@layer utilities`, where it would start beating the extra utilities a call site adds beside
// it. So the list stays the definition, written once where it always was, and
// `web/css-compose.ts` gives the name to the stylesheet at build time: wherever a rule selects one
// of the list's utilities, the name is added to that rule's selector list. Same rule, same
// position in the sheet, same layer, same specificity (one class for one class) — an element
// wearing the name matches exactly the rules it matched when it wore the list, in the same
// order, which is what "looks identical" has to mean for a stylesheet.
//
// WHAT MAY GO IN A LIST: utilities, and the admin's own styling classes. NOT a hook — a class an
// island or a test looks for (`admin-note`, `font-mono` on the hex field) stays written out
// beside the name, because `classList.contains` cannot see through it. NOT a marker that styles
// something else (`group`, `peer`, `dark`): the build refuses those, because `.group:hover .x`
// names the PARENT and a name standing in for it would select the wrong element.
//
// EVERYTHING IN THIS DIRECTORY IS FRAMEWORK-FREE (see the head of `kit.ts`). This file is read
// by the server, by the islands, and by `scripts/build-admin.ts`.

const REGISTRY = new Map<string, string>()

/**
 * Register `utilities` under `name` and hand back the name, which is what the markup wears.
 *
 * `kit-` and nothing else, so a component can never be mistaken for a utility of the same
 * spelling and `check:admin-css` can find every one of them in the source. Registering the same
 * name twice with a different list is a bug in this tree and throws rather than picking one.
 */
export function component(name: string, utilities: string): string {
  if (!/^kit-[a-z0-9-]+$/.test(name)) throw new Error(`component: ${JSON.stringify(name)} must be kit-*`)
  const list = utilities.trim().replace(/\s+/g, ' ')
  const had = REGISTRY.get(name)
  if (had !== undefined && had !== list) throw new Error(`component: ${name} registered twice, differently`)
  REGISTRY.set(name, list)
  return name
}

/**
 * The list a name stands for — for a component DERIVED from another one, which is how the kit
 * already says "the same thing, differing in exactly this" (`CONTROL_GROUP` is the field's chrome
 * with its focus moved to `focus-within`). Derive from the list, never re-type it.
 */
export function utilitiesOf(name: string): string {
  const list = REGISTRY.get(name)
  if (list === undefined) throw new Error(`utilitiesOf: ${name} is not a registered component`)
  return list
}

/**
 * A class string with every component name replaced by the list it stands for — what the
 * element is styled as, which is what a test about a primitive's LOOK has to read. A test that
 * asserted `toContain('bg-[var(--pen)]')` on the name would pass or fail on the spelling of a
 * name, which is not the property it was written to hold.
 */
export const expandComponents = (className: string): string =>
  className.split(/\s+/).map((c) => REGISTRY.get(c) ?? c).join(' ')

/** Every component registered so far, name → list. The build reads it through `components.ts`. */
export const registeredComponents = (): ReadonlyMap<string, string> => REGISTRY
