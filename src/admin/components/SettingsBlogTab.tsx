// Settings → Blog: what this blog IS. Its name, its language, its marks, and whose it is.
//
// ADR 0041. It is the old Site tab plus the one key from Search & URLs that answers the same
// question — the canonical address. A blog's own address is part of what the blog is, and
// filing it under "how machines see the site" put the answer to "what is my domain" behind a
// tab named after search engines.
//
// Save-all: every key here goes through the sheet's one Save button.
import type { SiteSettings } from '@/types'
import { SettingsCard } from './SettingsCard'
import { useAdminT } from './I18nProvider'
import { SiteFields } from './SiteFields'
import { BrandFields } from './BrandFields'
import { AuthorFields } from './AuthorFields'
import { CanonicalField } from './SeoFields'

export function SettingsBlogTab({ s, update, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  grid: string
  col: string
}) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        <SettingsCard title={t.cardGeneral}>
          <SiteFields s={s} update={update} />
        </SettingsCard>
        {/* The address the blog calls its own. One field, so it rides under the identity it
            belongs to rather than opening a card of its own. */}
        <SettingsCard title={t.cardAddress}>
          <CanonicalField s={s} update={update} />
        </SettingsCard>
      </div>
      <div className={col}>
        <SettingsCard title={t.cardBranding}>
          <BrandFields s={s} update={update} />
        </SettingsCard>
        {/* Whose blog this is — filed with the marks, because both answer "who is this",
            and the words above answer "what is this". */}
        <SettingsCard title={t.cardAuthor}>
          <AuthorFields author={s.author} onChange={(author) => update({ author })} />
        </SettingsCard>
      </div>
    </div>
  )
}
