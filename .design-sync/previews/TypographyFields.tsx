import { TypographyFields } from 'quireink'
import { SETTINGS } from './_fixtures'

// `fontPreset` does NOT change what is drawn — it only tells Reset which font's scale to
// restore — so varying it produces identical cards. The visible axis is `typography.roles`,
// the per-role size/line/spacing scale, plus the smoothing switch.
export function Default() {
  return (
    <TypographyFields
      typography={SETTINGS.typography}
      fontPreset={SETTINGS.fontPreset}
      onChange={() => {}}
    />
  )
}

export function LargerScale() {
  const roles = structuredClone(SETTINGS.typography.roles)
  if (roles.body) roles.body = { ...roles.body, size: 1.15, line: 1.75 }
  if (roles.h1) roles.h1 = { ...roles.h1, size: 2.6 }
  return (
    <TypographyFields
      typography={{ ...SETTINGS.typography, roles, smoothing: false }}
      fontPreset={SETTINGS.fontPreset}
      onChange={() => {}}
    />
  )
}
