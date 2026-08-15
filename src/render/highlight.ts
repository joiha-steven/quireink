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
import { plainCode } from '@/render/plain-code'

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

/**
 * The names people actually type for grammars that are already loaded.
 *
 * `LANGS` is a list of Shiki IDs, and a writer types the language's NAME. Three backticks and
 * `typescript` got no colour at all until 2026-08-15 — the grammar was in memory, the fence
 * said the word, and the lookup missed because the ID is `ts`. The corpus has had a fixture
 * called `fence-alias` since the port recording exactly that, rendering as plain text.
 *
 * Names only, never a guess: every entry here is the same language under another spelling.
 */
const ALIASES: Record<string, string> = {
  typescript: 'ts', javascript: 'js', node: 'js', mjs: 'js', cjs: 'js',
  sh: 'bash', zsh: 'bash', shell: 'bash', console: 'bash', terminal: 'bash',
  py: 'python', python3: 'python', rb: 'ruby', golang: 'go', rs: 'rust',
  yml: 'yaml', md: 'markdown', 'c++': 'cpp', cc: 'cpp', htm: 'html',
  postgres: 'sql', postgresql: 'sql', mysql: 'sql', psql: 'sql', patch: 'diff',
}

/** The loaded grammar this fence names, under any spelling — or null if it names none. */
const resolve = (lang: string): string | null => {
  if (loaded.has(lang)) return lang
  const alias = ALIASES[lang]
  return alias && loaded.has(alias) ? alias : null
}

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
  const named = resolve(lang)
  const language = named ?? detectLang(code)

  // KEYED ON THE RESOLVED LANGUAGE, not the one the fence gave. Written the other way first,
  // and every block already in `render_cache` would have kept serving its uncoloured HTML
  // until somebody cleared the cache by hand: the key said `text`, the row was a hit, and the
  // guesser below never ran. Keying on the answer makes the cache self-versioning — a block
  // that now resolves to `bash` is simply a different key, the old row goes inert, and if
  // these rules ever change their mind the same thing happens again with nothing to remember.
  // Nothing to highlight WITH, so nothing pretends to. `plain-code.ts` marks the two things
  // that are true in any notation and leaves the rest alone; it needs no grammar, no WASM and
  // no cache row, so it returns before all three.
  if (language === 'text') return plainCode(code)

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
