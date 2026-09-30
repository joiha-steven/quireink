// Footnotes: `text[^id]` references + `[^id]: definition` blocks. marked has no
// footnote support and the PostContent renderer escapes raw HTML, so this can't be a
// simple post-process on the rendered HTML. Instead we PRE-process the markdown
// (extract definitions, swap each reference for a private-use placeholder that survives
// marked untouched) and, after marked runs, swap the placeholders for `<sup>` links and
// append the footnotes list — trusted HTML we generate (definition text goes through
// renderInlineMarkdown, which escapes first). Code of every kind is masked so a `[^x]`
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

/**
 * Every place a `[^x]` is text somebody is SHOWING rather than a footnote: fenced blocks of
 * either fence, indented code blocks, and inline code spans. Only ``` fences were masked, so a
 * `[^a]` in a span, a `~~~` fence or an indented sample became a superscript, and a `[^b]: …`
 * line inside a `~~~` fence was cut out of the sample into the notes (2026-09-30).
 */
function maskCode(md: string, hide: (text: string) => string): string {
  const lines = md.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length;) {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]!)
    if (open) {
      const run = open[1]!
      const close = new RegExp(`^ {0,3}\\${run[0]}{${run.length},}\\s*$`)
      let j = i + 1
      while (j < lines.length && !close.test(lines[j]!)) j++
      out.push(hide(lines.slice(i, j + 1).join('\n')))
      i = j + 1
      continue
    }
    // Indented code: after a blank line, and not a list item's continuation, which is indented too.
    const before = out.length > 0 ? out[out.length - 1]! : ''
    const context = [...out].reverse().find((l) => l.trim() !== '') ?? ''
    if (/^( {4}|\t)/.test(lines[i]!) && before.trim() === '' && !/^(\s|[-+*]\s|\d+[.)]\s)/.test(context)) {
      let j = i
      while (j < lines.length && (/^( {4}|\t)/.test(lines[j]!) || lines[j]!.trim() === '')) j++
      while (j > i && lines[j - 1]!.trim() === '') j--
      out.push(hide(lines.slice(i, j).join('\n')))
      i = j
      continue
    }
    out.push(lines[i]!)
    i++
  }
  return out.join('\n').replace(/(?<!`)(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, hide)
}

// Extract definitions + number references (by first appearance). A reference with no
// matching definition is left as literal text.
export function prepareFootnotes(md: string): PreparedFootnotes {
  const code: string[] = []
  const restore = (text: string): string =>
    text.replace(new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'g'), (_m, i: string) => code[Number(i)]!)
  let s = maskCode(md, (m) => `${CODE_OPEN}${code.push(m) - 1}${CODE_CLOSE}`)

  // A definition runs on to the next blank line, as any paragraph does, whether the lines under
  // it are indented or not: an editor save writes them flush. Only the first line was taken, and
  // the rest rendered in the body, as a code block when indented and a stray paragraph when not.
  const defs = new Map<string, string>()
  const kept: string[] = []
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const def = /^\[\^([^\]\s]+)\]:[ \t]+(.+)$/.exec(lines[i]!)
    if (!def) { kept.push(lines[i]!); continue }
    const text = [def[2]!.trim()]
    while (i + 1 < lines.length && lines[i + 1]!.trim() !== '' && !/^\[\^[^\]\s]+\]:/.test(lines[i + 1]!)) {
      text.push(lines[++i]!.trim())
    }
    defs.set(def[1]!, restore(text.join(' ')))
    kept.push('')
  }
  s = kept.join('\n')

  const refs = new Map<string, number>()
  s = s.replace(/\[\^([^\]\s]+)\]/g, (whole, id: string) => {
    if (!defs.has(id)) return whole // ref without a definition stays literal
    if (!refs.has(id)) refs.set(id, refs.size + 1)
    return `${REF_OPEN}${id}${REF_CLOSE}`
  })

  s = restore(s)
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
  // A note cited twice gave both citations `id="fnref-a"`: one id, two elements, and HTML where
  // an id must be unique. The first keeps the plain id the back link points at; later ones
  // count on from it.
  const seen = new Map<string, number>()
  const withRefs = html.replace(new RegExp(`${REF_OPEN}([^${REF_CLOSE}]+)${REF_CLOSE}`, 'g'), (_m, raw: string) => {
    const id = refs.has(raw) ? raw : unescape(raw)
    const n = refs.get(id)
    if (!n) return ''
    const at = escapeAttr(id)
    const nth = (seen.get(id) ?? 0) + 1
    seen.set(id, nth)
    return `<sup class="fnref" id="fnref-${at}${nth > 1 ? `-${nth}` : ''}"><a href="#fn-${at}">${n}</a></sup>`
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
