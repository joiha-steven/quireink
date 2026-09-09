// Settings → Posts: what surrounds the words on a post.
//
// ADR 0041, and the grouping is the point of the tab. Its switches used to be two lists — "the
// reader's apparatus" and "what the page puts in front of them" — a distinction that reads
// well written down and answers no question anybody arrives with. What somebody actually holds
// is "the date is in the wrong place" or "I want the table of contents gone", and both of those
// are answered by knowing WHERE on the page the thing appears. So the switches are grouped by
// position, in reading order, in one card: above the first sentence, in the body, after the
// last word.
//
// The tables and the pen come from the old Appearance tab, which held 137 controls over
// 2,825px measured on 2026-09-07. Both draw INSIDE a post's body and neither is a palette
// decision, so they belong to the question this tab asks.
//
// Save-all: every key here goes through the sheet's one Save button.
import type { SiteSettings } from '@/types'
import { SettingsCard } from './SettingsCard'
import { SettingsGroup } from './SettingsGroup'
import { useAdminT } from './I18nProvider'
import { PostHeadFields, PostBodyFields, PostEndFields, PostReachFields } from './FeatureFields'
import { PostHeroField } from './PostImageFields'
import { FigureFields } from './FigureFields'
import { GalleryFields } from './GalleryFields'
import { TableFields } from './TableFields'
import { InkFields } from './InkFields'
import { CommentFields } from './CommentFields'
import { ResetButton } from './kit'
import { SHEET_TOOL } from './sheet'
import { DEFAULT_INKS } from '@/pen/palette'

export function SettingsPostTab({ s, update, onCommentSignIn, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  /** Opens the tab that holds how a commenter proves they are a person. */
  onCommentSignIn: () => void
  grid: string
  col: string
}) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        <SettingsCard title={t.cardPost}>
          <SettingsGroup title={t.groupPostHead} first>
            <PostHeadFields features={s.features} onChange={(features) => update({ features })} />
          </SettingsGroup>
          <SettingsGroup title={t.groupPostBody}>
            <PostBodyFields features={s.features} onChange={(features) => update({ features })} />
          </SettingsGroup>
          <SettingsGroup title={t.groupPostEnd}>
            <div className="space-y-5">
              <PostEndFields
                features={s.features}
                onChange={(features) => update({ features })}
                relatedCount={s.relatedCount}
                onRelatedCount={(relatedCount) => update({ relatedCount })}
              />
              <CommentFields comments={s.comments} onChange={(comments) => update({ comments })} />
              {/* The switch is here because comments are the last thing on a post; HOW a
                  commenter proves they are a person is a connection, and lives on the tab
                  that holds the keys for it. One click, rather than three tabs of hunting. */}
              <button type="button" onClick={onCommentSignIn} className={SHEET_TOOL}>
                {t.linkCommentSignIn} →
              </button>
            </div>
          </SettingsGroup>
          <SettingsGroup title={t.groupPostReach}>
            <PostReachFields features={s.features} onChange={(features) => update({ features })} />
          </SettingsGroup>
        </SettingsCard>
      </div>
      <div className={col}>
        <SettingsCard title={t.cardPictures}>
          <div className="space-y-5">
            <PostHeroField postImage={s.postImage} onChange={(postImage) => update({ postImage })} />
            <FigureFields figure={s.figure} onChange={(figure) => update({ figure })} />
            <GalleryFields gallery={s.gallery} onChange={(gallery) => update({ gallery })} />
          </div>
        </SettingsCard>
        <SettingsCard title={t.cardTable}>
          <TableFields table={s.table} onChange={(table) => update({ table })} />
        </SettingsCard>
        <SettingsCard title={t.cardInk}
          actions={<ResetButton onClick={() => update({ inks: { ...DEFAULT_INKS } })} label={t.resetDefault} />}>
          <InkFields
            inks={s.inks}
            bodyText={s.themes[s.themePreset]?.light.text ?? '#262626'}
            selectionDefaults={{
              // What the sheet's own rule paints when neither field is set: the heading
              // colour on paper, the mid grey on a dark page. Shown so the swatch tells the
              // truth about what the reader currently sees.
              light: s.themes[s.themePreset]?.light.heading ?? '#121212',
              dark: s.themes[s.themePreset]?.dark.meta ?? '#888888',
            }}
            onChange={(inks) => update({ inks })}
          />
        </SettingsCard>
      </div>
    </div>
  )
}
