// Controlled SEO fields (canonical URL + crawler/feed toggles + OG fallback
// image). Parent owns state + save.
import { useState } from 'react'
import type { SiteSettings, SeoSettings } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { ToggleRow } from '@/admin/ui/Switch'
import { MediaLibrary } from './MediaLibrary'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST } from './kit'
import { EMPTY_SLOT } from './slot'

type Feature = { key: keyof SeoSettings; label: string; desc: string; path: string }

type Props = { s: SiteSettings; update: (p: Partial<SiteSettings>) => void }

/**
 * THE ADDRESS, split out on 2026-09-07 (ADR 0041).
 *
 * It moved to the Blog tab and the switches below it did not: a blog's own domain is part of
 * what the blog IS, and filing it under "how machines see the site" put the answer to "what
 * is my address" behind a tab named after search engines. One field, one export, no copy.
 */
export function CanonicalField({ s, update }: Props) {
  const t = useAdminT()
  return (
    // `note=`: the hint belongs between the label and the field, not under it.
    <Input
      label={t.seoCanonical}
      note={t.seoCanonicalHint}
      value={s.siteUrl}
      onChange={(e) => update({ siteUrl: e.target.value })}
      placeholder="https://example.com"
    />
  )
}

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
        {/* The words go BESIDE the slot, not inside it. This slot is 144×80 and had room to
            hold them, which is why it was the one picker that did — and it put its button
            136px further right than every other picker's. Same three pieces, same order. */}
        <div className="flex flex-wrap items-center gap-3">
          {s.seo.ogFallbackImage ? (
            <img src={s.seo.ogFallbackImage} alt="OG" className="h-20 w-36 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800" />
          ) : (
            <span aria-hidden className={`${EMPTY_SLOT} h-20 w-36 shrink-0 rounded-lg`} />
          )}
          {!s.seo.ogFallbackImage && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{t.noImageSelected}</span>
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