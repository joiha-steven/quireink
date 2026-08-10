import { FeaturedField } from 'quireink'
import { POST_REFS } from './_fixtures'

export function NonePicked() {
  return <FeaturedField posts={POST_REFS} value={[]} onChange={() => {}} />
}

export function TwoPicked() {
  return (
    <FeaturedField
      posts={POST_REFS}
      value={['ban-phim-co-va-go-tieng-viet', 'what-a-static-blog-gives-up']}
      onChange={() => {}}
    />
  )
}
