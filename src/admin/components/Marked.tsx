// The matched word wears the product's highlighter — the admin's one accent, in its
// "found" role. Shared by the write pane and the comments queue so the two searches
// paint a hit the same way.
//
// The per-character folding that keeps the found indices lined up with the raw text now
// lives in `accent.ts`, together with the rule about WHICH lane a needle is looked up in:
// typed without accents it finds any, typed with them it means them. Painting "lệ" under a
// search for "lề" was the same bug as returning that row at all.
import { indexIn, lanes } from '@/accent'

export function Marked({ text, needle }: { text: string; needle: string }) {
  const n = needle.trim()
  if (!n || !text) return <>{text}</>
  const hay = lanes(text)
  const span = lanes(n).text.length
  const parts: React.ReactNode[] = []
  let from = 0
  for (let at = indexIn(hay, n, from); at !== -1; at = indexIn(hay, n, from)) {
    if (at > from) parts.push(hay.text.slice(from, at))
    parts.push(<mark key={at}>{hay.text.slice(at, at + span)}</mark>)
    from = at + span
  }
  if (parts.length === 0) return <>{text}</>
  parts.push(hay.text.slice(from))
  return <>{parts}</>
}
