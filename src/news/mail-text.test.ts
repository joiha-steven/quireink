// The plain-text part of an email, which nobody had looked at.
//
// Every message this product sends is written as HTML and none of them carries a text part of
// its own, so what `htmlToText` returns IS the alternative every plain-text reader gets. The
// assertions below are the three faults in what stood here before — one line, no addresses,
// raw entities — plus the one CodeQL named, which is what put the regex on the agenda.

import { describe, it, expect } from '@/test/vitest'
import en from '@/locales/en'
import { THEME_PRESETS } from '@/content/themes'
import { broadcastEmail, type EmailBrand } from '@/news/newsletter-email'
import { htmlToText } from '@/news/mail-text'

const BRAND: EmailBrand = { title: 'My Blog', base: 'https://blog.test', theme: THEME_PRESETS[0]!.theme.light }

describe('htmlToText', () => {
  it('keeps the block structure as lines instead of one paragraph', () => {
    const text = htmlToText('<p>First thought.</p><p>Second thought.</p>')
    expect(text.split('\n').filter(Boolean)).toEqual(['First thought.', 'Second thought.'])
  })

  it('carries a link\'s address, which the tag strip threw away', () => {
    expect(htmlToText('<p><a href="https://blog.test/a-post">Read it</a></p>'))
      .toBe('Read it (https://blog.test/a-post)')
  })

  it('does not print an address twice when the label already is one', () => {
    expect(htmlToText('<a href="https://blog.test/x">https://blog.test/x</a>'))
      .toBe('https://blog.test/x')
  })

  it('decodes the entities that were being read as themselves', () => {
    // `&nbsp;` is what the template's spacer rows are made of, and `&amp;` is in every
    // address that carries two query parameters.
    expect(htmlToText('<p>Tea&nbsp;&amp;&nbsp;toast</p>')).toBe('Tea & toast')
  })

  it('decodes each entity once, so an escaped entity stays escaped', () => {
    // Two passes — one for the named entities, a second for `&amp;` — would turn this into
    // `<b>`, which is the double-unescaping bug and the reason the decode is one alternation.
    expect(htmlToText('<p>&amp;lt;b&amp;gt;</p>')).toBe('&lt;b&gt;')
  })

  it('drops what is markup rather than words', () => {
    const html = '<head><style>p{color:red}</style></head><body><script>alert(1)</script><p>Words.</p></body>'
    expect(htmlToText(html)).toBe('Words.')
  })

  /**
   * THE ALERT'S OWN CASE (js/incomplete-multi-character-sanitization).
   *
   * `replace(/<[^>]+>/g, '')` removes a bracketed run, which JOINS what stood either side of
   * it: one pass over this hands back a working `<script>` tag. A scanner cannot do that,
   * because everything it emits was copied from between two tags and never assembled.
   */
  it('cannot rebuild a tag out of the halves either side of one it removed', () => {
    expect(htmlToText('<scr<x>ipt>alert(1)</scr<x>ipt>')).not.toContain('<script')
  })

  it('leaves out what the HTML half hides', () => {
    // The preheader is the inbox preview line: shown in the list, never in the letter. In the
    // text part it read as the first sentence of the letter, said twice.
    const html = '<div style="display:none;max-height:0;">The first hour.</div><p>The first hour.</p>'
    expect(htmlToText(html)).toBe('The first hour.')
  })

  it('reads an unclosed tag as the end of the markup, not as words', () => {
    expect(htmlToText('<p>Kept.</p><p style="a')).toBe('Kept.')
  })

  it('gives a real broadcast a text part with the post and the way out of the list', () => {
    const { html } = broadcastEmail(
      en,
      BRAND,
      [{ slug: 'mornings', title: 'A field guide to mornings', excerpt: 'The first hour.' }],
      'TOK',
    )
    const text = htmlToText(html)
    expect(text).toContain('A field guide to mornings')
    expect(text).toContain('https://blog.test/mornings')
    // The opt-out is what a filter looks for, and it was not in the text part at all.
    expect(text).toContain('https://blog.test/api/newsletter/unsubscribe?token=TOK')
    expect(text).not.toContain('&nbsp;')
    expect(text).not.toContain('&rarr;') // the arrow on the read-the-post link
    // The preview line is not the letter's first sentence for a second time.
    expect(text.startsWith('My Blog')).toBe(true)
    expect(text).not.toContain('<')
    // Not one wall of words: the letter has lines.
    expect(text.split('\n').length).toBeGreaterThan(3)
  })
})
