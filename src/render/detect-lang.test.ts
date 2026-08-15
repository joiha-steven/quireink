// What the guesser may fire on, and — the half that matters — what it may not.
//
// A fence that names its language is obeyed; this only ever sees one that named nothing.
// So every wrong answer here is a block that WAS plain and is now wrongly coloured, which is
// worse than the flat block it replaced. The negative cases are therefore the real suite:
// terminal output, an error line, a table drawn with pipes and ordinary Vietnamese prose all
// have to come back `text`, because those are what people actually put in a bare fence.
import { describe, it, expect } from '@/test/vitest'
import { detectLang } from '@/render/detect-lang'

describe('detectLang: it fires on a real signal', () => {
  it('reads a shebang on its own', () => {
    expect(detectLang('#!/bin/bash\nls')).toBe('bash')
    expect(detectLang('#!/usr/bin/env python3\nx = 1')).toBe('python')
  })

  it('reads two command lines, or a prompt', () => {
    expect(detectLang('sudo apt install foo\ncurl -sL https://x | sh')).toBe('bash')
    expect(detectLang('$ ./configure --prefix=/usr')).toBe('bash')
  })

  // The block this rule was written for: no command in the first position on any line.
  it('reads shell SYNTAX when no command name leads a line', () => {
    const script = [
      './acme.sh --install --home "$ACME_HOME" ...',
      'if [ ! -x "$ACME_HOME/acme.sh" ]; then',
      '  echo "install failed"; exit 1',
      'fi',
    ].join('\n')
    expect(detectLang(script)).toBe('bash')
  })

  it('reads the other four it knows', () => {
    expect(detectLang('SELECT * FROM posts WHERE id = 1')).toBe('sql')
    expect(detectLang('{\n  "name": "quireink"\n}')).toBe('json')
    expect(detectLang('def main():\n    return 1')).toBe('python')
    expect(detectLang('name: build\non: push')).toBe('yaml')
  })
})

describe('detectLang: it stays out of the way', () => {
  const plain: [string, string][] = [
    ['program output', 'Unknown parameter: ----home'],
    ['a success line and an error line', '[OK] installed\nInstall error'],
    ['English prose', 'Three lines, and it turns an unreadable failure into a sentence.'],
    ['Vietnamese prose', 'Hỏi "cái file tôi cần có nằm đó không" luôn đáng tin hơn.'],
    ['a table drawn by hand', 'Cut | Family | Before | After'],
    ['one lonely command word', 'make'],
    ['nothing at all', '   \n  \n'],
  ]
  for (const [what, code] of plain) {
    it(`leaves ${what} as text`, () => expect(detectLang(code)).toBe('text'))
  }
})
