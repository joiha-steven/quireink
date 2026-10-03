// Give the kit's component classes to the admin's stylesheet, at build time.
//
// `admin-shared/component.ts` says why a component is a NAME for a utility list rather than a
// rule written by hand. This is the other half: for every rule in the built sheet that selects
// one of a component's utilities, the same selector with that utility's class swapped for the
// component's name is appended to the rule's selector list.
//
//   .rounded-md{border-radius:…}                → .rounded-md,.kit-field{border-radius:…}
//   .dark\:bg-neutral-900:where(.dark,.dark *){…} → …,.kit-field:where(.dark,.dark *){…}
//   @media (hover:hover){.hover\:bg-x:hover{…}}   → …{.hover\:bg-x:hover,.kit-btn-primary:hover{…}}
//
// Nothing moves and nothing is copied. The rule keeps its place in the sheet, inside the same
// `@layer` and `@media`, and the new selector has the old one's specificity because one class
// replaced one class. So an element wearing `kit-field` matches every rule it matched when it
// wore the list, in the same order, and nothing else — a call site that adds `w-full` or `pr-9`
// beside it gets exactly the tie-breaks it got before. That is the whole correctness argument,
// and it is the reason this is a selector rewrite rather than a generator of new rules.
//
// It works on the MINIFIED sheet (`css-min.ts` has already taken the comments out, which is what
// makes a brace a brace) and refuses, loudly, the two things that would make the argument false:
//
//   - A utility in a list that no rule selects. The name would silently not carry it, which is
//     the failure `check:admin-css` exists for, one level down.
//   - A selector holding TWO utilities of one component (`.a .b`, both in the list). Swapping
//     either one alone would say something different from swapping both, and no element can be
//     its own ancestor; nothing in the kit does this, and if something starts to, it should be a
//     decision rather than a guess made here.

/** At-rules whose block holds RULES, which are walked. Everything else is copied untouched. */
const GROUPING = /^@(media|supports|layer|container|scope)\b/

/** Markers that style a DIFFERENT element than the one wearing them. Never inside a component. */
const MARKERS = new Set(['group', 'peer', 'dark'])

/** Read one escaped identifier starting at `i` (just past the `.`): its unescaped name and end. */
function ident(css: string, i: number): { name: string; end: number } {
  let name = ''
  let j = i
  while (j < css.length) {
    const c = css[j]!
    if (c === '\\') {
      const hex = /^[0-9a-fA-F]{1,6} ?/.exec(css.slice(j + 1, j + 8))
      if (hex) {
        name += String.fromCodePoint(parseInt(hex[0].trim(), 16))
        j += 1 + hex[0].length
      } else {
        name += css[j + 1] ?? ''
        j += 2
      }
      continue
    }
    if (/[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) > 127) { name += c; j++; continue }
    break
  }
  return { name, end: j }
}

/** Split on the commas that separate selectors, not the ones inside `:is(…)` or `[…]`. */
function splitList(prelude: string): string[] {
  const out: string[] = []
  let depth = 0, quote = '', start = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]!
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '\\') i++
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { out.push(prelude.slice(start, i)); start = i + 1 }
  }
  out.push(prelude.slice(start))
  return out
}

/** Every class token in a selector: where it starts (at the `.`), where it ends, its name. */
function classes(sel: string): { start: number; end: number; name: string }[] {
  const out: { start: number; end: number; name: string }[] = []
  let bracket = 0, quote = ''
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]!
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === '\\') { i++; continue }
    if (c === '[') { bracket++; continue }
    if (c === ']') { bracket--; continue }
    if (c !== '.' || bracket > 0 || !/[A-Za-z_\\-]/.test(sel[i + 1] ?? '')) continue
    const { name, end } = ident(sel, i + 1)
    out.push({ start: i, end, name })
    i = end - 1
  }
  return out
}

/** The index of the brace closing the block that opens at `open`, quotes respected. */
function closing(css: string, open: number): number {
  let depth = 0, quote = ''
  for (let i = open; i < css.length; i++) {
    const c = css[i]!
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '/' && css[i + 1] === '*') i = css.indexOf('*/', i + 2) + 1 || css.length
    else if (c === '\\') i++
    else if (c === '"' || c === "'") quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  throw new Error('css-compose: unbalanced braces')
}

/**
 * The sheet with every component's name added beside the utilities it stands for.
 *
 * `components` is name → space-separated utility list, as `registeredComponents()` hands it.
 * Throws on a marker inside a list, on a utility no rule selects, and on a selector that holds
 * two utilities of one component — each with the component's name, because the person reading
 * the build log is the one who has to fix it.
 */
export function composeComponents(css: string, components: ReadonlyMap<string, string>): string {
  const byUtility = new Map<string, string[]>()
  for (const [name, list] of components) {
    for (const u of new Set(list.split(' ').filter(Boolean))) {
      if (MARKERS.has(u)) throw new Error(`css-compose: ${name} holds the marker "${u}" — write it beside the name instead`)
      byUtility.set(u, [...(byUtility.get(u) ?? []), name])
    }
  }
  const seen = new Set<string>()

  const rewrite = (prelude: string): string => {
    const added: string[] = []
    for (const sel of splitList(prelude)) {
      const hits = classes(sel)
      const perComponent = new Map<string, number>()
      for (const hit of hits) {
        for (const name of byUtility.get(hit.name) ?? []) {
          perComponent.set(name, (perComponent.get(name) ?? 0) + 1)
          if (perComponent.get(name)! > 1) {
            throw new Error(`css-compose: ${name} would be swapped in twice in ${JSON.stringify(sel)}`)
          }
          seen.add(hit.name)
          added.push(`${sel.slice(0, hit.start)}.${name}${sel.slice(hit.end)}`)
        }
      }
    }
    const fresh = [...new Set(added)]
    return fresh.length ? `${prelude},${fresh.join(',')}` : prelude
  }

  const walk = (from: number, to: number): string => {
    let out = ''
    let start = from
    let quote = ''
    for (let i = from; i < to; i++) {
      const c = css[i]!
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
      // An ESCAPE outside a string is part of a selector — `.before\:content-\[\'\'\]` — and its
      // quote opens nothing. Reading it as one swallowed the rest of the sheet as a "string".
      if (c === '\\') { i++; continue }
      // A comment should not be here at all — the sheet is minified first — but one that is
      // must not have its apostrophes read as quotes, which is the same fault one level up.
      if (c === '/' && css[i + 1] === '*') { i = (css.indexOf('*/', i + 2) + 1) || to; continue }
      if (c === '"' || c === "'") { quote = c; continue }
      if (c === ';' || c === '}') {
        // A statement at-rule (`@layer a, b;`) or a stray close: copied as it stands.
        out += css.slice(start, i + 1)
        start = i + 1
        continue
      }
      if (c !== '{') continue
      const prelude = css.slice(start, i)
      const close = closing(css, i)
      const head = prelude.trim()
      if (GROUPING.test(head)) out += `${prelude}{${walk(i + 1, close)}}`
      else if (head.startsWith('@')) out += css.slice(start, close + 1)
      else out += `${rewrite(prelude)}${css.slice(i, close + 1)}`
      i = close
      start = close + 1
    }
    return out + css.slice(start, to)
  }

  const composed = walk(0, css.length)
  for (const [name, list] of components) {
    const missing = list.split(' ').filter((u) => u && !seen.has(u))
    if (missing.length) throw new Error(`css-compose: ${name} names ${missing.join(', ')}, which no rule in the sheet selects`)
  }
  return composed
}
