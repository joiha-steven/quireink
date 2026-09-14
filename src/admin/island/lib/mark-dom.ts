// A `Mark` tree into real nodes, for the browser half of ADR 0054's assistant.
//
// The twin of `src/web/admin/mark-html.ts`. Same walk, same order, same attributes — and the
// same safety property, from the other direction: text is set with `textContent`, so a model's
// answer containing `<script>` is four words on the page and nothing else, without this file
// having to know anything about escaping.
//
// In `island/lib/` and not beside the islands: `scripts/build-admin.ts` globs `*.ts` in
// `island/` and that glob does not recurse, so a file one directory down is a module rather
// than a browser entry of its own.
import type { Mark } from '@/admin-shared/markup'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The tags that belong to the SVG namespace, which `createElement` would get wrong. */
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'g', 'polyline', 'polygon'])

/** One mark as a node. */
export function elOf(mark: Mark, svg = false): Node {
  if (mark.tag === '') return document.createTextNode(mark.text ?? '')
  const inSvg = svg || SVG_TAGS.has(mark.tag)
  const node = inSvg
    ? document.createElementNS(SVG_NS, mark.tag)
    : document.createElement(mark.tag)
  if (mark.cls) node.setAttribute('class', mark.cls)
  for (const [k, v] of Object.entries(mark.attrs ?? {})) node.setAttribute(k, v)
  if (mark.kids) for (const kid of mark.kids) node.appendChild(elOf(kid, inSvg))
  else if (mark.text !== undefined) node.textContent = mark.text
  return node
}

/** A list of marks in one fragment, so a rebuild is a single insertion. */
export function fragOf(marks: Mark[]): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const m of marks) frag.appendChild(elOf(m))
  return frag
}

/** Replace everything inside an element with a freshly built list. */
export function fill(host: Element, marks: Mark[]): void {
  host.replaceChildren(fragOf(marks))
}
