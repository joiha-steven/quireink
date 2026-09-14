// A `Mark` tree into HTML, for the server half of ADR 0054's assistant.
//
// Twenty lines with one job, and the reason it is that small is the point: it is handed a tree
// that already says what every element is, so there is no string it could be tricked into
// treating as markup. A model's answer, a tool's result and an owner's question all arrive as
// `text` on a leaf, and every one of them goes through `escapeHtml`.
//
// Its twin is `src/admin/island/lib/mark-dom.ts`, which does the same walk with real nodes.
// `src/web/admin/screens/assistant.test.ts` holds the two to the same answer.
import { escapeAttr, escapeHtml } from '@/utils'
import { ICONS, type IconName } from '@/icons'
import { VOID_TAGS, type Mark } from '@/admin-shared/markup'

const attrsOf = (m: Mark): string => {
  const out: string[] = []
  if (m.cls) out.push(` class="${escapeAttr(m.cls)}"`)
  for (const [k, v] of Object.entries(m.attrs ?? {})) {
    out.push(v === '' ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`)
  }
  return out.join('')
}

/** One mark, or a list of them, as markup. */
export function htmlOf(mark: Mark | Mark[]): string {
  if (Array.isArray(mark)) return mark.map(htmlOf).join('')
  // A bare text node: the sentence between two bold words, and nothing around it.
  if (mark.tag === '') return escapeHtml(mark.text ?? '')
  const open = `<${mark.tag}${attrsOf(mark)}>`
  if (VOID_TAGS.has(mark.tag)) return open
  // THE ONE THING A TREE OF MARKS CANNOT SAY ON ITS OWN: a drawing. `data-glyph` names a shape
  // in `@/icons`, which is a frozen table of strings written in this repo — it is never a value
  // that arrived with a request, so this is the only markup either renderer inserts, and it can
  // only ever be one of the twenty-odd shapes that table holds.
  const drawing = mark.attrs?.['data-glyph']
  if (drawing) return `${open}${ICONS[drawing as IconName] ?? ''}</${mark.tag}>`
  const body = mark.kids ? htmlOf(mark.kids) : escapeHtml(mark.text ?? '')
  return `${open}${body}</${mark.tag}>`
}
