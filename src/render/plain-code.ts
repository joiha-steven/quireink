// A code block that belongs to no language, marked only where the marking cannot be wrong.
//
// WHY NOT JUST PICK A GRAMMAR. Measured before writing this, on a block of Vietnamese
// pseudocode from a real post: forced through `bash`, Shiki coloured `id` and `nếu` as
// commands and swallowed the run `tìm cert có … trùng` as a string, because it read the one
// pair of quotes as shell quoting. Six words of prose in the string colour is not richer than
// plain — it is a page that looks broken. A grammar is a claim about what the text IS, and for
// an untagged fence there is no such claim to make.
//
// WHAT IS TRUE ANYWAY. Two things survive not knowing the language, and only two:
//
//   • a run inside a matched pair of quotes, on one line, is quoted material — in shell, in
//     pseudocode, in a config file, in a log line;
//   • `$NAME` and `${NAME}` is a substitution, and there is no notation in which it reads as
//     ordinary words.
//
// Nothing else made the cut. Numbers are prose ("chín mươi ngày" is not code). A leading `#`
// is a comment in six languages and a heading in Markdown and a channel in a chat log.
// Keywords belong to grammars. So this marks two kinds of thing and leaves every other
// character exactly as the writer typed it.
//
// It runs ONLY when `detect-lang.ts` has already declined to guess, which is what keeps it
// honest: a block that could be identified never reaches here.

/** `&`, `<`, `>`. The output is a text node, so quotes need no escaping — and they are the
 *  very thing being matched, so escaping them would defeat the rule below. */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The two marks, in one pass, for the same reason `MarkdownSource` uses one: a second
 * `.replace()` would run over the first one's output.
 *
 * The lookbehind on the apostrophe is what keeps English prose out of it. Without it,
 * "don't … it's" opens a string at the first apostrophe and closes it at the second, painting
 * the words between them. A quote that follows a letter is a contraction, never an opening.
 */
const MARKS = /(\$\{[A-Za-z_][\w]*\}|\$[A-Za-z_][\w]*)|"([^"\n]*)"|(?<![A-Za-z])'([^'\n]*)'/g

/** The inside of a block: escaped, with the two token kinds wrapped. */
export function markPlain(code: string): string {
  return esc(code).replace(MARKS, (whole, variable: string | undefined) => (
    variable !== undefined
      ? `<span class="tk-v">${whole}</span>`
      : `<span class="tk-s">${whole}</span>`
  ))
}

/**
 * The whole block.
 *
 * NOT `class="shiki"`, deliberately. That class carries the dark-mode rule that forces every
 * span to `var(--shiki-dark)` — a variable Shiki sets and this file does not — so wearing it
 * would blank these two colours the moment a reader switched to dark. The panel and the
 * hairline come from `.prose pre`, which both kinds of block share.
 */
export function plainCode(code: string): string {
  return `<pre class="plain-code" tabindex="0"><code>${markPlain(code)}</code></pre>`
}
