// HOW MUCH OF IT THERE IS, and how long it takes to read.
//
// The number over the writing sheet, in the small print beside the save state. It is the SAME
// arithmetic the published page prints, and this file exists to make that visible rather than
// to hold a second copy of it.
//
// ⚠️ IT WAS A SECOND COPY UNTIL 2026-09-16, and the two disagreed. This file stripped a
// handful of Markdown punctuation and divided by 220; `utils.ts` runs `toPlainText` and
// divides by 200. Measured on one 2,800 word body: the page said 14 minutes and the sheet said
// 13, on every shape tried, and the word totals differed too because this side counted the URL
// inside an image and an iframe as prose. Two numbers in front of one person, for one body.
//
// Its own file because it is arithmetic, and the one thing arithmetic can be is wrong: it lived
// inside a React component where nothing could reach it.
export { wordCount as countWords, minutesFor as readMinutes } from '@/utils'
