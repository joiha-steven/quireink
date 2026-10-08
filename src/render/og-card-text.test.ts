// The share card must never draw a tofu box, and a long title must never push the foot off
// the 1200x630 frame. Asserted on the element tree handed to satori, not on pixels.
import { describe, expect, it } from 'bun:test'
import { drawableText, ogCardTree, OG_SIZE, renderOgCard } from '@/render/og-card'

type N = { type: string; props: { style?: Record<string, unknown>; children?: unknown } }

/** Every string leaf in the tree, in order. */
function texts(n: unknown, out: string[] = []): string[] {
  if (typeof n === 'string') out.push(n)
  else if (Array.isArray(n)) n.forEach((c) => texts(c, out))
  else if (n && typeof n === 'object') texts((n as N).props.children, out)
  return out
}
/** Nodes (depth first) whose style satisfies `pred`. */
function find(n: unknown, pred: (s: Record<string, unknown>) => boolean, out: N[] = []): N[] {
  if (Array.isArray(n)) n.forEach((c) => find(c, pred, out))
  else if (n && typeof n === 'object') {
    const node = n as N
    if (node.props.style && pred(node.props.style)) out.push(node)
    find(node.props.children, pred, out)
  }
  return out
}
const tree = (c: Parameters<typeof ogCardTree>[0]) => ogCardTree(c, 'Inter')

describe('drawableText', () => {
  it('keeps Latin, Vietnamese, Cyrillic and punctuation exactly', () => {
    for (const t of ['Plain title', 'Dấu phụ tiếng Việt — “quoted”, 2026', 'Zażółć gęślą jaźń', 'Почерк и время: зачем?']) {
      expect(drawableText(t)).toBe(t)
    }
  })
  it('drops emoji and collapses the doubled spaces they leave', () => {
    expect(drawableText('Launch 🚀 day')).toBe('Launch day')
    expect(drawableText('👨‍👩‍👧 Family ❤️ time 🇻🇳')).toBe('Family time')
    expect(drawableText('🎉')).toBe('')
  })
  it('keeps the symbols the font draws even though they count as pictographs', () => {
    expect(drawableText('Brand\u2122 guide \u00a9 2026 \u00ae')).toBe('Brand\u2122 guide \u00a9 2026 \u00ae')
  })
  it('keeps decomposed Vietnamese by composing it first', () => {
    expect(drawableText('Mở đầu năm mới'.normalize('NFD'))).toBe('Mở đầu năm mới')
  })
  it('keeps the modifier letters Ukrainian apostrophes use', () => {
    expect(drawableText('Мʼята і пʼять')).toBe('Мʼята і пʼять')
    expect(drawableText('Self‐hosted, non‑breaking')).toBe('Self-hosted, non-breaking')
  })
  it('does not decline for an owner font, but still drops emoji', () => {
    expect(drawableText('Go \u2192 \u2605 \ud83d\ude80', false)).toBe('Go \u2192 \u2605')
    const n = ogCardTree({ title: '日本語 \u2605', customFont: new ArrayBuffer(8) }, 'Site')
    expect(texts(n).join('')).toContain('日本語')
  })
  it('declines CJK, Greek and the like', () => {
    for (const t of ['日本語のタイトル', 'Mixed 漢字 inside', '한글', 'Ελληνικά', 'العربية']) {
      expect(drawableText(t)).toBeNull()
    }
  })
})

describe('the card tree', () => {
  it('sends no emoji to satori', () => {
    const all = texts(tree({ title: 'Launch 🚀 day', date: 'May 1 📅', site: 'Blog 🌍' })).join('|')
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(all).toContain('Launch')
  })

  it('draws no title for a title it cannot draw: the site name leads and the date is the foot', () => {
    const t = texts(tree({ title: '日本語のタイトル', date: 'May 1, 2026', site: 'My Blog' }))
    expect(t.join('')).not.toMatch(/[　-鿿]/)
    expect(t).toContain('My')
    expect(t).toContain('Blog')
    expect(t).toContain('May')
  })

  it('survives a card with nothing drawable at all, and still has a foot', () => {
    const n = tree({ title: '日本語', site: '日本', date: '２０２６年' })
    expect(texts(n).join('')).toBe('')
    expect(find(n, (s) => s.flexShrink === 0).length).toBe(1)
  })

  it('declines an undrawable excerpt but keeps the title', () => {
    const t = texts(tree({ title: 'Latin title', desc: '日本語の抜粋' })).join(' ')
    expect(t).toContain('Latin')
    expect(t).not.toMatch(/[　-鿿]/)
  })

  for (const [name, title, cut] of [
    ['300 characters', 'word '.repeat(60).trim(), true],
    ['one unbroken 80-character word', 'x'.repeat(80), false],
    ['300 unbroken characters', 'y'.repeat(300), true],
  ] as const) {
    it(`clamps a title of ${name} and keeps the foot on the card`, () => {
      const n = tree({ title, date: 'May 1, 2026', site: 'My Blog' })
      // The title block is a bounded box that hides its overflow.
      const clamped = find(n, (s) => typeof s.maxHeight === 'number' && s.overflow === 'hidden')
      expect(clamped.length).toBeGreaterThanOrEqual(1)
      const lines = Math.max(...clamped.map((c) => c.props.style!.maxHeight as number))
      expect(lines).toBeLessThan(OG_SIZE.height / 2)
      // Words may break inside themselves.
      expect(find(n, (s) => s.wordBreak === 'break-all').length).toBeGreaterThan(0)
      // What reaches satori is short and ends in an ellipsis when it was cut.
      const drawn = texts(find(n, (s) => typeof s.maxHeight === 'number')).join(' ')
      if (cut) {
        expect(drawn.length).toBeLessThan(title.length)
        expect(drawn).toContain('\u2026')
      } else {
        // Fits in the clamp once the word breaks inside itself: shown whole.
        expect(drawn).toContain(title)
      }
      // The middle block shrinks and clips; the foot cannot shrink and holds the date.
      expect(find(n, (s) => s.flexShrink === 1 && s.overflow === 'hidden' && s.minHeight === 0).length).toBe(1)
      const foot = find(n, (s) => s.flexShrink === 0)
      expect(foot.length).toBe(1)
      expect(texts(foot)).toContain('May')
      expect((n.props.style as Record<string, unknown>).height).toBe('100%')
    })
  }

  it('leaves an ordinary title untouched', () => {
    const t = 'A perfectly ordinary post title of about sixty characters, say'
    expect(texts(tree({ title: t, date: 'May 1' })).join(' ')).toBe(t + ' May 1')
  })
})

describe('clamping', () => {
  it('never parts a combining mark from its base when cutting', () => {
    // e + dot below + acute stays a base plus a mark after NFC; 200 of them must cut whole.
    const word = (('e\u0323\u0301').normalize('NFC'))
    const title = Array.from({ length: 200 }, () => word).join(' ')
    const drawn = texts(tree({ title })).join(' ')
    expect(drawn.endsWith('\u2026')).toBe(true)
    for (const w of drawn.slice(0, -1).split(' ').filter(Boolean)) expect(w).toBe(word)
  })
})

describe('renderOgCard', () => {
  it('renders a PNG for the awkward titles without throwing', async () => {
    for (const title of ['日本語のタイトル', 'Launch 🚀 day', 'z'.repeat(300)]) {
      const png = await renderOgCard({ title, date: 'May 1, 2026', site: 'My Blog' })
      expect(png.byteLength).toBeGreaterThan(1000)
    }
  })
})
