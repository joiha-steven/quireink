// The pen imports nothing from the blog around it.
//
// That is the property that makes `src/pen/` liftable — into the WordPress theme, the
// marketing site, an embeddable sheet — and it is the kind of property that erodes one
// convenient import at a time. So it is a red test rather than a sentence in a README: every
// file in this directory may import from this directory, from `marked` (the server parser's
// types), and from nothing else.
//
// The inverse is not enforced. The application reaches the pen through `pen/index.ts` by
// convention, but a direct import of `@/pen/grammar` from the editor is a shortcut, not a
// leak, and the test would only add friction.
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dir)
const ALLOWED = [/^@\/pen\//, /^\.\/?[^.]/, /^\.\.\/pen\//, /^marked$/, /^bun:test$/, /^node:/]

describe('the pen module boundary', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))

  it('holds every file in src/pen to imports from src/pen, marked and the runtime', () => {
    // The tests in this directory get the same rule: a test that reaches into the renderer
    // is a test of the renderer, and belongs beside it.
    const leaks: string[] = []
    for (const f of files) {
      const src = readFileSync(join(DIR, f), 'utf8')
      for (const m of src.matchAll(/^(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1]!
        if (!ALLOWED.some((re) => re.test(spec))) leaks.push(`${f} → ${spec}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('has a door, and the door names every layer', () => {
    const index = readFileSync(join(DIR, 'index.ts'), 'utf8')
    for (const layer of ['grammar', 'marked', 'pigments', 'derive', 'palette', 'ink.css']) {
      expect(index).toContain(`from '@/pen/${layer}'`)
    }
  })
})
