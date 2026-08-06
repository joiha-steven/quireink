// Maths on the published page.
//
// The tests that matter here are not the ones proving a fraction renders. They are the ones
// proving that everything which is NOT a formula still is not one: this feature adds meaning
// to the dollar sign, on a blog whose first use of it was an article about the money supply.
import { describe, expect, test } from 'bun:test'
import { renderPostContent } from '@/render/post-content'
import { renderMath } from '@/render/math'
import { toPlainText, deriveExcerpt } from '@/utils'

const html = (md: string) => renderPostContent({ markdown: md })

describe('the four delimiters', () => {
  test('$$…$$ is a block, in its own scrollable wrapper', async () => {
    const out = await html('$$M \\times V = P \\times Q$$')
    expect(out).toContain('<div class="math-block">')
    expect(out).toContain('display="block"')
    // The operator arrives as the real character, not as the control word.
    expect(out).toContain('×')
    expect(out).not.toContain('\\times')
  })

  test('\\[…\\] is the same block', async () => {
    expect(await html('\\[x^2\\]')).toContain('<div class="math-block">')
  })

  test('$…$ is inline, and stays inside the markup around it', async () => {
    const out = await html('- **$M$ (Money Supply):** tổng cung tiền.')
    expect(out).toContain('<strong><math><mi>M</mi></math> (Money Supply):</strong>')
  })

  test('\\(…\\) is inline', async () => {
    expect(await html('giá trị \\(a\\) bất kỳ')).toContain('<math><mi>a</mi></math>')
  })
})

/**
 * THE PRICE TESTS. Every one of these is a sentence someone will write on this blog, and
 * every one of them would have been eaten by a `\$(.+?)\$` rule.
 */
describe('money is not mathematics', () => {
  for (const line of [
    'Giá là $5 và $10.',
    'Giảm còn $5-$8 hôm nay.',
    'Chi phí $100 cho 3 người và $200 cho 6 người.',
    'Gói $9.99 rẻ hơn gói $19.99.',
  ]) {
    test(line, async () => {
      const out = await html(line)
      expect(out).toBe(`<p>${line}</p>\n`)
      expect(out).not.toContain('<math')
    })
  }

  test('a lone dollar is left alone', async () => {
    expect(await html('chỉ có $ thôi')).toBe('<p>chỉ có $ thôi</p>\n')
  })
})

describe('the parser boundaries', () => {
  test('a code span is never maths', async () => {
    const out = await html('dùng `$5` và `$x$` trong shell')
    expect(out).toContain('<code>$5</code>')
    expect(out).toContain('<code>$x$</code>')
    expect(out).not.toContain('<math')
  })

  test('a fenced block is never maths', async () => {
    const out = await html('```\n$$x$$\n```')
    expect(out).not.toContain('<math')
  })

  /**
   * The reason the TeX is not handed to marked's inline lexer. An underscore is the commonest
   * character in a subscript and the commonest emphasis delimiter at the same time, so a
   * formula parsed as Markdown is not a rendering glitch — it is a different formula.
   */
  test('an underscore in a subscript is not emphasis', async () => {
    const out = await html('\\(a_1 + b_2\\)')
    expect(out).not.toContain('<em>')
    expect(out).toContain('<msub>')
  })

  test('an unclosed delimiter does not swallow the document', async () => {
    const out = await html('mở $ mà không đóng\n\nđoạn sau vẫn còn')
    expect(out).toContain('đoạn sau vẫn còn')
    expect(out).not.toContain('<math')
  })
})

describe('a formula Temml cannot parse', () => {
  test('falls back to the writer\'s own source, escaped', () => {
    const out = renderMath('\\frac{a}', false)
    expect(out).toBe('<span class="math-error">\\frac{a}</span>')
  })

  test('carries no colour of its own', () => {
    // Temml's built-in error rendering paints the bad command in #b22222 as an inline style.
    // A hardcoded hex baked into a body that is CACHED under a hash of its Markdown could
    // never be restyled by the palette the reader picked. CLAUDE.md forbids it; this is the
    // check that says so out loud.
    expect(renderMath('\\bogus{x}', true)).not.toContain('#b22222')
    expect(renderMath('\\bogus{x}', true)).not.toMatch(/#[0-9a-f]{6}/i)
  })

  test('never throws, whatever it is handed', () => {
    for (const bad of ['', '{', '\\', '\\left(', '^^^']) {
      expect(() => renderMath(bad, false)).not.toThrow()
    }
  })
})

describe('excerpts, meta descriptions, OG cards and the RSS summary', () => {
  test('carry no TeX control words', () => {
    const plain = toPlainText('$$M \\times V = P \\times Q$$\n\nGiải mã phương trình.')
    expect(plain).not.toContain('\\times')
    expect(plain).not.toContain('$')
    expect(plain).toContain('Giải mã phương trình.')
  })

  test('leave a price alone, the same as the renderer does', () => {
    expect(toPlainText('Giá là $5 và $10.')).toBe('Giá là $5 và $10.')
  })

  /**
   * Read off the rendered page, not deduced. A post opening with the quantity-theory formula
   * produced the deck "M V = P Q Giải mã phương trình…" — broken prose sitting above the
   * title, which is the one place a reader cannot avoid it.
   */
  test('drop a display formula, so the deck starts at the first real sentence', () => {
    expect(deriveExcerpt('$$E = mc^2$$\n\nMột bài về vật lý.')).toBe('Một bài về vật lý.')
  })

  /** An inline formula is part of a sentence: removing it whole would leave a hole. */
  test('keep the operands of an inline formula', () => {
    expect(toPlainText('**$M$ (Money Supply):** tổng cung tiền.')).toBe('M (Money Supply): tổng cung tiền.')
  })
})
