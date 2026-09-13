// The delimiter stack, and the algorithm that turns runs of `*` and `_` into emphasis.
//
// THIS IS THE PART THAT CANNOT BE DONE IN ONE PASS. Reading `*foo bar*` left to right, the
// first `*` cannot be resolved when it is met — whether it opens anything depends on what
// turns up later, and `*foo` with no closer is just an asterisk. So the scan records every
// run of delimiters as it goes and the matching happens afterwards, walking the stack.
//
// The inlines are held as a DOUBLY LINKED LIST rather than an array for the same reason. The
// algorithm reaches back to a delimiter it passed, takes everything between it and the
// current position, and wraps it — an operation that is three pointer moves in a list and a
// pair of index-shifting splices in an array, with every delimiter's remembered position
// invalidated by each one.
//
// The rules below are CommonMark's, and the two that look arbitrary are not:
//
//   - LEFT- AND RIGHT-FLANKING decide whether a run may open or close, by what sits on either
//     side of it. It is what makes `a*b*c` emphasis and `a * b * c` three asterisks, and what
//     makes `_` behave differently from `*` inside a word: `snake_case_name` keeps its
//     underscores while `snake*case*name` does not.
//   - THE RULE OF THREE. When a run could both open and close, a match is refused if the sum
//     of the two run lengths is a multiple of three and neither is itself. Without it,
//     `***a***b***` and its relatives parse differently depending on which end you start
//     from, and the spec has eleven examples that exist only to pin this down.

import type { Inline } from './ast'

export type Chunk = {
  node: Inline
  prev: Chunk | null
  next: Chunk | null
}

export type Delim = {
  chunk: Chunk
  char: string
  /** How many of the run are still unused. */
  count: number
  /** How many there were to start with — the rule of three reads this, not `count`. */
  origCount: number
  canOpen: boolean
  canClose: boolean
  /** For `[`: cleared when a link is built, so links cannot nest inside links. */
  active: boolean
  prev: Delim | null
  next: Delim | null
}

/** The inlines of one run of text, as a list that can be spliced. */
export class ChunkList {
  head: Chunk | null = null
  tail: Chunk | null = null

  push(node: Inline): Chunk {
    const chunk: Chunk = { node, prev: this.tail, next: null }
    if (this.tail) this.tail.next = chunk
    else this.head = chunk
    this.tail = chunk
    return chunk
  }

  unlink(chunk: Chunk): void {
    if (chunk.prev) chunk.prev.next = chunk.next
    else this.head = chunk.next
    if (chunk.next) chunk.next.prev = chunk.prev
    else this.tail = chunk.prev
    chunk.prev = null
    chunk.next = null
  }

  /** Put `node` directly after `at`, and answer with its chunk. */
  insertAfter(at: Chunk, node: Inline): Chunk {
    const chunk: Chunk = { node, prev: at, next: at.next }
    if (at.next) at.next.prev = chunk
    else this.tail = chunk
    at.next = chunk
    return chunk
  }

  /** Everything from `from` up to but not including `to`, removed and returned in order. */
  take(from: Chunk | null, to: Chunk | null): Inline[] {
    const out: Inline[] = []
    let cur = from
    while (cur && cur !== to) {
      const next = cur.next
      this.unlink(cur)
      out.push(cur.node)
      cur = next
    }
    return out
  }

  toArray(): Inline[] {
    const out: Inline[] = []
    for (let cur = this.head; cur; cur = cur.next) {
      // A text chunk emptied by the delimiters taken out of it carries nothing.
      if (cur.node.type === 'text' && cur.node.value === '') continue
      const last = out[out.length - 1]
      if (cur.node.type === 'text' && last && last.type === 'text') last.value += cur.node.value
      else out.push(cur.node)
    }
    return out
  }
}

/** The stack, as a list so a delimiter can be removed from the middle. */
export class DelimStack {
  top: Delim | null = null

  push(chunk: Chunk, char: string, count: number, canOpen: boolean, canClose: boolean): Delim {
    const delim: Delim = {
      chunk, char, count, origCount: count, canOpen, canClose, active: true, prev: this.top, next: null,
    }
    if (this.top) this.top.next = delim
    this.top = delim
    return delim
  }

  remove(delim: Delim): void {
    if (delim.prev) delim.prev.next = delim.next
    if (delim.next) delim.next.prev = delim.prev
    else this.top = delim.prev
  }

  /** Drop everything above `bottom`, which is what happens once a run is finished with. */
  clearAbove(bottom: Delim | null): void {
    while (this.top && this.top !== bottom) this.remove(this.top)
  }
}

// Unicode punctuation and whitespace, as CommonMark 0.31.2 defines them for flanking.
const PUNCT = /[\p{P}\p{S}]/u
const SPACE = /[\s\p{Zs}]/u

/** Whether a run of `char` at `pos` may open emphasis, may close it, or both. */
export function scanDelims(
  text: string, pos: number, char: string,
): { count: number; canOpen: boolean; canClose: boolean } {
  let count = 0
  let i = pos
  while (text[i] === char) {
    count++
    i++
  }
  const before = pos === 0 ? '\n' : text[pos - 1]!
  const after = i >= text.length ? '\n' : text[i]!

  const afterSpace = SPACE.test(after)
  const afterPunct = PUNCT.test(after)
  const beforeSpace = SPACE.test(before)
  const beforePunct = PUNCT.test(before)

  const leftFlanking = !afterSpace && (!afterPunct || beforeSpace || beforePunct)
  const rightFlanking = !beforeSpace && (!beforePunct || afterSpace || afterPunct)

  // `_` may not open or close inside a word: intra-word underscores are how identifiers are
  // written, and emphasising the middle of `foo_bar_baz` is never what somebody meant.
  const canOpen = char === '_' ? leftFlanking && (!rightFlanking || beforePunct) : leftFlanking
  const canClose = char === '_' ? rightFlanking && (!leftFlanking || afterPunct) : rightFlanking
  return { count, canOpen, canClose }
}

/**
 * Match every closer with its opener, from `bottom` up, and wrap what lies between.
 *
 * `bottom` is null for the whole run and a bracket's delimiter when a link has just been
 * built: the emphasis inside a link's text is resolved when the link closes, and must not be
 * matched against delimiters outside it.
 */
export function processEmphasis(list: ChunkList, stack: DelimStack, bottom: Delim | null): void {
  // How far back the search for an opener may go, per character and per length-mod-3. Without
  // this the algorithm is quadratic on input like `*a_b*c_d*e_f*` — it rescans the same
  // hopeless openers for every closer.
  const openersBottom: Record<string, (Delim | null)[]> = {
    '*': [bottom, bottom, bottom, bottom],
    _: [bottom, bottom, bottom, bottom],
  }

  let closer = stack.top
  while (closer && closer.prev !== bottom) closer = closer.prev

  while (closer) {
    if (!closer.canClose || (closer.char !== '*' && closer.char !== '_')) {
      closer = closer.next
      continue
    }

    const limit = openersBottom[closer.char]![closer.origCount % 3]
    let opener = closer.prev
    let found = false
    while (opener && opener !== bottom && opener !== limit) {
      // THE RULE OF THREE.
      const oddMatch =
        (closer.canOpen || opener.canClose) &&
        closer.origCount % 3 !== 0 &&
        (opener.origCount + closer.origCount) % 3 === 0
      if (opener.char === closer.char && opener.canOpen && !oddMatch) {
        found = true
        break
      }
      opener = opener.prev
    }

    const oldCloser = closer

    if (!found || !opener) {
      // Nothing back there can open this. Remember how far we got, so the next closer of the
      // same shape does not repeat the walk, and drop a delimiter that can only close.
      openersBottom[oldCloser.char]![oldCloser.origCount % 3] = oldCloser.prev
      closer = closer.next
      if (!oldCloser.canOpen) stack.remove(oldCloser)
      continue
    }

    // Two delimiters make strong, one makes emphasis; a longer run gives up two at a time.
    const use = closer.count >= 2 && opener.count >= 2 ? 2 : 1
    opener.count -= use
    closer.count -= use
    const openText = opener.chunk.node as Extract<Inline, { type: 'text' }>
    const closeText = closer.chunk.node as Extract<Inline, { type: 'text' }>
    openText.value = openText.value.slice(0, openText.value.length - use)
    closeText.value = closeText.value.slice(0, closeText.value.length - use)

    const children = list.take(opener.chunk.next, closer.chunk)
    const wrapped: Inline = use === 1 ? { type: 'emph', children } : { type: 'strong', children }
    list.insertAfter(opener.chunk, wrapped)

    // Every delimiter between the two is now inside the wrapper and can match nothing.
    let between = opener.next
    while (between && between !== closer) {
      const next = between.next
      stack.remove(between)
      between = next
    }

    if (opener.count === 0) {
      list.unlink(opener.chunk)
      stack.remove(opener)
    }
    if (closer.count === 0) {
      list.unlink(closer.chunk)
      const next = closer.next
      stack.remove(closer)
      closer = next
    }
  }

  stack.clearAbove(bottom)
}
