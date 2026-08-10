import { ThemeFields } from 'quireink'
import { SETTINGS, PRESETS } from './_fixtures'

// All six palettes offered, `mono` the default — the shipped configuration.
export function AllPalettes() {
  return (
    <ThemeFields
      presets={PRESETS}
      themes={SETTINGS.themes}
      defaultId={SETTINGS.themePreset}
      enabled={PRESETS.map((p) => p.id)}
      onChangeThemes={() => {}}
      onSetDefault={() => {}}
      onChangeEnabled={() => {}}
    />
  )
}

// An owner who offers only two palettes and defaults to sepia.
export function TwoPalettes() {
  return (
    <ThemeFields
      presets={PRESETS}
      themes={SETTINGS.themes}
      defaultId="sepia"
      enabled={['mono', 'sepia']}
      onChangeThemes={() => {}}
      onSetDefault={() => {}}
      onChangeEnabled={() => {}}
    />
  )
}
