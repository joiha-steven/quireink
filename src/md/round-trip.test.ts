// OPEN A POST AND SAVE IT, AND NOTHING MOVES.
//
// The promise this engine has to keep, and the one no other test here can. The spec suite
// proves the reader's page is right; this proves the WRITER'S file is, which is a different
// and more dangerous property: a renderer bug shows up as a page that looks wrong, and a
// serializer bug shows up as a sentence that is not there any more, on a post published
// months ago, found by nobody.
//
// Two laws, and both are needed.
//
//   1. A FIXED POINT. Serializing twice gives the same text. This catches a serializer that
//      keeps changing the document — corruption on a timer, which compounds every save.
//
//   2. THE PAGE DOES NOT MOVE. Rendering the source and rendering what a save would write
//      give the same HTML. This is the strict one, and law 1 alone is blind to what it sees:
//      `\[^1\]` is a perfectly stable fixed point, and it is also a footnote reference that
//      has become an empty formula. Nineteen of these same 45 fixtures published differently
//      after one pass through the old editor, and every one of them was stable.
//
// Both are run over `golden/corpus`, which holds the shapes this blog actually uses —
// footnotes, callouts, tables, maths, the pen's three gestures, galleries, video embeds.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, toHtml } from './index'
import { toMarkdown } from './to-markdown'

const CORPUS = 'golden/corpus'
const FIXTURES = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

describe('open and save', () => {
  it('has fixtures to run', () => {
    // A moved corpus would otherwise turn this whole file into zero silent tests.
    expect(FIXTURES.length).toBeGreaterThan(40)
  })

  for (const file of FIXTURES) {
    it(`is a fixed point: ${file}`, () => {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const once = toMarkdown(parse(source))
      const twice = toMarkdown(parse(once))
      expect(twice).toBe(once)
    })
  }

  for (const file of FIXTURES) {
    it(`leaves the page alone: ${file}`, () => {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const saved = toMarkdown(parse(source))
      expect(toHtml(saved)).toBe(toHtml(source))
    })
  }
})

describe('the shapes a save has destroyed before', () => {
  // Every one is a regression test with a date on it, and every one is about brackets.
  it('keeps a footnote reference a footnote reference', () => {
    const saved = toMarkdown(parse('A sentence[^1] with a note.\n'))
    expect(saved).toContain('[^1]')
    expect(saved).not.toContain('\\[^1\\]')
  })

  it('keeps a callout marker a callout marker', () => {
    const saved = toMarkdown(parse('> [!NOTE]\n> Body.\n'))
    expect(saved).toContain('[!NOTE]')
    expect(saved).not.toContain('\\[!NOTE\\]')
  })

  it('keeps a pipe a pipe next to a backslash, in prose and inside a verbatim span', () => {
    // A TABLE CELL IS THE ONE PLACE `|` HAS TO BE ESCAPED, and `tableToMarkdown` escapes it
    // AFTER the inlines are serialized — so the string it works on already holds backslashes
    // that `escapeText` put there, and in a code span or a formula it holds the author's own.
    // CodeQL reads that as an incomplete escape (js/incomplete-sanitization, alert 28,
    // 2026-09-14) and it is right about the shape: escaping one character of a pair is how a
    // serializer usually loses the other.
    //
    // It does not lose it here, and this is the measurement rather than the argument. The
    // three shapes that carry a backslash beside a pipe all survive a save and a reopen —
    // ordinary prose, a code span, and TeX, where `\\|` is the double bar and a real thing to
    // write. `$\\|x\\|$` in a table is what sent this looking.
    const cases = [
      ['prose', '| a | b |\n| --- | --- |\n| x \\\\\\| y | z |\n'],
      ['a code span', '| a | b |\n| --- | --- |\n| `x \\\\| y` | z |\n'],
      ['a formula', '| a | b |\n| --- | --- |\n| $\\\\|x\\\\|$ | z |\n'],
    ] as const
    for (const [name, source] of cases) {
      const once = toMarkdown(parse(source))
      const twice = toMarkdown(parse(once))
      // A fixed point, and a row that is still two cells rather than three.
      expect({ name, twice }).toEqual({ name, twice: once })
      expect({ name, cells: (toHtml(once, {}).match(/<td/g) ?? []).length }).toEqual({ name, cells: 2 })
      expect({ name, html: toHtml(once, {}) }).toEqual({ name, html: toHtml(source, {}) })
    }
  })

  it('does not turn a bracketed word into maths on the second save', () => {
    // `\[ … \]` is display maths on this blog, so escaping BOTH brackets made `[two]` a
    // formula one save later. Found by the fixed-point law on `reference-links.md`; the
    // first save looked perfectly fine.
    const once = toMarkdown(parse('[one][ref] and [two][missing]\n\n[ref]: https://example.com\n'))
    const twice = toMarkdown(parse(once))
    expect(twice).toBe(once)
    expect(twice).not.toContain('$$')
  })
})

describe('a bracket inside a link label', () => {
  // A LABEL ENDS AT THE FIRST UNESCAPED `]`, and nothing escaped one. So a link whose text
  // held a bracket came back unbalanced on the first save and was not a link at all on the
  // second — the address gone from a published page, with no author behind the change:
  //
  //     [a [b] c](http://e.com)  →  [a \[b] c](…)  →  \[a \[b] c](…)  →  plain text
  //
  // Escaping both brackets is NOT the repair and is the trap next door: `\[ … \]` is display
  // maths here, inside a link label as much as in prose. A pair is written bare instead,
  // which is what CommonMark allows and what the author typed.
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['a pair in the label', '[a [b] c](http://e.com)\n'],
    ['a pair in an alt', '![a [b] c](http://e.com/i.png)\n'],
    ['pairs nested', '[a [b [c] d] e](http://e.com)\n'],
    ['a pair split across a mark', '[Xem [**hình 2**] ở đây](http://e.com)\n'],
    ['an image inside the label', '[x ![alt [1]](http://e.com/i.png) y](http://e.com)\n'],
    ["the author's own escaped bracket", '[a \\] b](http://e.com)\n'],
    ['two lone brackets, closing first', '[a \\] b \\[ c](http://e.com)\n'],
  ]

  for (const [name, source] of cases) {
    it(`survives two saves: ${name}`, () => {
      const once = toMarkdown(parse(source))
      const twice = toMarkdown(parse(once))
      expect(twice).toBe(once)
      // The strict law: two saves may not change the reader's page.
      expect(toHtml(twice)).toBe(toHtml(source))
      // And the link is still a link, which the law above would also allow to be a picture.
      expect(toHtml(twice)).toContain(source.startsWith('!') ? '<img' : '<a href')
      // Neither half of the repair may reach for the other's mistake.
      expect(twice).not.toContain('$$')
      expect(toHtml(twice)).not.toContain('class="math"')
    })
  }
})

describe('two lists standing next to each other', () => {
  // Markdown has ONE way to say where a list ends and the next begins, and it is the marker.
  // Same marker with a blank line between is not two lists, it is one LOOSE list — so a save
  // that wrote both halves with `-` merged them and spaced every item out, and a save that
  // wrote `1.` twice renumbered the second list's first item to follow the first list's last.
  // Both are reachable from the editor, whose schema splits a list that mixes bullets with
  // checkboxes into two (`admin/mixed-list.test.ts`).
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['three bullet lists', '- a\n* b\n+ c\n', 3],
    ['a dotted list and a bracketed one', '1. a\n\n1) b\n', 2],
    ['a bullet list and a numbered one', '- a\n\n1. b\n', 2],
    ['a list, a paragraph, a list', '- a\n\nmiddle\n\n- b\n', 2],
  ]

  for (const [name, source, lists] of cases) {
    it(`stays ${lists} lists: ${name}`, () => {
      const once = toMarkdown(parse(source))
      expect(toMarkdown(parse(once))).toBe(once)
      expect(toHtml(once)).toBe(toHtml(source))
      expect(parse(once).children.filter((b) => b.type === 'list').length).toBe(lists)
    })
  }

  it('does not renumber the list below', () => {
    // `1) b` is a list that starts at one. Written back as `1.` it joined the list above it
    // and was published as item two.
    const once = toMarkdown(parse('1. a\n\n1) b\n'))
    // Two <ol> and no `start`, which is how this renderer spells a list that begins at one.
    expect((toHtml(once).match(/<ol/g) ?? []).length).toBe(2)
    expect(toHtml(once)).not.toContain('start=')
    expect(once).toContain('1)')
  })

  it('leaves a lone list on the default marker', () => {
    // The alternate marker is for separation and nothing else: a list with no list above it
    // is written the way every other list here is written.
    expect(toMarkdown(parse('- a\n- b\n'))).toBe('- a\n- b\n')
    expect(toMarkdown(parse('1. a\n2. b\n'))).toBe('1. a\n2. b\n')
  })
})

describe('a footnote whose definition is a single token', () => {
  // `[^1]: Wikipedia` is a perfectly good LINK REFERENCE DEFINITION by CommonMark, which has no
  // footnotes — so the block parser ate it, and `[^1]` in the prose came back a link to a page
  // called Wikipedia. One token is what most citations are: a name, `Sđd.`, a bare URL. Two
  // words survived only because a space makes an invalid destination, which is why every
  // fixture in the corpus survived and the shape below did not.
  //
  // The reader's page never showed it: `render/footnotes.ts` lifts definitions out of the
  // source before the engine runs. The EDITOR opens the source through the engine, so it saved
  //
  //     Nguồn[^1].  /  [^1]: Wikipedia     as     Nguồn[^1](Wikipedia).
  //
  // — the definition deleted from the author's file and the note gone from the published page.
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['one word', 'Nguồn[^1].\n\n[^1]: Wikipedia\n'],
    ['an abbreviation', 'Nguồn[^1].\n\n[^1]: Sđd.\n'],
    ['a bare URL', 'Nguồn[^1].\n\n[^1]: https://vi.wikipedia.org/wiki/Trang\n'],
    ['a Vietnamese label', 'Nguồn[^ghi-chú].\n\n[^ghi-chú]: Wikipedia\n'],
    ['two of them', 'A[^1] và B[^2].\n\n[^1]: Một\n\n[^2]: Hai\n'],
  ]

  for (const [name, source] of cases) {
    it(`survives a save: ${name}`, () => {
      const once = toMarkdown(parse(source))
      expect(once).toBe(source)
      expect(once).not.toContain('](')
    })
  }

  it('refuses the shape at any indent, where the renderer reads only column zero', () => {
    // `render/footnotes.ts` leaves an indented definition as literal text, so the engine has to
    // as well — two spaces may not be the difference between a note and a link. The leading
    // spaces themselves are not kept, because no paragraph's are.
    const once = toMarkdown(parse('  [^1]: Wikipedia\n'))
    expect(once).toBe('[^1]: Wikipedia\n')
    expect(once).not.toContain('](')
  })

  it('still reads an ordinary link reference definition', () => {
    // The refusal is the `[^…]` shape and nothing wider.
    const once = toMarkdown(parse('[one][ref]\n\n[ref]: https://example.com\n'))
    expect(toHtml(once)).toContain('<a href="https://example.com">one</a>')
    // A caret that is not the whole label, and a label with a space in it, are links. By the
    // link's TEXT, because a bare URL left standing in a paragraph autolinks and would answer
    // `href=` on its own — which is how a rule far too wide passed an earlier version of this.
    expect(toHtml('[a][b^c]\n\n[b^c]: https://example.com\n')).toContain('<a href="https://example.com">a</a>')
    expect(toHtml('[a][^ b]\n\n[^ b]: https://example.com\n')).toContain('<a href="https://example.com">a</a>')
  })
})

describe('a footnote reference inside a mark', () => {
  // `**Nguồn[^1]**` parses into THREE text nodes — `Nguồn`, `[`, `^1]` — because the bracket
  // opens a link that never closes. `escapeText` repairs `\[^1]` back to `[^1]`, but it works a
  // node at a time and no single one of those three holds the whole shape, so the reference
  // came back escaped on one save and bare on the next, for ever, in bold, italic, strike, a
  // heading, a table cell, a quote and a list item alike.
  //
  // The editor never showed it (ProseMirror merges adjacent text with the same marks) and the
  // reader's page never moved. The importer is the path that meets it, and the serializer being
  // wrong on its own is enough.
  const cases = [
    '**Nguồn[^1]**\n',
    '*Nguồn[^1]*\n',
    '~~Nguồn[^1]~~\n',
    '# **Nguồn[^1]**\n',
    '- **Nguồn[^1]**\n',
    '> **Nguồn[^1]**\n',
    '| a |\n| --- |\n| **x[^1]** |\n',
    '**[!NOTE]**\n',
  ] as const

  for (const source of cases) {
    it(`is written back as the author wrote it: ${JSON.stringify(source)}`, () => {
      const once = toMarkdown(parse(source))
      expect(once).toBe(source)
      expect(once).not.toContain('\\[^')
      expect(once).not.toContain('\\[!')
    })
  }
})

describe('a pen stroke over a phrase the serializer escapes', () => {
  // The pen picks its variant by hashing the gesture's own source, so a phrase keeps the same
  // stroke across re-renders. The source is not stable, though: `==5*3==` is what the author
  // typed and `==5\*3==` is what a save writes, because `*` is escaped wherever it stands. The
  // hash saw two different gestures and the stroke under an unchanged phrase changed shape on
  // the first save — `pen/grammar.ts` resolves the escapes before hashing.
  const cases = ['==5*3==\n', '++[mục] chào++\n', '==a_b==\n', '@@C++ ở đây@@\n', '==<tag>==\n']

  for (const source of cases) {
    it(`keeps its stroke: ${JSON.stringify(source)}`, () => {
      const once = toMarkdown(parse(source))
      expect(toHtml(once)).toBe(toHtml(source))
      expect(toMarkdown(parse(once))).toBe(once)
    })
  }

  it('still gives two different phrases two different strokes', () => {
    // Normalising the spelling may not flatten the deck: the number is still the phrase's own.
    const pen = (md: string): string => /data-pen="(\d+)"/.exec(toHtml(md))?.[1] ?? ''
    expect(pen('==chào==\n')).not.toBe(pen('==người==\n'))
    expect(pen('==chào==\n')).not.toBe('')
  })
})

describe('a text node that carries its own newline', () => {
  /** A paragraph built by hand, because nothing in the tree produces this shape. */
  const para = (value: string) =>
    ({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] })

  const blocks = (md: string): number =>
    (parse(md) as unknown as { children: unknown[] }).children.length

  it('keeps one paragraph one paragraph, whatever its second line begins with', () => {
    // ⚠️ NOTHING REACHABLE PUTS A NEWLINE IN A TEXT NODE TODAY, and this says so rather than
    // implying a live bug. Checked on 2026-09-21: the parser emits `softbreak` nodes,
    // `from-editor.ts` splits on the newline before serializing, and `import/convert.ts`
    // collapses HTML whitespace to spaces. The rule is held here anyway, because it belongs to
    // the code that WRITES the format rather than to three callers that happen to be careful —
    // the same argument `news/smtp.ts` makes about a CRLF in a header.
    //
    // Without the escaping, four of these six came back as TWO blocks: the author's one
    // paragraph split into a paragraph and a heading, a quote, or a list.
    for (const second of ['# not a heading', '> not a quote', '- not a bullet',
      '+ not a bullet', '1. not a list', '--- not a rule']) {
      const md = toMarkdown(para(`A sentence that wraps\n${second}`) as never)
      expect({ second, blocks: blocks(md) }).toEqual({ second, blocks: 1 })
    }
  })

  it('escapes a setext underline, which would otherwise eat the line above it', () => {
    for (const under of ['===', '---']) {
      const md = toMarkdown(para(`A sentence that wraps\n${under}`) as never)
      expect({ under, blocks: blocks(md) }).toEqual({ under, blocks: 1 })
      // And what it produced is still a paragraph rather than a heading.
      expect((parse(md) as unknown as { children: { type: string }[] }).children[0]!.type)
        .toBe('paragraph')
    }
  })

  it('and the counter-test: a line that begins with nothing special keeps no backslash', () => {
    // Every assertion above is satisfied by a serializer that escapes EVERYTHING, which is the
    // failure this file's `&` rule was written about: a backslash the author never typed.
    const md = toMarkdown(para('A sentence that wraps\nand carries on normally') as never)
    expect(md).not.toContain('\\')
    expect(blocks(md)).toBe(1)
  })
})
