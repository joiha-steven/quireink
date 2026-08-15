// Server-side syntax highlighting with Shiki, now backed by a content-addressed cache.
//
// Dual-theme output (Vitesse light/dark, muted by design to fit the minimal reading
// surface): every token carries both a light color and a `--shiki-dark` CSS var, and the
// stylesheet swaps to the dark var under `.dark`. A failed highlight returns null so the
// caller keeps the plain block.
//
// Shiki is the heaviest thing on the read path, so its output is stored in `render_cache`
// keyed by its own input (01-schema.md section 4). There is no invalidation problem: a
// changed code block is simply a different key, and a stale row is inert. A miss
// re-highlights and stores, so a cold database renders correctly and merely slower.
// Only highlighting is cached, NOT the rendered body: a body cache would have to key on
// media variants, theme and locale, which is the invalidation graph Invariant 1 avoids.

import { createHighlighter, type Highlighter } from 'shiki'
import { readRendered, renderKey, writeRendered } from '@/render/render-cache'
import { detectLang } from '@/render/detect-lang'

// Curated language set — common on a writing/tech blog. Unknown languages fall
// back to plain text (still themed, no token colors). Keep this list small: each
// language adds to the WASM grammar load.
const LANGS = [
  'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'bash', 'shell', 'python',
  'go', 'rust', 'sql', 'yaml', 'markdown', 'diff', 'php', 'java', 'c', 'cpp', 'swift',
] as const

const THEMES = { light: 'vitesse-light', dark: 'vitesse-dark' } as const
const THEME_KEY = `${THEMES.light}/${THEMES.dark}`

// One highlighter instance per server process, created lazily on first use.
let hl: Promise<Highlighter> | null = null
function highlighter(): Promise<Highlighter> {
  hl ??= createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [...LANGS] })
  return hl
}

const loaded = new Set<string>(LANGS)

// The theme pair is part of the key even though it is currently a constant: changing it
// later must not serve the old colours out of a cache that cannot tell the difference.
const cacheKey = (code: string, lang: string): string => renderKey(lang, THEME_KEY, code)

// Highlight one code block to HTML (`<pre class="shiki">…`). `lang` comes from the
// Markdown fence (```ts). Returns null on any failure (unknown lang load error,
// highlighter init) so the caller falls back to the original escaped block.
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  // A fence that NAMED a language is obeyed, right or wrong — that is the writer's choice.
  // Only an unnamed one (marked `text` by the caller) is guessed at, and `detectLang` says
  // `text` again unless it is sure. See `detect-lang.ts` for why it is deliberately timid.
  const named = loaded.has(lang) ? lang : null
  const language = named ?? detectLang(code)

  // KEYED ON THE RESOLVED LANGUAGE, not the one the fence gave. Written the other way first,
  // and every block already in `render_cache` would have kept serving its uncoloured HTML
  // until somebody cleared the cache by hand: the key said `text`, the row was a hit, and the
  // guesser below never ran. Keying on the answer makes the cache self-versioning — a block
  // that now resolves to `bash` is simply a different key, the old row goes inert, and if
  // these rules ever change their mind the same thing happens again with nothing to remember.
  const key = cacheKey(code, language)
  const cached = readRendered(key)
  if (cached !== null) return cached
  try {
    const h = await highlighter()
    const html = h.codeToHtml(code, {
      lang: language,
      themes: THEMES,
      defaultColor: 'light', // light inline as the base; dark via --shiki-dark var
    })
    writeRendered(key, html)
    return html
  } catch {
    return null
  }
}
