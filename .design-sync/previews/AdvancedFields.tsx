import { AdvancedFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return (
    <AdvancedFields
      typography={SETTINGS.typography}
      onTypography={() => {}}
      ideChrome={false}
      onIdeChrome={() => {}}
      motion={SETTINGS.motion}
      onMotion={() => {}}
    />
  )
}

export function IdeChromeOn() {
  return (
    <AdvancedFields
      typography={SETTINGS.typography}
      onTypography={() => {}}
      ideChrome
      onIdeChrome={() => {}}
      motion={{ ...SETTINGS.motion, enabled: false }}
      onMotion={() => {}}
    />
  )
}
