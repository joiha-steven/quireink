// One line of markdown-it plumbing, in its own file because it is the difference between an
// editor that opens a post and an editor that goes white.
//
// The pen's delimiters all parse their own contents as inline Markdown, so bold or a link can
// live under a stroke. The obvious way to do that — the way two files here both did it —
//
//     state.md.inline.parse(inner, state.md, state.env, state.tokens)
//
// hands the nested parse the SAME token array the outer one is still working on. It looks
// harmless, because the nested parse only appends; but the inline parser finishes with its
// `ruler2` pass, and those rules SPLICE the array — `text_collapse` merges and drops tokens.
// Every index the outer parse recorded into `state.delimiters` shifts under it, and the next
// lookup throws `TypeError: undefined is not an object` out of markdown-it, through
// `setContent`, into a React handler — so the admin unmounts and the owner gets a blank page.
//
// It takes a paragraph as ordinary as `**đậm** và ==mực==`: one emphasis run BEFORE one
// stroke, which is most of why it survived so long. The reverse order is fine, and so is
// either alone. Measured 2026-08-21, reproduced from a pasted draft.
//
// The fix: give the nested parse its own array and append the finished tokens, so the outer
// state's indices never move while it is still holding them.
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.js'
import type Token from 'markdown-it/lib/token.js'

/**
 * Parse `text` as inline Markdown and append the result to the tokens `state` is building.
 *
 * Spread-push (`state.tokens.push(...inner)`) is avoided deliberately: it passes one argument
 * per token, and a long stroke over a long line is not the place to find out where this
 * engine's argument limit is.
 */
export function parseInlineInto(state: StateInline, text: string): void {
  const inner: Token[] = []
  state.md.inline.parse(text, state.md, state.env, inner)
  for (const token of inner) state.tokens.push(token)
}
