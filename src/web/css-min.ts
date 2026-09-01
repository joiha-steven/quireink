// Minify the public stylesheet, once, on the way to being hashed and served.
//
// The sheets are hand-written and heavily commented, deliberately: the comments are where
// the measurements and the reasons live, and several of them are the only record of a bug
// that was fixed by one line. But they were being SERVED. Measured 2026-07-30: of the
// 65,645 bytes the reader received, 34,438 were comment text, and every first visit paid
// for it. The prose belongs in the .ts file, not on the wire.
//
// Written by hand rather than pulled in as a dependency because the job is small and the
// two things that could go wrong are both specific to this sheet:
//
//   1. A quoted string may contain anything. This sheet has a `data:image/svg+xml` URI with
//      spaces and slashes inside it, and generated content like `content:"("`. A scanner
//      that does not know it is inside a string will corrupt both.
//   2. Whitespace is load-bearing next to a colon and inside calc(). `.book-flow :is(img,...)`
//      is a DESCENDANT selector; deleting that one space turns it into `.book-flow:is(...)`,
//      which matches something else entirely and would silently unstyle every image in book
//      mode. Same for `calc(100% + var(--rail-w))`, where CSS requires the spaces.
//
// So whitespace collapses to nothing only beside the four characters where it can never
// carry meaning, and to a single space everywhere else.

/** The characters that may absorb the whitespace next to them. Deliberately short. */
const EATS_SPACE = '{};,'

// The output is gathered into an array and joined at the end, and runs of ordinary
// characters are copied as one slice rather than a character at a time. Same scanner, same
// bytes out; what changes is the garbage. Building the result with `out += c` allocates a
// fresh rope per append, and the three sheets minified at module load come to 417 KB, so
// boot paid for roughly 417,000 of them: measured 2026-09-01, physical footprint rose 109 MB
// during those three calls and the boot peak of a running blog was 240 MB. Gathering instead
// costs 2.2 MB and the same peak is 157 MB, which is the number a container limit has to be
// set from. `public.css` alone went from 8.1 ms to 1.8 ms and produced the same 53,270 bytes.

export function minifyCss(css: string): string {
  const parts: string[] = []
  // The last character already written, standing in for `out.at(-1)` now that there is no
  // `out` to look back at. The whitespace rule reads it, so it has to track every push.
  let last = ''
  let i = 0
  const push = (s: string): void => {
    if (!s) return
    parts.push(s)
    last = s[s.length - 1]!
  }

  while (i < css.length) {
    const c = css[i]!

    // A quoted string is copied through verbatim, escapes included.
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') j++
        j++
      }
      push(css.slice(i, j + 1))
      i = j + 1
      continue
    }

    // A comment goes, and takes its own whitespace with it.
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 2
      continue
    }

    if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f') {
      let j = i
      while (j < css.length && ' \n\r\t\f'.includes(css[j]!)) j++
      const next = css[j] ?? ''
      const droppable = last === '' || next === ''
        || EATS_SPACE.includes(last) || EATS_SPACE.includes(next)
      if (!droppable) push(' ')
      i = j
      continue
    }

    // An ordinary run: everything up to the next character one of the branches above cares
    // about. This is the whole saving — the scan is unchanged, the copy is one slice.
    let j = i
    while (j < css.length) {
      const d = css[j]!
      if (d === '"' || d === "'" || (d === '/' && css[j + 1] === '*') || ' \n\r\t\f'.includes(d)) break
      j++
    }
    push(css.slice(i, j))
    i = j
  }

  // The last declaration in a block does not need its semicolon. Done here rather than in
  // the loop because it is the only rule that looks backwards.
  return parts.join('').replaceAll(';}', '}').trim()
}
