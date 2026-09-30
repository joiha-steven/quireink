// "N comments on P posts", with each count in its own plural form (FIXLIST 8.3).
//
// One template carried both numbers and neither could agree with its noun: "1 comments on 1
// posts". `plural()` picks ONE form by ONE number, so the two counts are two phrases, each
// pluralised on its own, and a third string only says the order they sit in — which is what
// differs between languages ("{p}に{c}" in Japanese).
import type { SiteLang } from '@/types'
import { plural } from '@/i18n/plural'

export type TallyWords = { inPosts?: string; commentCount?: string; postCount?: string }

export function commentTally(w: TallyWords, comments: number, posts: number, lang: SiteLang,
  n: (x: number) => string = String): string {
  return (w.inPosts ?? '')
    .replace('{c}', plural(w.commentCount ?? '{n}', comments, lang, n(comments)))
    .replace('{p}', plural(w.postCount ?? '{n}', posts, lang, n(posts)))
}
