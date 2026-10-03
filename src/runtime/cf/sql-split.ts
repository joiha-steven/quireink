// A SQL script into single statements, the way `sqlite3_complete` reads one: quotes and comments
// respected, and a trigger body (`CREATE TRIGGER … BEGIN … END;`, with `CASE … END` inside it) kept
// whole. A Durable Object runs one statement per call, so the schema, every migration step and any
// multi-statement `exec` go through here first (measured in the G0 spike on schema.sql: 76 statements,
// 0 split wrongly).
const stripComments = (s: string): string => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

export function splitSql(src: string): string[] {
  const out: string[] = []
  let buf = ''
  let i = 0
  let depth = 0
  let trigger = false
  const flush = (): void => {
    const s = buf.trim()
    if (stripComments(s).trim()) out.push(s)
    buf = ''
    depth = 0
    trigger = false
  }
  while (i < src.length) {
    const c = src[i]!
    const d = src[i + 1]
    if (c === '-' && d === '-') {
      const j = src.indexOf('\n', i)
      const e = j < 0 ? src.length : j
      buf += src.slice(i, e)
      i = e
      continue
    }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2)
      const e = j < 0 ? src.length : j + 2
      buf += src.slice(i, e)
      i = e
      continue
    }
    if (c === "'" || c === '"' || c === '`' || c === '[') {
      const close = c === '[' ? ']' : c
      let j = i + 1
      while (j < src.length) {
        if (src[j] === close) {
          if (src[j + 1] === close && close !== ']') { j += 2; continue }
          break
        }
        j++
      }
      buf += src.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j++
      const word = src.slice(i, j).toLowerCase()
      buf += src.slice(i, j)
      i = j
      if (!trigger && /^\s*create\s+(temp\s+|temporary\s+)?trigger\b/i.test(stripComments(buf))) trigger = true
      if (trigger) {
        if (word === 'begin' || word === 'case') depth++
        else if (word === 'end') depth--
      }
      continue
    }
    if (c === ';' && depth <= 0) {
      buf += ';'
      i++
      flush()
      continue
    }
    buf += c
    i++
  }
  flush()
  return out
}

/** The named parameters of a statement, in order of first appearance, outside literals and comments. */
export function namedOrder(sql: string): string[] {
  const s = stripComments(sql).replace(/'(?:[^']|'')*'/g, "''")
  const out: string[] = []
  for (const m of s.matchAll(/[$:@]([A-Za-z_][A-Za-z0-9_]*)/g)) if (!out.includes(m[1]!)) out.push(m[1]!)
  return out
}
