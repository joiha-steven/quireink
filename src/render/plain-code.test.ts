// Two marks, and the far more important list of what stays unmarked.
//
// This runs on blocks nobody could identify, so every false mark lands in prose or in program
// output — the two things people actually paste into a bare fence. It also writes HTML into a
// page, so the escaping is a security test rather than an appearance one.
import { describe, it, expect } from '@/test/vitest'
import { markPlain, plainCode } from '@/render/plain-code'

describe('markPlain: the two things true in any notation', () => {
  it('marks a double-quoted run', () => {
    expect(markPlain('id = tìm cert có "desc" trùng')).toBe(
      'id = tìm cert có <span class="tk-s">"desc"</span> trùng',
    )
  })

  it('marks $VAR and ${VAR}', () => {
    expect(markPlain('$SYNO_Certificate')).toBe('<span class="tk-v">$SYNO_Certificate</span>')
    expect(markPlain('${HOME}/bin')).toBe('<span class="tk-v">${HOME}</span>/bin')
  })
})

describe('markPlain: what it must leave alone', () => {
  it('leaves an English contraction alone', () => {
    // Without the lookbehind these two apostrophes open and close a "string".
    expect(markPlain("it doesn't matter, it's fine")).toBe("it doesn't matter, it's fine")
  })

  it('leaves an unpaired quote alone', () => {
    expect(markPlain('he said "and then stopped')).toBe('he said "and then stopped')
  })

  it('does not carry a quote across a line', () => {
    expect(markPlain('"one\ntwo"')).toBe('"one\ntwo"')
  })

  it('leaves plain program output completely unmarked', () => {
    expect(markPlain('Unknown parameter: ----home')).toBe('Unknown parameter: ----home')
  })

  it('leaves a bare $ and a price alone', () => {
    expect(markPlain('costs $5 and $ alone')).toBe('costs $5 and $ alone')
  })
})

describe('plainCode: the HTML it writes', () => {
  it('escapes the characters that could open a tag', () => {
    expect(markPlain('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;')
  })

  it('emits only its own spans, whatever the source contains', () => {
    const tags = [...plainCode('<img src=x onerror=alert(1)> "s" $V').matchAll(/<\/?([a-z]+)/g)]
      .map((m) => m[1])
    expect(new Set(tags)).toEqual(new Set(['pre', 'code', 'span']))
  })

  it('does NOT wear the shiki class, whose dark rule would blank both marks', () => {
    expect(plainCode('"x"')).not.toContain('shiki')
  })
})
