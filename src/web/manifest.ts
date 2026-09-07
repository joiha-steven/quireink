// The PWA manifest, built from the owner's settings so an installed app carries the live
// title, palette and uploaded icon.
//
// A thin descriptor, and only that. There IS a service worker now (ADR 0039), but it is off
// by default and it keeps only what the reader already read — it never prefetches, and it is
// registered from the page rather than announced here, so this file stays what it was: the
// title, the palette and the icon an installed app wears.

import type { Context } from 'hono'
import { getSettings, resolveAppIcon, getDefaultTheme } from '@/content/settings'

/**
 * Best-effort MIME from the icon's extension. Harmless to get wrong, but most installers
 * prefer an explicit type, and PNG is the bundled fallback.
 */
function iconType(url: string): string {
  const ext = url.split('?')[0]!.split('.').pop()?.toLowerCase()
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'ico') return 'image/x-icon'
  return 'image/png'
}

export async function handleManifest(_c: Context): Promise<Response> {
  const settings = await getSettings()
  const icon = resolveAppIcon(settings)
  const type = iconType(icon)
  const bg = getDefaultTheme(settings.themes, settings.themePreset).light.bg

  const manifest = {
    name: settings.title,
    short_name: settings.title,
    description: settings.description || undefined,
    lang: settings.language,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      // `any` at two sizes covers the home-screen icon without corner-cropping; the
      // `maskable` entry lets adaptive Android launchers theme it.
      { src: icon, sizes: '192x192', type, purpose: 'any' },
      { src: icon, sizes: '512x512', type, purpose: 'any' },
      { src: icon, sizes: '512x512', type, purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      // Short, not immutable: a saved title or icon should reach an installed app soon,
      // and this document is a few hundred bytes.
      'cache-control': 'public, max-age=300',
    },
  })
}
