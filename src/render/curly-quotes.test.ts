import { describe, expect, test } from 'bun:test'
import { curlyQuotes } from '@/render/curly-quotes'
import { renderPostContent } from '@/render/post-content'

const THIN = String.fromCharCode(0x202f)
const page = async (md: string, lang: Parameters<typeof curlyQuotes>[1]) =>
  curlyQuotes(await renderPostContent({ markdown: md }), lang).trim()

describe('curlyQuotes', () => {
  test('each language quotes with its own pair', async () => {
    expect(await page('He said "hi".', 'en')).toBe('<p>He said “hi”.</p>')
    expect(await page('Er sagte "hallo".', 'de')).toBe('<p>Er sagte „hallo“.</p>')
    expect(await page('Il a dit "salut".', 'fr')).toBe(`<p>Il a dit «${THIN}salut${THIN}».</p>`)
    expect(await page('彼は"はい"と言った。', 'ja')).toBe('<p>彼は「はい」と言った。</p>')
    expect(await page('Anh ấy nói "chào".', 'vi')).toBe('<p>Anh ấy nói “chào”.</p>')
  })

  test('an apostrophe is ’ in every language, and an elision before a digit too', async () => {
    expect(await page("it's the '90s", 'en')).toBe('<p>it’s the ’90s</p>')
    expect(await page("l'homme", 'fr')).toBe('<p>l’homme</p>')
  })

  test('a single-quoted phrase opens and closes, without eating the apostrophes inside it', async () => {
    expect(await page("a 'word's worth' here", 'en')).toBe('<p>a ‘word’s worth’ here</p>')
    expect(await page("ein 'Wort' hier", 'de')).toBe('<p>ein ‚Wort‘ hier</p>')
  })

  test('a quote across inline markup still pairs', async () => {
    expect(await page('say *"odd"* and "[link](https://x.y)"', 'en'))
      .toBe('<p>say <em>“odd”</em> and “<a href="https://x.y">link</a>”</p>')
  })

  test('code, code blocks and maths keep their straight quotes', async () => {
    const html = await page('run `echo "x"` now\n\n```\nconst s = "x"\n```', 'en')
    expect(html).toContain('<code>echo &quot;x&quot;</code>')
    expect(html).not.toMatch(/const s = [“”]/)
    expect(await page("$a'$", 'en')).not.toContain('’')
  })

  test('the quotes inside a tag are never touched', async () => {
    expect(await page('[x](https://x.y "a title")', 'en')).toBe('<p><a href="https://x.y" title="a title">x</a></p>')
  })

  test('a quote after an escaped bracket opens', async () => {
    expect(await page('<b>"raw"</b>', 'en')).toBe('<p>&lt;b&gt;“raw”&lt;/b&gt;</p>')
  })
})
