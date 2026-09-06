// Every action this blog can record has a sentence, in every language it ships.
//
// The failure this guards is silent by construction: a release adds a logged action, nobody
// adds it here, and the log prints `mcp.token.delete` in a row of English prose — visible to
// the owner and to nothing else. The type is the source of truth, so the test reads it rather
// than a list somebody has to remember to extend.
import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { adminT } from '@/i18n/admin-i18n'
import { LANG_CODES } from '@/locales/langs'
import { logSentence, kindOf, glyphOf } from './logSentence'

/** The `ActivityAction` union, read out of its declaration. */
function declared(): string[] {
  const src = readFileSync('src/server/activity.ts', 'utf8')
  const block = src.slice(src.indexOf('export type ActivityAction'), src.indexOf('export type ActivityEntry'))
  const codes = [...block.matchAll(/'([a-z.]+)'/g)].map((m) => m[1]!)
  // A parse that quietly finds nothing would pass forever; a parse that finds half would
  // pass for half. Both are worse than a loud failure here.
  if (codes.length < 40) throw new Error(`read only ${codes.length} action codes`)
  return codes
}

describe('the log speaks', () => {
  it('has a sentence for every action, in every language', () => {
    const codes = declared()
    const missing: string[] = []
    for (const lang of LANG_CODES) {
      const t = adminT(lang)
      for (const code of codes) if (!t.logActions[code]) missing.push(`${lang}:${code}`)
    }
    expect(missing).toEqual([])
  })

  it('leaves no hole where an object would have gone', () => {
    // Rows written before the log recorded a detail reach this with an empty string, and the
    // first cut substituted an em-dash: "Changed settings: —", "Wrote “—”".
    const t = adminT('en')
    for (const code of ['settings.save', 'post.create', 'cache.clear']) {
      const line = logSentence(t, code, '')
      expect(line).not.toContain('—')
      expect(line).not.toContain('{t}')
      expect(line.trim()).toBe(line)
      expect(line.length).toBeGreaterThan(3)
    }
    expect(logSentence(t, 'post.create', 'On ligatures')).toContain('On ligatures')
  })

  it('files an unknown action rather than printing nothing', () => {
    const t = adminT('en')
    expect(logSentence(t, 'not.a.real.action', 'x')).toContain('not.a.real.action')
    expect(kindOf('not.a.real.action')).toBe('system')
    expect(glyphOf('post.create')).toBe('page')
  })

  it('names an icon that the shared set actually has', () => {
    // A glyph name with no body renders an empty square, which is worse than no glyph.
    const icons = readFileSync('src/icons.ts', 'utf8')
    for (const code of declared()) {
      expect(icons).toContain(`  ${glyphOf(code)}:`)
    }
    void readdirSync
  })
})
