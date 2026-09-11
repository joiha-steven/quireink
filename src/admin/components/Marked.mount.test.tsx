// The highlighter paints the word that was asked for.
//
// It folded accents in one direction only, which is half the rule: it found "lệ" under a
// search for "lề" and then underlined it, so the row's own evidence disagreed with the row.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const marks = async (text: string, needle: string) => {
  const { mountAdmin } = await import('@/admin/test-mount')
  const { Marked } = await import('@/admin/components/Marked')
  const m = await mountAdmin(<Marked text={text} needle={needle} />)
  await m.flush()
  return [...m.container.querySelectorAll('mark')].map((el) => el.textContent)
}

describe('Marked', () => {
  it('paints the accented word and leaves the other tone alone', async () => {
    expect(await marks('Căn lề trái, rồi xét tỉ lệ', 'lề')).toEqual(['lề'])
    expect(await marks('Căn lề trái, rồi xét tỉ lệ', 'lệ')).toEqual(['lệ'])
  })

  it('paints every tone when nothing was typed with one, which is what folding is for', async () => {
    expect(await marks('Căn lề trái, rồi xét tỉ lệ', 'le')).toEqual(['lề', 'lệ'])
  })

  it('keeps the text under the mark lined up where a letter folds to another', async () => {
    expect(await marks('Một đường chuyền dài', 'duong')).toEqual(['đường'])
  })
})
