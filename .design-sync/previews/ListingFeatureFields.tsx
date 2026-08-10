import { ListingFeatureFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return <ListingFeatureFields features={SETTINGS.features} onChange={() => {}} />
}

// The toggles a minimal, text-only listing leaves on.
export function Minimal() {
  return (
    <ListingFeatureFields
      features={{ ...SETTINGS.features, deck: false, categoryLabel: false, leadPost: false }}
      onChange={() => {}}
    />
  )
}
