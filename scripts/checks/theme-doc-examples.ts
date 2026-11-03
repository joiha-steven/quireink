// Every CSS example in the theme author's docs, run through the real checker (ADR 0072).
//
// docs/themes.md promises that an example in it or in themes-css-rules.md is what the checker
// says it is. Nothing held that promise: a sentence about `clamp()` was written from the rule's
// intent, and the checker refused the first fluid size an author tried. So the docs' examples
// are read the way an author reads them, and each one is checked:
//
//   /* refused: C1 · theme.css:1:16 · #94401f */   the next rules each return C1 (at 1:16, that
//   /* refused: C1 */                               subject, when the marker names them)
//   /* passes ... */                                the next rules each return nothing
//   a ```css block with no marker                   the whole block returns nothing
//
// A rule is one line, or several until its braces close. Each is checked inside a sheet that
// also styles both surfaces, so S2 only speaks where an example asks for it. `url()` may point
// at `images/paper.webp`, the one package file the examples assume.
import { readFileSync } from 'node:fs'
import { themeContract } from '@/content/theme-contract'
import { checkThemeCss, type Violation } from '@/theme'

const DOCS = ['docs/themes.md', 'docs/themes-css-rules.md', 'docs/themes-recipes.md']
const PACKAGE = new Set(['theme.json', 'theme.css', 'screenshot.webp', 'images/paper.webp'])
const SURFACES = '\n.post-list{margin:0}\n.front{margin:0}\n'

type Expect = { pass: true } | { pass: false; rule: string; line?: number; col?: number; subject?: string }
type Example = { file: string; at: number; css: string; expect: Expect }

const MARKER = /^\/\* (refused|passes)\b(.*)\*\/$/

function readMarker(kind: string, rest: string): Expect {
  if (kind === 'passes') return { pass: true }
  // `: C1 · theme.css:1:16 · #94401f`, `: C1`, `: A2, the file is not in the zip`,
  // `: X1 · theme.css:1:8 · a{...} (nesting)`; a trailing note in brackets is the doc's, not the subject.
  const m = /^:\s*([A-Z]\d)(?:\s*·\s*theme\.css(?::(\d+):(\d+))?\s*·\s*(.*?)|,.*)?\s*$/.exec(rest)
  if (!m) throw new Error(`unreadable marker: refused${rest}`)
  const subject = m[4]?.replace(/\s+\([^)]*\)$/, '').trim()
  return {
    pass: false, rule: m[1]!,
    ...(m[2] ? { line: Number(m[2]), col: Number(m[3]) } : {}),
    ...(subject ? { subject } : {}),
  }
}

/** The rules of one ```css block, each with what its marker expects. */
function examplesIn(file: string, block: string, startLine: number): Example[] {
  const lines = block.split('\n')
  if (!lines.some((l) => MARKER.test(l.trim()))) return [{ file, at: startLine, css: block, expect: { pass: true } }]
  const out: Example[] = []
  let expect: Expect | null = null
  let buf = ''
  let bufAt = 0
  const depth = (s: string) => (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length
  lines.forEach((raw, i) => {
    const line = raw.trim()
    const marker = MARKER.exec(line)
    if (marker) {
      expect = readMarker(marker[1]!, marker[2]!)
      return
    }
    if (buf === '' && (line === '' || (line.startsWith('/*') && line.endsWith('*/')))) return
    if (expect === null) throw new Error(`${file}:${startLine + i}: a rule before any marker`)
    if (buf === '') bufAt = startLine + i
    buf += (buf === '' ? '' : '\n') + raw
    if (depth(buf) <= 0) {
      out.push({ file, at: bufAt, css: buf, expect })
      buf = ''
    }
  })
  if (buf !== '') throw new Error(`${file}:${bufAt}: an example whose braces never close`)
  return out
}

function examples(file: string): Example[] {
  let src: string
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const out: Example[] = []
  const fence = /^```css\n([\s\S]*?)^```$/gm
  for (const m of src.matchAll(fence)) {
    const startLine = src.slice(0, m.index).split('\n').length + 1
    out.push(...examplesIn(file, m[1]!.replace(/\n$/, ''), startLine))
  }
  return out
}

function judge(ex: Example, contract: ReturnType<typeof themeContract>): string | null {
  const alone = !ex.expect.pass && ex.expect.rule === 'S2'
  const found: Violation[] = checkThemeCss(alone ? ex.css : ex.css + SURFACES, contract, PACKAGE)
  const show = (vs: Violation[]) => vs.map((v) => `${v.rule} ${v.line}:${v.col} ${v.subject}`).join('; ') || 'nothing'
  if (ex.expect.pass) return found.length === 0 ? null : `should pass, the checker said ${show(found)}`
  const want = ex.expect
  const hit = found.find((v) => v.rule === want.rule
    && (want.line === undefined || (v.line === want.line && v.col === want.col))
    && (want.subject === undefined || v.subject === want.subject))
  if (hit) return null
  const where = want.line === undefined ? '' : ` at ${want.line}:${want.col}`
  return `should be ${want.rule}${where}${want.subject ? ` · ${want.subject}` : ''}, the checker said ${show(found)}`
}

const contract = themeContract()
const all = DOCS.flatMap(examples)
const faults = all.flatMap((ex) => {
  const why = judge(ex, contract)
  return why === null ? [] : [`  - ${ex.file}:${ex.at}: ${ex.css.split('\n')[0]}\n      ${why}`]
})
if (faults.length > 0) {
  console.error(`✗ check:theme-docs: ${faults.length} of ${all.length} example(s) are not what the doc says`)
  console.error(faults.join('\n'))
  process.exit(1)
}
console.log(`✓ check:theme-docs: ok (${all.length} CSS examples in ${DOCS.length} docs)`)
