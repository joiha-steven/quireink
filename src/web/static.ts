// The files a reader's browser fetches directly: reading fonts, the favicon, the app icon.
//
// Every one is imported with `with { type: 'file' }`, which yields a path that `Bun.file`
// reads and that `bun build --compile` EMBEDS. That is the whole reason they are listed by
// name rather than read from a directory at runtime: a compiled Quire Ink is one binary, and a
// binary that needs a `public/` folder beside it is not one binary.
//
// The list is explicit and slightly tedious on purpose. There is no glob import that the
// compiler can follow, so a font that is not named here is a font that silently 404s in
// production and works in development. That failure mode already happened once: every page
// preloaded `/fonts/inter-latin.woff2` and nothing served it, so the site's reading font
// never loaded and the typography settings were inert.
//
// Next's scaffolding SVGs (`next.svg`, `vercel.svg`, `window.svg`, `globe.svg`, `file.svg`)
// were deliberately NOT carried over. Nothing referenced them.

import appIcon from '@/assets/static/app-icon.png' with { type: 'file' }
import favicon from '@/assets/static/favicon.ico' with { type: 'file' }
import inter_latin from '@/assets/static/fonts/inter-latin.woff2' with { type: 'file' }
import inter_latin_ext from '@/assets/static/fonts/inter-latin-ext.woff2' with { type: 'file' }
import inter_vietnamese from '@/assets/static/fonts/inter-vietnamese.woff2' with { type: 'file' }
import jetbrainsmono_latin from '@/assets/static/fonts/jetbrainsmono-latin.woff2' with { type: 'file' }
import jetbrainsmono_latin_ext from '@/assets/static/fonts/jetbrainsmono-latin-ext.woff2' with { type: 'file' }
import jetbrainsmono_vietnamese from '@/assets/static/fonts/jetbrainsmono-vietnamese.woff2' with { type: 'file' }
import literata_latin from '@/assets/static/fonts/literata-latin.woff2' with { type: 'file' }
import literata_latin_ext from '@/assets/static/fonts/literata-latin-ext.woff2' with { type: 'file' }
import literata_vietnamese from '@/assets/static/fonts/literata-vietnamese.woff2' with { type: 'file' }
import plexmono_400_latin from '@/assets/static/fonts/plexmono-400-latin.woff2' with { type: 'file' }
import plexmono_400_latin_ext from '@/assets/static/fonts/plexmono-400-latin-ext.woff2' with { type: 'file' }
import plexmono_400_vietnamese from '@/assets/static/fonts/plexmono-400-vietnamese.woff2' with { type: 'file' }
import plexmono_600_latin from '@/assets/static/fonts/plexmono-600-latin.woff2' with { type: 'file' }
import plexmono_600_latin_ext from '@/assets/static/fonts/plexmono-600-latin-ext.woff2' with { type: 'file' }
import plexmono_600_vietnamese from '@/assets/static/fonts/plexmono-600-vietnamese.woff2' with { type: 'file' }
import sourcesans_latin from '@/assets/static/fonts/sourcesans-latin.woff2' with { type: 'file' }
import sourcesans_latin_ext from '@/assets/static/fonts/sourcesans-latin-ext.woff2' with { type: 'file' }
import sourcesans_vietnamese from '@/assets/static/fonts/sourcesans-vietnamese.woff2' with { type: 'file' }
import sourceserif_latin from '@/assets/static/fonts/sourceserif-latin.woff2' with { type: 'file' }
import sourceserif_latin_ext from '@/assets/static/fonts/sourceserif-latin-ext.woff2' with { type: 'file' }
import sourceserif_vietnamese from '@/assets/static/fonts/sourceserif-vietnamese.woff2' with { type: 'file' }

/** Request path to the on-disk (or embedded) file behind it. */
const FILES: Record<string, string> = {
  '/app-icon.png': appIcon,
  '/favicon.ico': favicon,
  '/fonts/inter-latin.woff2': inter_latin,
  '/fonts/inter-latin-ext.woff2': inter_latin_ext,
  '/fonts/inter-vietnamese.woff2': inter_vietnamese,
  '/fonts/jetbrainsmono-latin.woff2': jetbrainsmono_latin,
  '/fonts/jetbrainsmono-latin-ext.woff2': jetbrainsmono_latin_ext,
  '/fonts/jetbrainsmono-vietnamese.woff2': jetbrainsmono_vietnamese,
  '/fonts/literata-latin.woff2': literata_latin,
  '/fonts/literata-latin-ext.woff2': literata_latin_ext,
  '/fonts/literata-vietnamese.woff2': literata_vietnamese,
  '/fonts/plexmono-400-latin.woff2': plexmono_400_latin,
  '/fonts/plexmono-400-latin-ext.woff2': plexmono_400_latin_ext,
  '/fonts/plexmono-400-vietnamese.woff2': plexmono_400_vietnamese,
  '/fonts/plexmono-600-latin.woff2': plexmono_600_latin,
  '/fonts/plexmono-600-latin-ext.woff2': plexmono_600_latin_ext,
  '/fonts/plexmono-600-vietnamese.woff2': plexmono_600_vietnamese,
  '/fonts/sourcesans-latin.woff2': sourcesans_latin,
  '/fonts/sourcesans-latin-ext.woff2': sourcesans_latin_ext,
  '/fonts/sourcesans-vietnamese.woff2': sourcesans_vietnamese,
  '/fonts/sourceserif-latin.woff2': sourceserif_latin,
  '/fonts/sourceserif-latin-ext.woff2': sourceserif_latin_ext,
  '/fonts/sourceserif-vietnamese.woff2': sourceserif_vietnamese,
}

const TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  png: 'image/png',
  ico: 'image/x-icon',
}

/** Every path this module can serve. The router registers each one explicitly. */
export const staticPaths = (): string[] => Object.keys(FILES)

/**
 * Serve one static file, or null when the path is not one of ours.
 *
 * Cached hard: these names change only when the file does, and a font is the LCP resource
 * on an article page, so a revalidation round-trip on every visit is exactly what the
 * preload in the head exists to avoid.
 */
export async function staticFile(path: string): Promise<Response | null> {
  const file = FILES[path]
  if (!file) return null
  const ext = path.split('.').pop() ?? ''
  return new Response(Bun.file(file), {
    headers: {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
