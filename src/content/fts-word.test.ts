import { describe, expect, it } from 'bun:test'
import { ftsWord } from '@/content/fts-word'

describe('ftsWord', () => {
  it('quotes a word with no d as one phrase', () => {
    expect(ftsWord('lap')).toBe('"lap"')
    expect(ftsWord('say "hi"')).toBe('"say ""hi"""')
  })

  it('asks for a d that opens a token with a đ as well, and only there', () => {
    expect(ftsWord('duong')).toBe('("duong" OR "đuong")')
    expect(ftsWord('Duong')).toBe('("Duong" OR "đuong")')
    expect(ftsWord('ladder')).toBe('"ladder"')
    expect(ftsWord("don't")).toBe(`("don't" OR "đon't")`)
  })

  it('forks each token of a joined word, and no more than three', () => {
    expect(ftsWord('di-dong')).toBe('("di-dong" OR "đi-dong" OR "di-đong" OR "đi-đong")')
    expect(ftsWord('d-d-d-d').split(' OR ')).toHaveLength(8)
  })

  it('leaves a word typed with the stroke as it is', () => {
    expect(ftsWord('đường')).toBe('"đường"')
  })
})
