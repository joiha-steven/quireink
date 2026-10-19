// TYPE OFF THE SCALE: a weight above 600, or a size the scale has no step for.
// One half of `check:admin-kit`, split out to keep that file under the line limit.
//
// The scale (`admin-shared/scale.ts`) sets 400/500/600 and the sizes 30 · 28 · 16 · 14 · 13 · 12.
// Measured on 2026-10-19: six sites set `font-bold` (700) where the same job is 500 or 600
// everywhere else, three set 15px where the section step is 16, and a dialog title was `text-lg`
// (18px) beside a card title at 16. Each was a size or weight typed where a role existed, so the
// same job looked different on two screens and nothing said so.
//
// The cure is the role constant (`SECTION`, `FIGURE`, `NOTE_SIZE`, `META`, ...). A site that is
// off-scale ON PURPOSE goes in `OFF_SCALE_OK` with the line it lives on and the reason; the
// entry must keep matching, so a reworded line cannot leave a dead exemption behind.
//
// Not scanned: tests, and `scale.ts` itself, which is where the numbers are defined. Comments are
// blanked first (newlines kept so a line number is the file's own), or this note would trip it.
// Only the px spelling of an arbitrary size is matched: the rail's rem-spelled size is another
// package's to move.
import { readFileSync } from 'node:fs'

const OFF_SCALE = /\bfont-(?:bold|extrabold|black)\b|\btext-\[\d+(?:\.\d+)?px\]|\btext-(?:lg|xl|[2-9]xl)\b/

const OFF_SCALE_OK: { file: string; line: string; why: string }[] = [
  {
    file: 'src/web/admin/screens/settings-home.ts',
    line: `key(t.tbBold, 'B', 'data-footer-wrap="**"', 'font-bold')`,
    why: "the Bold key's own letter: a B that is not bold is not a picture of the command it runs",
  },
  {
    file: 'src/admin/components/editor-toolbar.ts',
    line: "bold: 'text-xs font-bold'",
    why: 'the table keys (C+, R+) are letters standing in for glyphs and are set heavier than the icons beside them',
  },
  {
    file: 'src/web/admin/screens/dashboard.ts',
    line: '<span class="font-bold">INK</span>',
    why: 'the product wordmark is brand art, not UI type',
  },
  {
    file: 'src/web/admin/screens/sheet.ts',
    line: 'bg-transparent text-3xl font-semibold leading-tight',
    why: 'the title field is the WYSIWYG carve-out: it is set at the size the published headline has, in the reading face',
  },
]

/**
 * Source with its comments blanked and its strings kept, newlines preserved.
 *
 * String-aware on purpose: `'video/*'` is an `accept` value, not the start of a block comment, and
 * a regex that did not know that blanked every line up to the next `*` + `/` in seven files.
 * Template literals are walked too, so a `${ ... }` hole may hold quotes and comments of its own.
 */
export function blank(src: string): string {
  let out = ''
  let i = 0
  const holes: number[] = [] // brace depth of each open template hole
  let depth = 0
  const quoted = (q: string, resumed = false): void => {
    if (!resumed) out += src[i++]
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') out += src[i++]
      if (q === '`' && src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; holes.push(depth++); return }
      out += src[i++]
    }
    out += src[i++] ?? ''
  }
  while (i < src.length) {
    const c = src[i]!
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++ }
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
    } else if (c === "'" || c === '"') quoted(c)
    else if (c === '`') quoted('`')
    else if (c === '{') { depth++; out += c; i++ }
    else if (c === '}') {
      depth--
      out += c; i++
      if (holes.length && holes[holes.length - 1] === depth) { holes.pop(); quoted('`', true) }
    } else { out += c; i++ }
  }
  return out
}

/** Each line of `src` that sets off-scale type, outside comments, with the offending token. */
export function offScaleHits(src: string): { text: string; line: number; token: string }[] {
  const hits: { text: string; line: number; token: string }[] = []
  blank(src).split('\n').forEach((text, i) => {
    const hit = OFF_SCALE.exec(text)
    if (hit) hits.push({ text, line: i + 1, token: hit[0] })
  })
  return hits
}

/** Prints every offender and every dead exemption; true when there is none. */
export function checkOffScale(files: string[]): boolean {
  let clean = true
  const used = new Set<number>()
  for (const file of files) {
    const path = file.replaceAll('\\', '/')
    if (path.endsWith('.test.ts') || path === 'src/admin-shared/scale.ts') continue
    offScaleHits(readFileSync(file, 'utf8')).forEach(({ text, line, token }) => {
      const ok = OFF_SCALE_OK.findIndex((e) => e.file === path && text.includes(e.line))
      if (ok !== -1) { used.add(ok); return }
      console.error(`✗ check:admin-kit: ${path}:${line} sets type off the scale (${token})`)
      console.error('  Weights are 400/500/600 and sizes come from admin-shared/scale.ts: SECTION for a')
      console.error('  title, FIGURE for a number, NOTE_SIZE/NOTE_TEXT for a note, META/UTIL for small print.')
      console.error('  A site that must be off-scale goes in OFF_SCALE_OK in admin-kit-scale.ts, with the reason.')
      clean = false
    })
  }
  OFF_SCALE_OK.forEach((e, i) => {
    if (used.has(i)) return
    console.error(`✗ check:admin-kit: OFF_SCALE_OK entry for ${e.file} (${JSON.stringify(e.line)}) matches nothing`)
    console.error('  The line was reworded or the exception is gone. Remove or update the entry.')
    clean = false
  })
  return clean
}
