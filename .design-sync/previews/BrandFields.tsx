import { BrandFields } from 'quireink'
import { SETTINGS } from './_fixtures'

// BrandFields draws the logo / favicon / app-icon pickers. It does NOT show the site title
// or description, so varying those produced two byte-identical cells (the render check
// caught it as "variants identical"). `showLogo` is the switch that actually changes the
// panel: on, it reveals the light and dark logo uploads and the width control.
export function LogoOff() {
  return <BrandFields s={{ ...SETTINGS, showLogo: false }} update={() => {}} />
}

export function LogoOn() {
  return <BrandFields s={{ ...SETTINGS, showLogo: true }} update={() => {}} />
}
