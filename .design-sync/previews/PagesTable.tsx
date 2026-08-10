import { PagesTable } from 'quireink'
import { PAGES, VIEWS } from './_fixtures'

export function Basic() {
  return <PagesTable initialPages={PAGES} views={VIEWS} />
}

export function Empty() {
  return <PagesTable initialPages={[]} views={{}} />
}
