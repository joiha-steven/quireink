import { GalleryFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return <GalleryFields gallery={SETTINGS.gallery} onChange={() => {}} />
}
