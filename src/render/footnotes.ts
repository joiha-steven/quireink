// Footnotes: `text[^id]` references + `[^id]: definition` blocks. marked has no
// footnote support and the PostContent renderer escapes raw HTML, so this can't be a
// simple post-process on the rendered HTML. Instead we PRE-process the markdown
// (extract definitions, swap each reference for a private-use placeholder that survives
// marked untouched) and, after marked runs, swap the placeholders for `<sup>` links and
// append the footnotes list — trusted HTML we generate (definition text goes through
// renderInlineMarkdown, which escapes first). Fenced code blocks are masked so a `[^x]`
// inside a code sample is left alone.

import { renderInlineMarkdown } from '@/render/inline-md'
import { escapeAttr } from '@/utils'

// Private-use code points: never appear in real content, and marked passes them through
// as plain text (not <, >, & — so they're neither escaped nor reinterpreted).
const REF_OPEN = '\uE000'
const REF_CLOSE = '\uE001'
const CODE_OPEN = '\uE002'
const CODE_CLOSE = '\uE003'

export type PreparedFootnotes = {
  markdown: string
  refs: Map<string, number> // id -> footnote number (by first reference)
  defs: Map<string, string> // id -> raw definition markdown
}

// Extract definitions + number references (by first appearance). A reference with no
// matching definition is left as literal text.
export function prepareFootnotes(md: string): PreparedFootnotes {
  const code: string[] = []
  let s = md.replace(/```[\s\S]*?```/g, (m) => `${CODE_OPEN}${code.push(m) - 1}${CODE_CLOSE}`)

  const defs = new Map<string, string>()
  s = s.replace(/^\[\^([^\]\s]+)\]:[ \t]+(.+)$/gm, (_whole, id: string, text: string) => {
    defs.set(id, text.trim())
    return ''
  })

  const refs = new Map<string, number>()
  s = s.replace(/\[\^([^\]\s]+)\]/g, (whole, id: string) => {
    if (!defs.has(id)) return whole // ref without a definition stays literal
    if (!refs.has(id)) refs.set(id, refs.size + 1)
    return `${REF_OPEN}${id}${REF_CLOSE}`
  })

  s = s.replace(new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'g'), (_m, i: string) => code[Number(i)])
  // Drop definitions that were never referenced — nothing points at them.
  for (const id of [...defs.keys()]) if (!refs.has(id)) defs.delete(id)
  return { markdown: s, refs, defs }
}

// After marked: replace the placeholders with superscript links and append the list.
// No-op when there are no footnotes.
//
// ⚠️ THE ID IS THE AUTHOR'S TEXT AND IT GOES INTO FOUR ATTRIBUTES. `prepareFootnotes` takes
// `[^\\]\\s]+`, which is everything but a bracket and a space — quotes and slashes included — so
// `[^n"/onmouseover="alert(1)]` closed the `id="` attribute and opened one of its own. Parsed
// into a DOM the `<li>` came back carrying `onmouseover="alert(1)"`: a real handler, on the
// reader's page and on the owner's preview. `/` is what makes it work without a space, because
// HTML5 reads a slash after a quoted value as an attribute separator.
//
// This is the one path that bypasses the engine, and it breaks what `post-content.ts` opens by
// promising: raw HTML is escaped and shown, never rendered. Reachable by anything that can write
// a post it did not author: the MCP door, the importers, the assistant.
//
// ⚠️ ESCAPED, NOT NARROWED. The obvious fix is to allow only `[\w-]` in an id, and it would break
// every blog that does not write in English: `[^ghi-chú]` works today and has to go on working.
// The maps stay keyed on the RAW id, because that is what the placeholder in the HTML carries.
export function applyFootnotes(html: string, refs: Map<string, number>, defs: Map<string, string>): string {
  if (refs.size === 0) return html
  // ⚠️ THE PLACEHOLDER COMES BACK ESCAPED. It rides through `marked` as ordinary text, so an id
  // carrying `&`, `<`, `>` or `"` arrives here spelled `&amp;` and misses a map keyed on the raw
  // id — and the miss returned an empty string, so the reference DISAPPEARED from the sentence
  // while its note stayed in the list below. `[^ghi&chú]` is an id somebody writes. Looked up
  // both ways rather than re-keying the map, because the definition side never passes through
  // `marked` and is still raw.
  const unescape = (v: string): string => v
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const withRefs = html.replace(new RegExp(`${REF_OPEN}([^${REF_CLOSE}]+)${REF_CLOSE}`, 'g'), (_m, raw: string) => {
    const id = refs.has(raw) ? raw : unescape(raw)
    const n = refs.get(id)
    if (!n) return ''
    const at = escapeAttr(id)
    return `<sup class="fnref" id="fnref-${at}"><a href="#fn-${at}">${n}</a></sup>`
  })
  const items = [...refs.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => {
      const at = escapeAttr(id)
      return `<li id="fn-${at}">${renderInlineMarkdown(defs.get(id) ?? '')} `
        + `<a href="#fnref-${at}" class="fn-back" aria-label="back to reference">↩</a></li>`
    })
    .join('')
  return `${withRefs}<hr class="fn-rule"><section class="footnotes"><ol>${items}</ol></section>`
}
