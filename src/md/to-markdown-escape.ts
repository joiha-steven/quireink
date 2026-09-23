// WHAT ONE PIECE OF TEXT MAY BE WRITTEN AS.
//
// Split out of `to-markdown.ts` on 2026-09-21, when a fix to its line-start rules put that file
// over the 400-line ceiling. The seam is the one that file's own header already names:
// "Escaping is the other half." Everything left there decides STRUCTURE — which block follows
// which, how a list indents, where a table's pipes go. Everything here decides what a run of
// characters has to become so that reading it back produces the same characters.
//
// The two are read at different moments. Somebody chasing a paragraph that split in half comes
// here; somebody chasing a list that lost its nesting does not.

import type { Inline } from './ast'
import { entityStarts } from './entity'
import { INK_SYNTAX_GLOBAL, RING_SYNTAX_GLOBAL, UNDER_SYNTAX_GLOBAL } from '@/pen/grammar'
import { labelText, loneBrackets } from './label'

/**
 * Where a pen stroke WOULD be found on the way back in — the only places worth a backslash.
 *
 * ⚠️ IT ASKS THE GRAMMAR RATHER THAN RESTATING IT, which is the rule `pen/grammar.ts` states
 * about itself and the one this function got wrong twice. A first version escaped every `==`,
 * so `x == y and z == w` came back as `x \== y and z \== w` — an author opening their own post
 * to find backslashes they never typed. A second version escaped a pair followed by a
 * non-space, which is the OPENING guard, and that escaped `++i` in `C++ và ++i` where no
 * closing pair exists anywhere and no stroke could ever form.
 *
 * A pair is only dangerous when the whole shape is there. Running the three real patterns says
 * so exactly, and it stays true the day the grammar changes: over-escaping corrupts what the
 * writer sees, under-escaping corrupts what the next read produces, and only the grammar knows
 * where the line is.
 */
export function penOpeners(text: string): Set<number> {
  const at = new Set<number>()
  for (const re of [INK_SYNTAX_GLOBAL, UNDER_SYNTAX_GLOBAL, RING_SYNTAX_GLOBAL]) {
    re.lastIndex = 0
    for (let m = re.exec(text); m !== null; m = re.exec(text)) at.add(m.index)
  }
  return at
}

/**
 * The pairing decided for the label being written, consumed by `escapeText` as it reaches each
 * bracket. ⚠️ A LABEL ENDS AT THE FIRST UNESCAPED `]`, so the rule below — escape the opening
 * bracket, never the closing one — destroyed any link whose text held one. `md/label.ts` has
 * the measurement, and why escaping both is the trap next door rather than the repair.
 */
let labelMarks: { lone: Set<number>; seen: number } | null = null

/**
 * A link's label or an image's alt text, with only its unpartnered brackets escaped.
 *
 * Held and restored rather than cleared, because a label can hold an image whose alt is a label
 * of its own: the inner one must give the outer its count back, not a fresh one.
 */
/**
 * ⚠️ THE SCOPE IS HANDED BACK, not the rendered label, and that is what keeps this file from
 * importing the one that imports it. Serialising a label needs `inlineToMarkdown`, which is
 * structure and lives next door; what is needed HERE is only the bracket bookkeeping. So the
 * caller opens a scope, renders, and closes it.
 */
export function openLabel(nodes: Inline[]): { lone: Set<number>; seen: number } | null {
  const held = labelMarks
  labelMarks = { lone: loneBrackets(labelText(nodes)), seen: 0 }
  return held
}

export function closeLabel(held: { lone: Set<number>; seen: number } | null): void {
  labelMarks = held
}

/**
 * Escape what would otherwise be read as syntax on the way back in.
 *
 * POSITIONAL, not blanket. A `#` is a heading only at the start of a line; a `-` is a bullet
 * only there too; `.` after digits opens an ordered list only there. Escaping them everywhere
 * is what fills a paragraph with backslashes — and the characters that ARE syntax anywhere
 * (`*`, `_`, `[`, `` ` ``, `<`, `&`) are the short list below.
 */
export function escapeText(value: string, atLineStart: boolean): string {
  // ⚠️ THE CLOSING BRACKET IS NOT ESCAPED, and that is a rule about THIS blog rather than
  // about Markdown. `\[ … \]` is display maths here (ADR 0020), so a serializer that escapes
  // both brackets turns any `[word]` in ordinary prose into a formula on the SECOND save:
  //
  //     [two][missing]   →   \[two\]\[missing\]   →   $$two$$$$missing$$
  //
  // Caught by the round trip on `golden/corpus/reference-links.md`, which is exactly what a
  // round trip is for — the first save looked fine.
  //
  // Escaping only the opening bracket is enough and is safe: `\[two]` reads back as the text
  // `[two]`, it cannot open a link, and it is not a formula because a formula needs `\]`.
  // `>` is likewise left alone here and handled at the start of a line below, where it is the
  // only place it means anything.
  //
  // The pen's three pairs come first and are computed on the RAW text, because they are found
  // by position and every escape inserted before them would move the positions.
  const strokes = penOpeners(value)
  // `&` IS ESCAPED ONLY WHERE IT OPENS AN ENTITY, for the reason on `entityStarts`: a bare
  // ampersand means nothing in Markdown, and `M&A` coming back as `M\&A` is a backslash the
  // author never typed, in 44 of this blog's 92 posts.
  const entities = entityStarts(value)
  let out = ''
  for (let i = 0; i < value.length; i++) {
    if (strokes.has(i) || entities.has(i)) out += '\\'
    const ch = value[i]!
    if (labelMarks !== null && (ch === '[' || ch === ']')) {
      out += labelMarks.lone.has(labelMarks.seen++) ? `\\${ch}` : ch
      continue
    }
    out += /[\\`*_[<]/.test(ch) ? `\\${ch}` : ch
  }
  // ⚠️ EVERY LINE INSIDE THE VALUE, not only the first — and ⚠️ NOTHING REACHABLE PUTS ONE
  // THERE TODAY, which is said out loud rather than left for the next reader to discover.
  //
  // `atLineStart` answers "does this NODE begin a line", which is a different question from
  // "is this position a line start". A text node holding its own newline would have its
  // continuation escaped by neither, so a paragraph whose second line began `#`, `>`, `-`, `+`
  // or `1.` came back as TWO BLOCKS on the next parse: the author's one paragraph split into a
  // paragraph and a heading. Reproduced by building the node by hand — four of six shapes broke
  // it, and the two that survived did so only by having trailing text on the line.
  //
  // All three real callers avoid the shape, and each was checked on 2026-09-21 rather than
  // assumed: the parser emits `softbreak` nodes (`parse('a\nb')` has three children, not one),
  // `from-editor.ts` splits on `\n` before it ever reaches here, and `import/convert.ts`
  // collapses HTML whitespace to spaces. So this is the SMTP-header argument rather than a
  // live fix: the rule belongs to the code that writes the format, not to the three callers
  // that happen to be careful. A fourth — a paste handler, another importer — gets it free.
  //
  // Guarded on a `\n` being there at all, so the ordinary text node pays one `includes` and
  // not three global regexes.
  if (out.includes('\n')) {
    out = out.replace(/\n(\s*)([#>+-])/g, '\n$1\\$2')
    out = out.replace(/\n(\s*)(\d+)([.)])/g, '\n$1$2\\$3')
    // A RUN OF `=` ON ITS OWN LINE is a setext underline, which would eat the line above it.
    // Escaped only in that exact shape: `=` is ordinary punctuation everywhere else, and a
    // backslash the author never typed is the failure the `&` rule above was written to avoid.
    out = out.replace(/\n(\s*)(=+)(?=\n|$)/g, '\n$1\\$2')
  }
  if (atLineStart) {
    out = out.replace(/^(\s*)([#>+-])/, '$1\\$2')
    out = out.replace(/^(\s*)(\d+)([.)])/, '$1$2\\$3')
    // The same setext rule as above, for a node that begins its line after a break.
    out = out.replace(/^(\s*)(=+)(?=\n|$)/, '$1\\$2')
  }
  // ⚠️ TWO SHAPES COME BACK OUT, and leaving them escaped is the exact bug that cost 19 of 45
  // golden fixtures in August. A footnote reference `[^1]` and a callout's `[!NOTE]` live in
  // the document as plain text — neither has a node — so the bracket escaping above turns them
  // into `\[^1\]` and `\[!NOTE\]` on save. Worse than literal text: `\[…\]` is LaTeX display
  // maths, which this renderer supports, so a footnote reference published as a line break and
  // an EMPTY FORMULA in the middle of a sentence, and `[!NOTE]` came out as MathML spelling
  // the letters. The repair is `ReaderSyntax.ts`'s, and it is the smallest one that is true:
  // un-escape the two COMPLETE shapes the renderer treats as syntax. A lone `\[`, a half
  // written `\[^` — still escaped.
  return out.replace(/\\\[\^([^\][\\]+)\]/g, '[^$1]').replace(/\\\[!([^\][\\]+)\]/g, '[!$1]')
}
