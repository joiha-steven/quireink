// What the markdown source view dims, and what it must leave alone.
//
// `mark()` writes HTML that is inserted with `dangerouslySetInnerHTML`, so two of these are
// security tests rather than appearance ones: the escaping, and the fact that no rule can
// introduce a tag the writer did not type.
//
// The rest exist because the first draft shipped a defect that a screenshot caught and no
// assertion would have: a backreference inside a combined alternation is ABSOLUTE, so `\1`
// in the eleventh rule pointed at the first rule's group, matched empty, and turned
// `**Spacing**` into `**S**pacing**`. Every paired rule is checked here for that reason.
import { describe, it, expect } from '@/test/vitest'
import { mark, withHits } from '@/admin/components/MarkdownSource'

describe('mark: line structure', () => {
  it('dims a heading marker and leaves the words', () => {
    expect(mark('## The rule of thumb')).toBe('<i>## </i>The rule of thumb')
  })

  it('dims a thematic break whole, because the line IS the marker', () => {
    expect(mark('---')).toBe('<i>---</i>')
    expect(mark('***')).toBe('<i>***</i>')
  })

  it('dims a bullet, a number and a quote arrow', () => {
    expect(mark('- one')).toBe('<i>- </i>one')
    expect(mark('3. three')).toBe('<i>3. </i>three')
    expect(mark('> quoted')).toBe('<i>&gt; </i>quoted')
  })

  it('dims every pipe in a table row', () => {
    expect(mark('| a | b |')).toBe('<i>|</i> a <i>|</i> b <i>|</i>')
  })
})

describe('mark: paired inline markers', () => {
  // Each of these was wrong in the first draft, all from the same absolute-backreference bug.
  it('closes strong on its own delimiter, not on the first non-space', () => {
    expect(mark('**Spacing** is')).toBe('<i>**</i>Spacing<i>**</i> is')
  })

  it('reads display maths before inline maths', () => {
    expect(mark('$$y$$')).toBe('<i>$$</i>y<i>$$</i>')
    expect(mark('$x^2$')).toBe('<i>$</i>x^2<i>$</i>')
  })

  it('dims strikethrough and the highlighter pen with its colour', () => {
    expect(mark('~~gone~~')).toBe('<i>~~</i>gone<i>~~</i>')
    expect(mark('==kept==#green')).toBe('<i>==</i>kept<i>==</i><i>#green</i>')
  })

  it('dims a link\'s brackets and its URL, keeping the label plain', () => {
    expect(mark('[label](https://x.y)')).toBe('<i>[</i>label<i>](</i><i>https://x.y</i><i>)</i>')
  })
})

describe('mark: what it must NOT touch', () => {
  it('leaves a mid-word underscore alone', () => {
    expect(mark('snake_case and file_name.txt')).toBe('snake_case and file_name.txt')
  })

  it('leaves the inside of a code span alone', () => {
    expect(mark('a `x * y` b')).toBe('a <i>`</i>x * y<i>`</i> b')
  })

  it('marks nothing inside a fence, and starts again after it', () => {
    const doc = ['**a**', '```bash', 'echo **b**', '```', '**c**'].join('\n')
    expect(mark(doc)).toBe([
      '<i>**</i>a<i>**</i>',
      '<i>```bash</i>',
      'echo **b**',
      '<i>```</i>',
      '<i>**</i>c<i>**</i>',
    ].join('\n'))
  })
})

describe('mark: the HTML it produces', () => {
  it('escapes the three characters that could open a tag', () => {
    expect(mark('<script>alert(1)</script> & co')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; co',
    )
  })

  it('emits no tag but its own, whatever the source contains', () => {
    const hostile = '<img src=x onerror=alert(1)> **[a](b)** `c` | d |'
    const tags = [...mark(hostile).matchAll(/<\/?([a-z]+)/g)].map((m) => m[1])
    expect(new Set(tags)).toEqual(new Set(['i']))
  })
})

// The find strip's hits, drawn in the mirror because an unfocused textarea shows no
// selection at all. It counts SOURCE characters through HTML that already has tags and
// entities in it, which is the kind of arithmetic that is either exact or quietly one out.
describe('withHits: drawing the find hits in the mirror', () => {
  it('leaves the html alone when nothing is being looked for', () => {
    expect(withHits('<i>##</i> Title', [], 0)).toBe('<i>##</i> Title')
  })

  it('counts a tag as no characters at all', () => {
    // `## Title`: the marker and the space after it are wrapped, so "Title" starts at source
    // offset 3 and the eight characters of tag in front of it must not shift the count.
    const html = mark('## Title')
    expect(html).toBe('<i>## </i>Title')
    expect(withHits(html, [{ from: 3, to: 8 }], 0))
      .toBe('<i>## </i><mark class="find-hit find-hit-now">Title</mark>')
  })

  it('counts an entity as the one character it stands for', () => {
    // `a & b`, where the ampersand is three source characters wide in the HTML and one in
    // the text. Getting this wrong moves every hit after the first entity in the piece.
    const html = mark('a & b')
    expect(html).toContain('&amp;')
    expect(withHits(html, [{ from: 4, to: 5 }], 0)).toBe('a &amp; <mark class="find-hit find-hit-now">b</mark>')
  })

  it('closes and reopens around a tag rather than crossing it', () => {
    // The hit covers all of `a *em* b`, which the mirror has already split around two dimmed
    // markers. A single mark spanning them would close inside an <i> pair it did not open,
    // and every browser guesses differently at that. Closed and reopened, every mark nests
    // inside whatever the mirror wrapped and the output is well formed wherever the hit
    // falls. The asterisks are highlighted too, which is right: they are characters of the
    // source and the query matched them.
    const html = mark('a *em* b')
    const hit = '<mark class="find-hit find-hit-now">'
    expect(withHits(html, [{ from: 0, to: 8 }], 0)).toBe(
      `${hit}a </mark><i>${hit}*</mark></i>${hit}em</mark>`
      + `<i>${hit}*</mark></i>${hit} b</mark>`,
    )
  })

  it('gives only the current hit the louder mark', () => {
    const out = withHits(mark('one one'), [{ from: 0, to: 3 }, { from: 4, to: 7 }], 1)
    expect(out).toBe('<mark class="find-hit">one</mark> <mark class="find-hit find-hit-now">one</mark>')
  })
})
