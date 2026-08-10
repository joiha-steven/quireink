import { SiteFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Empty() {
  return <SiteFields s={SETTINGS} update={() => {}} />
}

export function Filled() {
  return (
    <SiteFields
      s={{
        ...SETTINGS,
        title: 'Quire Ink',
        description: 'Notes on building things that last.',
        siteUrl: 'https://quireink.com',
        language: 'en',
      }}
      update={() => {}}
    />
  )
}
