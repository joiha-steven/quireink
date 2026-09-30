// Each count agrees with its own noun (FIXLIST 8.3): "1 comments on 1 posts" was printed.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { plural } from '@/i18n/plural'
import { commentTally } from '@/admin-shared/tally'

const words = (lang: 'en' | 'ru' | 'ja') => {
  const t = adminT(lang)
  return { inPosts: t.commentsInPosts, commentCount: t.commentCount, postCount: t.postCount }
}

describe('the comment tally', () => {
  it('says one and many in English', () => {
    expect(commentTally(words('en'), 1, 1, 'en')).toBe('1 comment on 1 post')
    expect(commentTally(words('en'), 5, 2, 'en')).toBe('5 comments on 2 posts')
  })
  it('takes the Russian few and many forms, each on its own number', () => {
    expect(commentTally(words('ru'), 2, 5, 'ru')).toBe('2 комментария к 5 записям')
    expect(commentTally(words('ru'), 1, 1, 'ru')).toBe('1 комментарий к 1 записи')
  })
  it('keeps the language’s own order', () => {
    expect(commentTally(words('ja'), 3, 2, 'ja')).toBe('2件の記事に3件のコメント')
  })
})

describe('the attempts left', () => {
  it('is singular on the last try', () => {
    expect(plural(adminT('en').authBadCode, 1, 'en')).toBe('That code is not right. 1 attempt left.')
    expect(plural(adminT('de').authBadCode, 1, 'de')).toBe('Dieser Code stimmt nicht. Noch 1 Versuch.')
  })
})
