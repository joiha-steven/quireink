// The passage a mention's source kept is read off its page in time linear in the page. Anybody can
// send a mention, and its source is a page they write: up to 512 KB of `<` inside the quote held the
// one process for 130 s (the tag strip retried from every `<`), 8.1 s as `&lt;`, and 3.0 s for a
// quote opened again and again and never closed, twenty mentions a minute per address (2026-11-04).
import { describe, expect, it } from 'bun:test'
import { keptPassage } from '@/server/webmention'

const CAP = 512_000
const QUOTE = '<blockquote class="note-quote"><p>'

const SHAPES: Record<string, string> = {
  'a quote of nothing but < (128 KB)': QUOTE + '<'.repeat(128_000) + '</p>',
  'a quote of nothing but &lt; (512 KB)': QUOTE + '&lt;'.repeat(CAP / 4) + '</p>',
  'a quote opened again and again and never closed (512 KB)': (QUOTE + 'x').repeat(CAP / (QUOTE.length + 1)),
}

describe('the kept passage, on a source page shaped against it', () => {
  for (const [name, html] of Object.entries(SHAPES)) {
    it(`reads ${name} in well under a second`, () => {
      const started = performance.now()
      keptPassage(html)
      expect(performance.now() - started).toBeLessThan(250)
    })
  }

  it('still takes the first quote that closes, whatever the case of its tags', () => {
    expect(keptPassage('<BLOCKQUOTE class="note-quote big">\n <P>first</P><blockquote class="note-quote"><p>second</p>')).toBe('first')
  })
})
