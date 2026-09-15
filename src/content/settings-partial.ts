// THE PARTIAL PROTOCOL: what an absent key and a missing element mean.
//
// `PUT /api/settings` takes a DEEP PARTIAL, because the admin's one Save key sends only the
// fields that changed across seven tabs. That is what makes one button over 244 controls
// affordable, and it is also what gives ABSENCE a meaning — which is the thing nothing had
// decided until 2026-09-15, and three settings were being destroyed by it.
//
// Its own file rather than a corner of `settings-sanitize.ts`: it is not a rule about any one
// setting, it is the rule every list sanitiser has to apply before it starts.

/**
 * A PARTIAL ARRAY, WITH THE UNTOUCHED ELEMENTS PUT BACK.
 *
 * ⚠️ THIS IS WHAT STOOD BETWEEN EDITING ONE MENU ROW AND LOSING THE WHOLE MENU. The admin sends
 * a deep partial built by walking the fields that CHANGED, and a path like `menu.1.href` opens
 * an array at index 1 with a hole at 0. `JSON.stringify` writes a hole as `null`, so the server
 * received `{"menu":[null,{"href":"/about-us"}]}` — and the filter below dropped the `null` for
 * not being an object and the survivor for having no `label`, leaving `[]`. One keystroke in one
 * field, and the header menu was gone. Measured, not reasoned: three arrays behave this way, and
 * `featured` lost every slug before the one that was touched.
 *
 * A hole means "this element was not edited", so it is filled from what is stored. It cannot
 * mean "delete this element": a removal renumbers the rows and sends them all.
 *
 * It could not happen before ADR 0054 — the React admin PUT the entire settings object — so the
 * partial is what gave an absent index a meaning, and nothing had given it one.
 */
export function withHolesFilled<T>(input: unknown[], fallback: readonly T[]): unknown[] {
  const plain = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  return input
    .map((item, i) => {
      const stored = fallback[i]
      if (item === null || item === undefined) return stored
      // ⚠️ AND THE ELEMENT ITSELF IS A PARTIAL. `menu.1.href` sends `{href}` and no `label`,
      // because the label was not typed in — and a menu row with no label is dropped by the
      // rule below, so filling the holes alone still lost the row that was actually edited.
      // One field of one row is a patch ON that row, not a replacement for it.
      return plain(item) && plain(stored) ? { ...stored, ...item } : item
    })
    .filter((item) => item !== undefined)
}
