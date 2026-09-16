// The fence language: what is answered, what is left alone, and what is never reinterpreted.
//
// This file exists because of a fault that shipped for months without a test able to see it.
// `highlight.ts` carried twenty-one language names by hand; a fence naming anything else fell
// through to `detect-lang.ts`, whose Python rule fires on a line opening `def ` or `class ` —
// so ```ruby and ```elixir were PUBLISHED COLOURED AS PYTHON, while the comment three lines
// above said a named fence is obeyed, right or wrong. The golden corpus could not catch it:
// its only fences are TypeScript, none and a nonsense word.
import { describe, expect, test, afterAll } from 'bun:test'
import { bundledLanguages, bundledLanguagesInfo } from 'shiki'
import { freshDatabase, dropDatabase } from '@/test/db'
import { highlightCode } from '@/render/highlight'

const DIR = './.tmp/test-highlight'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

/** Distinct token colours in one block. `plainCode` has none; a real grammar has several. */
const colours = (html: string | null): number =>
  new Set((html ?? '').match(/color:#[0-9a-fA-F]{6}/g) ?? []).size

const isPlain = (html: string | null): boolean => (html ?? '').includes('class="plain-code"')

const RUBY = 'class Greeter\n  def initialize(name)\n    @name = name\n  end\nend'

describe('a named fence is answered, not reinterpreted', () => {
  test('a language Shiki has but the old hand-list did not is coloured as itself', async () => {
    const ruby = await highlightCode(RUBY, 'ruby')
    expect(isPlain(ruby)).toBe(false)
    expect(colours(ruby)).toBeGreaterThan(3)
    // The whole point: not Python. Same source, two grammars, two answers.
    expect(ruby).not.toBe(await highlightCode(RUBY, 'python'))
  })

  test('the languages that used to fall through now answer for themselves', async () => {
    for (const [lang, code] of [
      ['elixir', 'defmodule M do\n  def hello, do: :world\nend'],
      ['kotlin', 'fun main() { println("x") }'],
      ['haskell', 'main :: IO ()\nmain = putStrLn "x"'],
      ['dockerfile', 'FROM alpine\nRUN apk add curl'],
      ['toml', '[a]\nb = 1'],
      ['lua', 'local x = 1'],
      ['nix', '{ pkgs }: pkgs.hello'],
      ['zig', 'pub fn main() void {}'],
    ] as const) {
      const html = await highlightCode(code, lang)
      expect({ lang, plain: isPlain(html) }).toEqual({ lang, plain: false })
      expect({ lang, few: colours(html) < 3 }).toEqual({ lang, few: false })
    }
  })

  test('a name nobody has a grammar for is left plain, and NOT guessed at', async () => {
    // The regression this file is named for. The code is Ruby, which the guesser reads as
    // Python; the fence names something that is not a language; the answer is neither.
    expect(isPlain(await highlightCode(RUBY, 'notalanguage'))).toBe(true)
    expect(isPlain(await highlightCode('some code', 'notalanguage'))).toBe(true)
  })

  test('a fence that named NOTHING is still guessed at', async () => {
    // `post-content.ts` sends `text` for a fence with no info string, and that one case is
    // the fallback `detect-lang.ts` was written for. It must not have been taken away.
    const guessed = await highlightCode('def f():\n    pass', 'text')
    expect(isPlain(guessed)).toBe(false)
    expect(colours(guessed)).toBeGreaterThan(3)
    // And it stays timid: prose in a fence gets no grammar.
    expect(isPlain(await highlightCode('some code', 'text'))).toBe(true)
  })
})

describe('spellings resolve to one grammar', () => {
  test('four spellings of the shell are one answer, byte for byte', async () => {
    const code = 'set -euo pipefail\necho "$HOME"'
    const bash = await highlightCode(code, 'bash')
    for (const alias of ['sh', 'zsh', 'shell', 'shellscript']) {
      expect({ alias, html: await highlightCode(code, alias) }).toEqual({ alias, html: bash })
    }
  })

  test('the names this product adds all reach a grammar', async () => {
    for (const [lang, code] of [
      ['node', 'const a = 1'],
      ['python3', 'def f():\n    pass'],
      ['golang', 'func main() {}'],
      ['cc', 'int main(){return 0;}'],
      ['htm', '<div>x</div>'],
      ['postgres', 'select 1'],
      ['postgresql', 'select 1'],
      ['mysql', 'select 1'],
      ['psql', 'select 1'],
      ['patch', '--- a\n+++ b\n-x\n+y'],
      ['terminal', '$ ls'],
    ] as const) {
      expect({ lang, plain: isPlain(await highlightCode(code, lang)) })
        .toEqual({ lang, plain: false })
    }
  })

  test('every added name is one Shiki does not know, and every target is one it does', () => {
    // A hand-kept name that SHADOWS Shiki's own is the bug this rule prevents: Shiki would
    // gain an alias, this table would silently keep overriding it, and nothing would say so.
    const known = new Set<string>(Object.keys(bundledLanguages))
    for (const info of bundledLanguagesInfo) {
      known.add(info.id)
      for (const a of info.aliases ?? []) known.add(a)
    }
    const EXTRA_KEYS = ['node', 'terminal', 'python3', 'golang', 'cc', 'htm',
      'postgres', 'postgresql', 'mysql', 'psql', 'patch']
    const EXTRA_TARGETS = ['js', 'shellsession', 'python', 'go', 'cpp', 'html', 'sql', 'diff']
    expect(EXTRA_KEYS.filter((k) => known.has(k))).toEqual([])
    expect(EXTRA_TARGETS.filter((t) => !known.has(t))).toEqual([])
  })
})

describe('a transcript is not a script', () => {
  // `console` is Shiki's alias for `shellsession` and `terminal` is pointed at it here.
  // Measured 2026-09-16: run through the shell SCRIPT grammar, the reply line
  // `added 42 packages in 3s` came back in five colours, because program output was read as
  // code. `detect-lang.ts` opens by calling that the thing that makes a page look broken.
  const SESSION = '$ npm install\nadded 42 packages in 3s'

  test('the reply to a command is not coloured as code', async () => {
    for (const lang of ['console', 'terminal']) {
      const html = await highlightCode(SESSION, lang) ?? ''
      const reply = html.split('<span class="line">')[2] ?? ''
      expect({ lang, coloured: (reply.match(/color:#[0-9a-fA-F]{6}/g) ?? []).length })
        .toEqual({ lang, coloured: 1 })
    }
  })

  test('and the shell SCRIPT grammar is still what a script gets', async () => {
    const script = await highlightCode(SESSION, 'bash') ?? ''
    const reply = script.split('<span class="line">')[2] ?? ''
    expect((reply.match(/color:#[0-9a-fA-F]{6}/g) ?? []).length).toBeGreaterThan(1)
  })
})

describe('grammars arrive when asked for', () => {
  test('two blocks in the same language, at the same moment, both get answered', async () => {
    // One promise per language, shared. Written without it, two code blocks in one post start
    // the same grammar download and the second can resolve against a half-built registry.
    const code = 'SELECT 1'
    const [a, b, c] = await Promise.all([
      highlightCode(code, 'sql'), highlightCode(code, 'sql'), highlightCode(code, 'sql'),
    ])
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(isPlain(a)).toBe(false)
  })
})
