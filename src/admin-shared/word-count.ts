// HOW MUCH OF IT THERE IS, and how long it takes to read.
//
// The number over the writing sheet, in the small print beside the save state. It counts
// MARKDOWN, which is not prose: a fence full of code is writing, but its braces and semicolons
// are not words, and the `#` in front of a heading is punctuation the writer never typed as a
// word. Both are stripped before anything is counted.
//
// Its own file because it is arithmetic, and the one thing arithmetic can be is wrong: it lived
// inside a React component where nothing could reach it.

// ~220 words a minute; the public reading-time line uses the same order of magnitude.
const WORDS_PER_MINUTE = 220

export function countWords(markdown: string): number {
  const text = markdown
    // Fenced code counts as writing, not per token: eight lines of TypeScript are not eighty
    // words of prose, and a piece that is half code would otherwise report double.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~[\]()!-]/g, ' ')
  const matched = text.match(/\S+/g)
  return matched ? matched.length : 0
}

/** Never zero: a piece with three words in it still takes a moment to read. */
export const readMinutes = (words: number): number =>
  Math.max(1, Math.round(words / WORDS_PER_MINUTE))
