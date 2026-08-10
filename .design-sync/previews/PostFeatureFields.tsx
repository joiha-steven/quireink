import { PostFeatureFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return (
    <PostFeatureFields
      features={SETTINGS.features}
      onChange={() => {}}
      relatedCount={3}
      onRelatedCount={() => {}}
    />
  )
}

export function EverythingOff() {
  return (
    <PostFeatureFields
      features={{ ...SETTINGS.features, toc: false, related: false, readingTime: false, progressBar: false }}
      onChange={() => {}}
      relatedCount={0}
      onRelatedCount={() => {}}
    />
  )
}
