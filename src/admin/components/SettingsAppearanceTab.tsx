// Settings → Appearance: how the site LOOKS. The shape of things, the palette, the type.
//
// ⚠️ THREE CARDS LEFT ON 2026-09-07 (ADR 0041), and the measurement is why. This tab carried
// 137 controls over 2,825px while five other tabs sat within 31px of 1,236 — 36% of every
// control on the settings screen behind one word. Tables and the pen went to Posts, because
// both draw INSIDE a post's body and neither is a palette decision; text rendering, motion,
// the key sounds and the autosave interval went to Account, because they describe the TOOL
// and this tab is about what a reader sees.
//
// The state stays in `SettingsView`: this takes the fields it needs and hands back changes.
// This is one of the four tabs that still save through the sheet's one Save button.
import type { SiteSettings } from '@/types'
import type { ThemePreset } from '@/content/themes'
import type { RefObject } from 'react'
import { NOTE_TEXT, ResetButton } from './kit'
import { SettingsCard } from './SettingsCard'
import { CssEditor } from './CssEditor'
import { useAdminT } from './I18nProvider'
import { ThemeFields } from './ThemeFields'
import { ShapeFields } from './ShapeFields'
import { LookFields } from './LookFields'
import { FontFields } from './FontFields'
import { FontUpload } from './FontUpload'
import { TypographyFields } from './TypographyFields'

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
    // TYPE SIZES STAND ALONE, full width, since 2026-09-07. The table is nine roles by four
    // numbers plus a live specimen of each, and in a half-width column that is a five-column
    // table in 600px — the specimen, which is the whole point of the card, had 150px to draw
    // a 2.5rem heading in. Everything else on the tab still pairs.
    <div className="space-y-5">
    <div className={grid}>
      <div className={col}>
        {/* SHAPE, first — the coarsest control on the tab: what shape everything is, before
            what colour and what face it is set in.
            ⚠️ It was first in the RIGHT column, on the measured grounds that the left stack
            was the taller of the two. Pairing the light and dark colour tables took 363px out
            of the left stack and that stopped being true — measured at 1440px, left 2,224
            against right 2,992. Moving it back across puts them at 2,752 and 2,464 and leaves
            the right column as exactly one subject: type. Re-measure before moving it again. */}
        {/* WHAT KIND OF PUBLICATION THIS IS, before what shape it is and what colour: the
            look decides the furniture round the words, and everything else on this tab
            decides the words. */}
        <SettingsCard title={t.lookLabel}>
          <LookFields look={s.look} onChange={(look) => update({ look })} />
        </SettingsCard>
        <SettingsCard title={t.cardShape}>
          <ShapeFields shape={s.shape} onChange={(shape) => update({ shape })} />
        </SettingsCard>
        <SettingsCard title={t.navAppearance}>
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
        </SettingsCard>
      </div>
      <div className={col}>
        {/* Type, and then the owner's own CSS under it.
            ⚠️ The right column was type and ONLY type, and what that cost was measured at
            1440 on 2026-09-12: left 1,534 against right 535, so the tab ended in 999px of
            blank paper beside the palette table — the hole the two-column rule exists to
            close. Custom CSS is the one card on this tab that belongs to no subject in
            particular and is the right size to move: 1,187 against 882 with it over here.
            Re-measure before moving it again. */}
        <SettingsCard title={t.cardFont}>
          <FontFields
            value={s.fontPreset}
            onChange={(fontPreset, typography) => update({ fontPreset, typography })}
            chromeFont={s.chromeFont}
            onChromeFont={(chromeFont) => update({ chromeFont })}
          />
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <FontUpload value={s.customFont} onChange={(customFont) => update({ customFont })} />
          </div>
        </SettingsCard>
        <SettingsCard title={t.customCss}>
          <div className="space-y-1.5">
            <CssEditor value={s.customCss} onChange={(customCss) => update({ customCss })} />
            <p className={NOTE_TEXT}>{t.customCssHint}</p>
          </div>
        </SettingsCard>
      </div>
    </div>
    <SettingsCard title={t.cardTypography}
      actions={<ResetButton onClick={() => typographyReset.current?.()} label={t.resetDefault} />}>
      <TypographyFields
        typography={s.typography} fontPreset={s.fontPreset} resetRef={typographyReset}
        onChange={(typography) => update({ typography })}
      />
    </SettingsCard>
    </div>
  )
}
