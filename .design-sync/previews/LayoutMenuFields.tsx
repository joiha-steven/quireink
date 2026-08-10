import { LayoutMenuFields } from 'quireink'
import { SETTINGS, POST_REFS, PAGE_REFS } from './_fixtures'

export function EmptyMenu() {
  return <LayoutMenuFields s={SETTINGS} update={() => {}} posts={POST_REFS} pages={PAGE_REFS} />
}

export function WithMenu() {
  return (
    <LayoutMenuFields
      s={{
        ...SETTINGS,
        menu: [
          { label: 'About', href: '/page/about' },
          { label: 'Engineering', href: '/category/engineering' },
          { label: 'RSS', href: '/rss.xml' },
        ],
      }}
      update={() => {}}
      posts={POST_REFS}
      pages={PAGE_REFS}
    />
  )
}
