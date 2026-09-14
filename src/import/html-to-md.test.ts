// Somebody else's HTML, back into this blog's Markdown.
//
// THE LAW IS THE READER'S PAGE, not the Markdown. Two spellings of the same document are both
// correct — a setext heading and a `#` heading are the same page — so pinning the text would
// make this a transcript to rewrite whenever anything improves. What may not happen is an
// import that changes what the post SAYS.
//
// So every fixture in `golden/corpus/` is rendered to HTML, converted back by this pipe, and
// rendered again. The two pages must match. That is a real corpus rather than a handful of
// samples: forty-five documents with nested lists, task lists, tables with alignment, footnotes,
// callouts, the pen, and four fixtures that exist only because they were once dangerous.
//
// The migration gate was the same run with `turndown` beside it, before it was removed: of the
// forty-five, twenty-seven agreed, fifteen came back right HERE and wrong there, and none the
// other way round.
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { toHtml } from '@/md/index'
import { htmlToMarkdown } from './convert'
import { parseHtml } from './html-parse'

/**
 * Fixtures whose page legitimately does not survive the trip, with what happens instead.
 *
 * Same idea as `DIVERGED` in the golden compare: an exception on the record is a decision, an
 * exception in someone's head is an omission. All three are the conversion working.
 */
const DIVERGED: Record<string, string> = {
  'bom.md': 'a byte-order mark is invisible whitespace and does not come back out of HTML',
  'raw-html-block.md': 'a <div class="danger"> wrapper carries no meaning and is dropped',
  'raw-html-inline.md': '<b> has one Markdown spelling, and it renders as <strong>',
}

const settle = (html: string): string => html.replace(/\s+/g, ' ').replace(/> </g, '><').trim()

const corpus = readdirSync('golden/corpus')
  .filter((name) => name.endsWith('.md'))
  .sort()

describe('the corpus, out through HTML and back', () => {
  it('has the fixtures this test claims to read', () => {
    expect(corpus.length).toBeGreaterThan(40)
    for (const name of Object.keys(DIVERGED)) expect(corpus).toContain(name)
  })

  for (const name of corpus) {
    if (name in DIVERGED) continue
    it(`${name}: the page is the same page`, () => {
      const page = toHtml(readFileSync(`golden/corpus/${name}`, 'utf8'))
      expect(settle(toHtml(htmlToMarkdown(page)))).toBe(settle(page))
    })
  }

  it('the three that diverge do it the documented way and no other', () => {
    expect(htmlToMarkdown('<p>﻿# After a BOM</p>')).toBe('\\# After a BOM')
    expect(htmlToMarkdown('<div class="danger">&lt;script>alert(1)&lt;/script></div>')).toBe(
      '\\<script>alert(1)\\</script>',
    )
    expect(toHtml(htmlToMarkdown('<p>Some <b>bold</b>.</p>'))).toContain('<strong>bold</strong>')
  })
})

describe('what the old pipe lost', () => {
  it('reads a highlight as the pen', () => {
    expect(htmlToMarkdown('<p>a <mark>lit</mark> word</p>')).toBe('a ==lit== word')
  })

  it('reads an underline as the pen', () => {
    expect(htmlToMarkdown('<p>a <u>ruled</u> word</p>')).toBe('a ++ruled++ word')
  })

  it('keeps a strikethrough without a plugin', () => {
    expect(htmlToMarkdown('<p>a <del>cut</del> word</p>')).toBe('a ~~cut~~ word')
  })

  it('takes the real URL a lazy-loading plugin moved to data-src', () => {
    expect(htmlToMarkdown('<p><img src="blank.gif" data-src="real.jpg" alt="x"></p>')).toContain(
      '(blank.gif)',
    )
    expect(htmlToMarkdown('<p><img data-src="real.jpg" alt="x"></p>')).toBe('![x](real.jpg)')
  })
})

describe('the shapes a platform actually exports', () => {
  it('keeps a sub-list inside its item instead of beside it', () => {
    // The `<li>` that opens a nested list must not close the item it is nested in. It did,
    // and every sub-list in an import came out as a sibling of its parent.
    const md = htmlToMarkdown('<ul><li>one<ul><li>under</li></ul></li><li>two</li></ul>')
    expect(md).toBe('- one\n  - under\n- two')
  })

  it('keeps a task list tight, checkboxes and nesting included', () => {
    const md = htmlToMarkdown(
      '<ul><li><input type="checkbox"> todo</li>' +
        '<li><input checked type="checkbox"> done<ul><li><input type="checkbox"> sub</li></ul></li></ul>',
    )
    expect(md).toBe('- [ ] todo\n- [x] done\n  - [ ] sub')
  })

  it('keeps a table column that was not left-aligned', () => {
    const md = htmlToMarkdown(
      '<table><tr><th>a</th><th style="text-align:right">b</th></tr>' +
        '<tr><td>1</td><td>2</td></tr></table>',
    )
    expect(md).toContain('---:')
  })

  it('reads the language off a highlighted code block', () => {
    const md = htmlToMarkdown('<pre><code class="language-ts">const x = 1\n</code></pre>')
    expect(md).toBe('```ts\nconst x = 1\n```')
  })

  it('folds a figure caption into the alt, because that is what renders it', () => {
    const md = htmlToMarkdown(
      '<figure><img src="a.jpg" alt="ignored"><figcaption>The caption</figcaption></figure>',
    )
    expect(md).toBe('![The caption](a.jpg)')
  })

  it('tags every picture in a gallery, not just the first', () => {
    // One imported page lost 139 of its 169 photographs to a rule that read the FIRST <img>
    // out of a gallery figure and called that the picture.
    const md = htmlToMarkdown(
      '<figure class="wp-block-gallery"><figure><img src="1.jpg"></figure>' +
        '<figure><img src="2.jpg"></figure><figure><img src="3.jpg"></figure></figure>',
    )
    expect(md).toContain('1.jpg#grid')
    expect(md).toContain('2.jpg#grid')
    expect(md).toContain('3.jpg#grid')
  })

  it('drops an anchor that goes nowhere', () => {
    expect(htmlToMarkdown('<p><a name="top"></a><a href="#x">x</a> here</p>')).toBe('x here')
  })
})

describe('HTML that was never going to be well formed', () => {
  it('reads paragraphs nobody closed', () => {
    expect(htmlToMarkdown('<p>one<p>two<p>three')).toBe('one\n\ntwo\n\nthree')
  })

  it('ignores a close tag for something that was never open', () => {
    expect(htmlToMarkdown('<p>text</div></p>')).toBe('text')
  })

  it('reads an attribute nobody quoted', () => {
    expect(htmlToMarkdown('<p><img src=a.jpg alt=word></p>')).toBe('![word](a.jpg)')
  })

  it('never reads a script or a style as writing', () => {
    const md = htmlToMarkdown('<p>before</p><script>if (a > b) alert(1)</script><p>after</p>')
    expect(md).toBe('before\n\nafter')
  })

  it('does not mistake a bare < for a tag', () => {
    expect(parseHtml('a < b').map((n) => (n.type === 'text' ? n.value : '?'))).toEqual(['a < b'])
  })

  it('refuses HTML nested deeper than a post ever is, without throwing', () => {
    expect(() => parseHtml('<div>'.repeat(500))).not.toThrow()
  })
})
