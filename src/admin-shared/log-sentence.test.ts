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
import { logSentence, kindOf, glyphOf, KIND_OF } from '@/admin-shared/log-sentence'

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

  it('gives every declared action a family, rather than letting it fall to system', () => {
    // ⚠️ THE FALLTHROUGH IS SILENT AND IT LOOKS FINE. `kindOf` answers 'system' for a family
    // `KIND_OF` has not been told about, so a new action gets a sentence (the test above sees
    // to that), a row, and the WRONG GLYPH — the cache icon, beside a line about a post. It
    // also lands under the wrong heading in the screen's own filter, which is worse: an owner
    // asking the log "what happened to my writing" is not shown it.
    //
    // Found 2026-09-19 by looking at the screen after adding `content.*`, which is the only
    // way it could have been found. Read from the type, so tomorrow's action is checked
    // tomorrow.
    // MEMBERSHIP, not behaviour. Asking `kindOf` would answer 'system' both for a family that
    // says it is system and for one nobody has told it about, and a test that cannot tell
    // those apart needs a hand-kept list of exceptions — which is the same kind of list that
    // goes stale as this one.
    const families = [...new Set(declared().map((code) => code.split('.')[0]!))]
    expect(families.filter((family) => !(family in KIND_OF))).toEqual([])
    // And the counter-test: the check can fail. A family nobody has declared is not in there.
    expect('sprocket' in KIND_OF).toBe(false)
    expect(kindOf('sprocket.create')).toBe('system')
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
