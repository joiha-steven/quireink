// WHERE A SETTING IS ON THE PAGE, given the words the search index knows it by.
//
// The index (`admin-shared/settings-index.ts`) holds a dictionary key per setting, and the
// search row carries that key's text as `data-label`. Landing on the setting means finding the
// element that prints those words and the row around it. Pure DOM, no state, so the whole index
// can be checked against the rendered tabs (`settings-find.test.ts`) rather than one row at a time.

/** Text written directly inside `el`, not inside its children: a label with a badge beside it. */
const ownText = (el: Element): string =>
  [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim()

const says = (label: string) => (el: Element): boolean =>
  el.textContent?.trim() === label || ownText(el) === label

/**
 * The row to scroll to and ring, or null.
 *
 * In order of how sure the match is: a setting's own label (`label`, `.kit-label`, the older
 * `.block`); a card or group title, for an entry that names a whole card; a key, for an entry
 * that is an action; then a bare line of text, for the few labels drawn outside the kit.
 *
 * ⚠️ OWN TEXT AS WELL AS ALL OF IT. A switch whose label carries a badge ("Dynamic share image
 * (OG image)" with `/og` beside it) has a `textContent` that is the label AND the badge, and
 * matching on the whole of it found nothing: the search opened the tab and pointed nowhere.
 */
export function findSetting(scope: ParentNode, label: string): HTMLElement | null {
  if (!label) return null
  const match = says(label)
  const label_ = [...scope.querySelectorAll<HTMLElement>('label, .kit-label, .block')].find(match)
  if (label_) return label_.closest<HTMLElement>('.setting-row, .block, [data-k]') ?? label_
  const title = [...scope.querySelectorAll<HTMLElement>('h2, h3')].find(match)
  if (title) return title.closest<HTMLElement>('section') ?? title
  const key = [...scope.querySelectorAll<HTMLElement>('button')].find(match)
  if (key) return key
  return [...scope.querySelectorAll<HTMLElement>('p, span, div')]
    .find((el) => el.childElementCount === 0 && match(el)) ?? null
}
