// The matched word wears the product's highlighter — the admin's one accent, in its
// "found" role. Shared by the write pane and the comments queue so the two searches
// paint a hit the same way.
//
// Folded per CHARACTER so the indices found in the folded text line up with the raw
// text — folding the whole string at once shifts them wherever a diacritic decomposes.
import { foldAccents } from '@/utils'

export function Marked({ text, needle }: { text: string; needle: string }) {
  const n = foldAccents(needle.trim())
  if (!n || !text) return <>{text}</>
  const hay = Array.from(text, (c) => { const f = foldAccents(c); return f.length === 1 ? f : c.toLowerCase() }).join('')
  const parts: React.ReactNode[] = []
  let from = 0
  for (let at = hay.indexOf(n, from); at !== -1; at = hay.indexOf(n, from)) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={at}>{text.slice(at, at + n.length)}</mark>)
    from = at + n.length
  }
  if (parts.length === 0) return <>{text}</>
  parts.push(text.slice(from))
  return <>{parts}</>
}
