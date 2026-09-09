// Where a reader's mark sits in the text, and how it is found again.
//
// A mark is anchored to WORDS, never to positions: the sentence the reader chose, plus a
// few dozen characters either side of it (a text-quote selector, the shape the W3C Web
// Annotation model uses). Positions break the moment the owner fixes a typo three
// paragraphs up; a quote survives every edit that leaves its sentence alone, and when the
// sentence itself is gone the mark quietly fails to land rather than landing on the wrong
// words — which is the only acceptable failure for something a reader drew.
//
// Pure DOM, no state: `reader-pen.ts` owns the marks and the storage, this owns the maths.

export type Selector = { exact: string; prefix: string; suffix: string }

/** How much either side of a quote is kept to tell two occurrences apart. */
const CONTEXT = 32

type Seg = { node: Text; start: number }
export type Flat = { text: string; segs: Seg[] }

/**
 * The article as one string, and which text node each stretch of it came from.
 *
 * Everything the reader can see is in it, in document order. Subtrees marked
 * `data-pen-skip` are not — the note cards this island itself puts on the page — so the
 * words the reader wrote beside a mark never become part of the anchor of another.
 */
export function flatten(root: Node): Flat {
  const segs: Seg[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = (n as Text).parentElement
      return p?.closest('[data-pen-skip],script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    segs.push({ node: n as Text, start: text.length })
    text += (n as Text).data
  }
  return { text, segs }
}

/** A boundary point (container, offset) as an offset into the flat text. */
function pointOffset(flat: Flat, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const seg = flat.segs.find((s) => s.node === container)
    return seg ? seg.start + offset : 0
  }
  const child = container.childNodes[offset]
  if (child) {
    // The first text at or after the child, in document order.
    const seg = flat.segs.find((s) => s.node === child
      || (child.compareDocumentPosition(s.node) & (Node.DOCUMENT_POSITION_CONTAINED_BY | Node.DOCUMENT_POSITION_FOLLOWING)) !== 0)
    return seg ? seg.start : flat.text.length
  }
  // Past the last child: the end of whatever text the container holds.
  let end = 0
  for (const s of flat.segs) if (container.contains(s.node)) end = s.start + s.node.data.length
  return end || flat.text.length
}

/** The selector for a live selection inside `root`. */
export function selectorFor(flat: Flat, range: Range): Selector | null {
  const start = pointOffset(flat, range.startContainer, range.startOffset)
  const end = pointOffset(flat, range.endContainer, range.endOffset)
  if (end <= start) return null
  return {
    exact: flat.text.slice(start, end),
    prefix: flat.text.slice(Math.max(0, start - CONTEXT), start),
    suffix: flat.text.slice(end, end + CONTEXT),
  }
}

/** How many characters two strings share at the seam — `a`'s end against `b`'s end. */
const sharedEnd = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
const sharedStart = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/**
 * Find the quote in the text. Every occurrence of `exact` is a candidate and the one whose
 * surroundings agree best with the stored prefix and suffix wins; if the exact string is
 * nowhere (whitespace re-flowed, say), the same words are tried with any run of whitespace
 * allowed between them. Null when the words are gone.
 */
export function locate(flat: Flat, sel: Selector): { start: number; end: number } | null {
  const { text } = flat
  let best: { start: number; end: number; score: number } | null = null
  const consider = (start: number, end: number) => {
    const score = sharedEnd(text.slice(Math.max(0, start - CONTEXT), start), sel.prefix)
      + sharedStart(text.slice(end, end + CONTEXT), sel.suffix)
    if (!best || score > best.score) best = { start, end, score }
  }
  for (let at = text.indexOf(sel.exact); at !== -1; at = text.indexOf(sel.exact, at + 1)) {
    consider(at, at + sel.exact.length)
  }
  if (!best && sel.exact.trim()) {
    const loose = new RegExp(sel.exact.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g')
    for (let m = loose.exec(text); m; m = loose.exec(text)) consider(m.index, m.index + m[0].length)
  }
  return best
}

/** A live range over flat offsets [start, end). */
export function rangeFrom(flat: Flat, start: number, end: number): Range | null {
  const at = (offset: number, closing: boolean) => {
    for (const s of flat.segs) {
      const len = s.node.data.length
      if (offset >= s.start && (offset < s.start + len || (closing && offset === s.start + len))) {
        return { node: s.node, offset: offset - s.start }
      }
    }
    return null
  }
  const a = at(start, false), b = at(end, true)
  if (!a || !b) return null
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  return range
}

/**
 * Wrap the text inside a range, one wrapper per text node it touches — the way a pen
 * crosses a bold word or a link without lifting: each run of text under the stroke gets
 * its own element, and the stroke reads as one. Whitespace-only nodes between blocks are
 * left alone, or the gaps between paragraphs would grow blobs of ink.
 */
export function wrap(range: Range, make: () => HTMLElement): HTMLElement[] {
  if (range.collapsed) return []
  // Split the boundary text nodes so the wrappers hold exactly the chosen characters.
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    const t = range.endContainer as Text
    if (range.endOffset < t.data.length) t.splitText(range.endOffset)
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const t = range.startContainer as Text
    if (range.startOffset > 0) {
      const rest = t.splitText(range.startOffset)
      range.setStart(rest, 0)
      if (range.endContainer === t) range.setEnd(rest, rest.data.length)
    }
  }
  const nodes: Text[] = []
  // Once the boundaries are split a selection inside one text node has that node as its
  // common ancestor, and a walker never yields its own root — so walk from the parent.
  const cac = range.commonAncestorContainer
  const root = cac.nodeType === Node.TEXT_NODE ? cac.parentNode! : cac
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (range.intersectsNode(n) && /\S/.test((n as Text).data)
      && !(n as Text).parentElement?.closest('[data-pen-skip]')) nodes.push(n as Text)
  }
  return nodes.map((n) => {
    const w = make()
    n.parentNode!.insertBefore(w, n)
    w.appendChild(n)
    return w
  })
}

/** Take a mark off the page, leaving its words exactly where they were. */
export function unwrap(elements: Iterable<Element>): void {
  for (const w of elements) {
    const parent = w.parentNode
    if (!parent) continue
    while (w.firstChild) parent.insertBefore(w.firstChild, w)
    parent.removeChild(w)
    parent.normalize()
  }
}
