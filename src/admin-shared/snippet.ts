// What a custom-code box can say about a snippet before anything runs it.
//
// Two facts — how many bytes it is, and whether it leaves an element open — and since ADR 0054
// both are needed twice: the SERVER computes them for the state it ships drawn, and the island
// recomputes them on every keystroke. Written out in both places they would be two answers to
// "is this snippet broken", drifting in the one direction nobody looks, so the rule lives here
// and neither face owns it.
//
// It was inside `SnippetEditor.tsx` and came out on 2026-09-14 with the Server tab's conversion,
// which is also when that component was deleted. `admin-shared` is where a rule goes when both
// the server's markup and the browser's island need the same answer from it.

/**
 * Elements that swallow the document when left unclosed.
 *
 * Only these two matter. An unclosed `<div>` is untidy and the parser recovers; an unclosed
 * `<script>` or `<style>` turns everything after it into script or stylesheet text, which is
 * why they are the pair worth counting. Self-closing and attribute noise are ignored on
 * purpose: this is a "did you forget the closing tag" check, not an HTML parser.
 */
const SWALLOWERS = ['script', 'style'] as const

/** How many of each swallowing element are left open. Negative = a stray closing tag. */
export function unclosed(html: string): { tag: string; depth: number } | null {
  for (const tag of SWALLOWERS) {
    const open = html.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'))?.length ?? 0
    const close = html.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0
    if (open !== close) return { tag, depth: open - close }
  }
  return null
}

/**
 * BYTES, not characters, and it is the number with a consequence: this text ships inside every
 * public page, on every request — so what matters is what goes over the wire, and one emoji is
 * four of those and one of the other.
 */
export const snippetBytes = (s: string): number => new TextEncoder().encode(s).length
