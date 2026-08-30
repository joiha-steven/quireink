// Settings → Appearance: the palette, the pen, the type and the writing surface.
//
// Split from `SettingsView.tsx` on 2026-08-24, when the pen's colour card put that file
// eight lines over its 400-line ceiling — the same cut, for the same reason, as
// `SettingsAiTab`. The state stays in `SettingsView`: this takes the fields it needs and
// hands back changes, so there is still ONE form and ONE save button.
import type { SiteSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'
import type { RefObject } from 'react'
import { Card, NOTE_TEXT, ResetButton } from './kit'
import { CssEditor } from './CssEditor'
import { useAdminT } from './I18nProvider'
import { ThemeFields } from './ThemeFields'
import { ShapeFields } from './ShapeFields'
import { TableFields } from './TableFields'
import { InkFields } from './InkFields'
import { FontFields } from './FontFields'
import { FontUpload } from './FontUpload'
import { TypographyFields } from './TypographyFields'
import { AdvancedFields } from './AdvancedFields'
import { DEFAULT_INKS } from '@/render/ink-palette'

export function SettingsAppearanceTab(
  { s, update, presets, typographyReset, grid, col }: {
    s: SiteSettings
    update: (partial: Partial<SiteSettings>) => void
    presets: ThemePreset[]
    typographyReset: RefObject<(() => void) | null>
    grid: string
    col: string
  },
) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        {/* SHAPE, first — the coarsest control on the tab: what shape everything is, before
            what colour and what face it is set in.
            ⚠️ It was first in the RIGHT column, on the measured grounds that the left stack
            was the taller of the two. Pairing the light and dark colour tables took 363px out
            of the left stack and that stopped being true — measured at 1440px, left 2,224
            against right 2,992. Moving it back across puts them at 2,752 and 2,464 and leaves
            the right column as exactly one subject: type. Re-measure before moving it again. */}
        <Card panel title={t.cardShape}>
          <ShapeFields shape={s.shape} onChange={(shape) => update({ shape })} />
        </Card>
        {/* Under Shape, because it is the same question — what the site LOOKS like rather
            than what colour it is — asked about the one block that had never been asked. */}
        <Card panel title={t.cardTable}>
          <TableFields table={s.table} onChange={(table) => update({ table })} />
        </Card>
        <Card panel title={t.navAppearance}>
          <p className={`${NOTE_TEXT} mb-4 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60`}>
            {t.themeAdminNote}
          </p>
          <ThemeFields
            presets={presets}
            themes={s.themes}
            defaultId={s.themePreset}
            enabled={s.enabledPalettes}
            scheme={s.defaultScheme}
            onChangeThemes={(themes) => update({ themes })}
            onSetDefault={(themePreset) => update({ themePreset })}
            onChangeEnabled={(enabledPalettes) => update({ enabledPalettes })}
            onChangeScheme={(defaultScheme) => update({ defaultScheme })}
          />
        </Card>
        <Card panel title={t.cardInk}
          actions={<ResetButton onClick={() => update({ inks: { ...DEFAULT_INKS } })} label={t.resetDefault} />}>
          <InkFields
            inks={s.inks}
            bodyText={s.themes[s.themePreset]?.light.text ?? '#262626'}
            selectionDefaults={{
              // What the sheet's own rule paints when neither field is set: the heading
              // colour on paper, the mid grey on a dark page. Shown so the swatch tells
              // the truth about what the reader currently sees.
              light: s.themes[s.themePreset]?.light.heading ?? '#121212',
              dark: s.themes[s.themePreset]?.dark.meta ?? '#888888',
            }}
            onChange={(inks) => update({ inks })}
          />
        </Card>
        <Card panel title={t.customCss}>
          <div className="space-y-1.5">
            <CssEditor value={s.customCss} onChange={(customCss) => update({ customCss })} />
            <p className={NOTE_TEXT}>{t.customCssHint}</p>
          </div>
        </Card>
      </div>
      <div className={col}>
        {/* TYPE, and only type: the face, the sizes it is set at, and how it is drawn. */}
        <Card panel title={t.cardFont}>
          <FontFields
            value={s.fontPreset}
            onChange={(fontPreset, typography) => update({ fontPreset, typography })}
            chromeFont={s.chromeFont}
            onChromeFont={(chromeFont) => update({ chromeFont })}
          />
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <FontUpload value={s.customFont} onChange={(customFont) => update({ customFont })} />
          </div>
        </Card>
        <Card panel title={t.cardTypography}
          actions={<ResetButton onClick={() => typographyReset.current?.()} label={t.resetDefault} />}>
          <TypographyFields
            typography={s.typography} fontPreset={s.fontPreset} resetRef={typographyReset}
            onChange={(typography) => update({ typography })}
          />
        </Card>
        <Card panel title={t.cardRendering}>
          <AdvancedFields
            typography={s.typography}
            onTypography={(typography) => update({ typography })}
            ideChrome={s.ideChrome}
            onIdeChrome={(ideChrome) => update({ ideChrome })}
            motion={s.motion}
            onMotion={(motion) => update({ motion })}
            autosaveSeconds={s.autosaveSeconds}
            onAutosaveSeconds={(autosaveSeconds) => update({ autosaveSeconds })}
          />
        </Card>
      </div>
    </div>
  )
}
