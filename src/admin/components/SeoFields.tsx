// Controlled SEO fields (canonical URL + crawler/feed toggles + OG fallback
// image). Parent owns state + save.
import { useState } from 'react'
import type { SiteSettings, SeoSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { ToggleRow } from '@/admin/ui/Switch'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT, PANEL_LIST } from './kit'

type Feature = { key: keyof SeoSettings; label: string; desc: string; path: string }

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

export function SeoFields({ s, update }: Props) {
  const t = useAdminT()
  const [picking, setPicking] = useState(false)
  const setFlag = (key: keyof SeoSettings, v: boolean) => update({ seo: { ...s.seo, [key]: v } })

  // Acronym labels (Sitemap, RSS Feed, llms.txt, robots.txt) stay literal.
  const FEATURES: Feature[] = [
    { key: 'autoSchema', label: t.seoAutoSchema, desc: t.seoAutoSchemaDesc, path: '' },
    { key: 'sitemap', label: 'Sitemap', desc: t.seoSitemapDesc, path: '/sitemap.xml' },
    { key: 'rss', label: 'RSS Feed', desc: t.seoRssDesc, path: '/feed.xml' },
    { key: 'llms', label: 'llms.txt', desc: t.seoLlmsDesc, path: '/llms.txt' },
    { key: 'robots', label: 'robots.txt', desc: t.seoRobotsDesc, path: '/robots.txt' },
    { key: 'ogImage', label: t.seoOgImage, desc: t.seoOgImageDesc, path: '/og' },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Input
          label={t.seoCanonical}
          value={s.siteUrl}
          onChange={(e) => update({ siteUrl: e.target.value })}
          placeholder="https://example.com"
        />
        <p className={NOTE_TEXT}>{t.seoCanonicalHint}</p>
      </div>

      <div className={PANEL_LIST}>
        {FEATURES.map((f) => (
          <ToggleRow
            key={f.key}
            label={f.label}
            badge={f.path || undefined}
            desc={f.desc}
            checked={Boolean(s.seo[f.key])}
            onChange={(v) => setFlag(f.key, v)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.seoFallbackLabel}</div>
        <div className="flex items-center gap-4">
          {s.seo.ogFallbackImage ? (
            <img src={s.seo.ogFallbackImage} alt="OG" className="h-20 w-36 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800" />
          ) : (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 dark:text-neutral-400 dark:border-neutral-700">
              {t.noImageSelected}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setPicking(true)}>{t.chooseImage}</Button>
            {s.seo.ogFallbackImage && (
              <Button variant="ghost" type="button" onClick={() => update({ seo: { ...s.seo, ogFallbackImage: '' } })}>{t.removeSelection}</Button>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <MediaLibrary
          mode="picker"
          onSelect={(url) => {
            update({ seo: { ...s.seo, ogFallbackImage: url } })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}