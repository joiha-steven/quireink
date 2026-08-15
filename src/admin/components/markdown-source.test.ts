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
import { mark } from '@/admin/components/MarkdownSource'

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
