import { SeoFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return <SeoFields s={SETTINGS} update={() => {}} />
}

export function WithSiteUrl() {
  return <SeoFields s={{ ...SETTINGS, siteUrl: 'https://quireink.com' }} update={() => {}} />
}
