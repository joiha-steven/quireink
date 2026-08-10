import { ContentDashboard } from 'quireink'
import { POSTS, PAGES, VIEWS, COMMENT_COUNTS } from './_fixtures'

export function Basic() {
  return (
    <ContentDashboard
      posts={POSTS}
      pages={PAGES}
      views={VIEWS}
      commentCounts={COMMENT_COUNTS}
      commentsEnabled
    />
  )
}

export function CommentsDisabled() {
  return (
    <ContentDashboard
      posts={POSTS}
      pages={PAGES}
      views={VIEWS}
      commentCounts={COMMENT_COUNTS}
      commentsEnabled={false}
    />
  )
}
