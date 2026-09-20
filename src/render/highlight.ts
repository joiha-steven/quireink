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
//
// GRAMMARS ARE LOADED WHEN A FENCE ASKS FOR ONE, NOT AT STARTUP. This file used to name
// twenty-one languages and hand them all to `createHighlighter`, which is the wrong shape for
// a product other people install: it decided for every blog on earth that those twenty-one
// are the languages worth colouring, and it charged every one of them for all twenty-one
// whether they wrote in one or none of them. Measured 2026-09-16, one process each: preloading
// the twenty-one costs 41.5 MB of heap and 40 grammars in memory; loading on demand costs
// 2.6 MB and 5 grammars for a blog that writes bash, 2.7 MB and 2 for one that writes Python.
// A grammar arrives in 2 to 3ms, once per language per process, and the answer is cached
// afterwards. The output is byte-identical either way, which is the only reason this was
// allowed to change at all.
//
// AND NEITHER IS SHIKI ITSELF, since 2026-09-21. The paragraph above was true of the grammars
// and false of the engine and the bundle index that finds them: `import ... from 'shiki'` at
// the top of this file put both on the BOOT path of every install. Measured inside a
// container, which is where the number means something: +20.7 MB and 151 ms, before a single
// request, on a process whose whole resident floor is 44.8 MB. A blog that writes no code paid
// it forever and got nothing.
//
// It arrives on the first fence that names a language this process has not answered yet — and
// on a restart, usually never: the rendered BODY is cached in `render-cache.ts` and survives
// the process, so a boot that serves from that cache never reaches this file at all.

import type { Highlighter } from 'shiki'
import { readRendered, renderKey, writeRendered } from '@/render/render-cache'
import { detectLang } from '@/render/detect-lang'
import { plainCode } from '@/render/plain-code'

const THEMES = { light: 'vitesse-light', dark: 'vitesse-dark' } as const
const THEME_KEY = `${THEMES.light}/${THEMES.dark}`

// One highlighter instance per server process, created lazily on first use, holding no
// grammar until one is asked for.
let hl: Promise<Highlighter> | null = null
function highlighter(): Promise<Highlighter> {
  hl ??= import('shiki')
    .then((shiki) => shiki.createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [] }))
  return hl
}

/**
 * Every spelling Shiki answers to, mapped to the ONE id its grammar is filed under.
 *
 * Read out of the bundle rather than typed here: 346 languages and 104 aliases, and a
 * hand-kept copy of that would be wrong the day Shiki adds a language. The normalisation is
 * what keeps the cache honest — `bash`, `sh`, `zsh` and `shell` are one grammar, and without
 * this they would be four rows of identical HTML under four keys.
 */
let canon: Promise<Map<string, string>> | null = null
function canonical(): Promise<Map<string, string>> {
  canon ??= import('shiki').then(({ bundledLanguages, bundledLanguagesInfo }) => {
    const map = new Map<string, string>()
    for (const id of Object.keys(bundledLanguages)) map.set(id, id)
    for (const info of bundledLanguagesInfo) {
      map.set(info.id, info.id)
      for (const alias of info.aliases ?? []) map.set(alias, info.id)
    }
    return map
  })
  return canon
}

/**
 * The names people type that Shiki does NOT answer to.
 *
 * Every entry was checked against Shiki's own alias table and is absent from it; the ones
 * that used to sit here beside them (`typescript`, `sh`, `py`, `yml`, `md`, `c++` …) are
 * Shiki's already and were removed rather than shadowed. Names only, never a guess: each of
 * these is the same language under another spelling.
 *
 * Three backticks and `typescript` got no colour at all until 2026-08-15 — the grammar was in
 * memory, the fence said the word, and the lookup missed because the id is `ts`. The corpus
 * has had a fixture called `fence-alias` since the port recording exactly that.
 *
 * `terminal` points at `shellsession` and not at the shell SCRIPT it used to, which is also
 * where Shiki's own table sends `console`. A transcript is not a script, and the difference is
 * visible: measured 2026-09-16 on a paste of two commands and their replies, `shellscript`
 * painted the line `added 42 packages in 3s` in five colours because it read program output as
 * code, while `shellsession` dims the prompt, colours the command and leaves the reply alone.
 * `detect-lang.ts` opens by saying that colouring words inside program output makes a page look
 * broken rather than rich; this is that, on a fence that asked for it by name.
 */
const EXTRA: Record<string, string> = {
  node: 'js', terminal: 'shellsession', python3: 'python', golang: 'go', cc: 'cpp',
  htm: 'html', postgres: 'sql', postgresql: 'sql', mysql: 'sql', psql: 'sql', patch: 'diff',
}

/** The grammar this fence names, under any spelling — or null if it names none. */
const resolve = (table: Map<string, string>, lang: string): string | null => {
  const direct = table.get(lang)
  if (direct) return direct
  const alias = EXTRA[lang]
  return alias ? table.get(alias) ?? null : null
}

// One load per language per process, and one PROMISE per language: two code blocks in the
// same post reach here together, and without the shared promise both would start the same
// download of the same grammar.
const loads = new Map<string, Promise<boolean>>()
function ensureGrammar(h: Highlighter, id: string): Promise<boolean> {
  let p = loads.get(id)
  if (!p) {
    p = h.loadLanguage(id as Parameters<Highlighter['loadLanguage']>[0])
      .then(() => true)
      // A grammar that will not load is not a crash: the block falls back like any fence
      // naming a language nobody has. Dropped from the map so a transient failure can retry.
      .catch(() => { loads.delete(id); return false })
    loads.set(id, p)
  }
  return p
}

// The theme pair is part of the key even though it is currently a constant: changing it
// later must not serve the old colours out of a cache that cannot tell the difference.
const cacheKey = (code: string, lang: string): string => renderKey(lang, THEME_KEY, code)

// Highlight one code block to HTML (`<pre class="shiki">…`). `lang` comes from the
// Markdown fence (```ts). Returns null on any failure (highlighter init, a grammar that
// loads and then throws) so the caller falls back to the original escaped block.
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  // A fence that NAMED a language is obeyed, right or wrong — that is the writer's choice.
  // Only an unnamed one (marked `text` by `post-content.ts`) is guessed at, and `detectLang`
  // says `text` again unless it is sure. See `detect-lang.ts` for why it is deliberately timid.
  //
  // ⚠️ THE GUESS USED TO RUN FOR A NAMED FENCE TOO, and the comment above it has said since
  // the port that it does not. A named language the old twenty-one did not carry fell through
  // to `detectLang`, whose Python rule matches a line opening `def ` or `class ` — so ```ruby
  // and ```elixir were published COLOURED AS PYTHON. Measured 2026-09-16, both of them.
  // A name the reader typed is now answered or left alone, never reinterpreted.
  //
  // ⚠️ THE GUESS RUNS BEFORE SHIKI IS LOADED, which is the order that keeps a blog with no code
  // from ever paying for a syntax highlighter. `detectLang` is this repository's own and needs
  // nothing; only turning its answer into a grammar id does.
  const spelling = lang === 'text' ? detectLang(code) : lang
  if (spelling === 'text') return plainCode(code)
  const language = resolve(await canonical(), spelling) ?? 'text'

  // Nothing to highlight WITH, so nothing pretends to. `plain-code.ts` marks the two things
  // that are true in any notation and leaves the rest alone; it needs no grammar and no cache
  // row, so it returns before both.
  if (language === 'text') return plainCode(code)

  // KEYED ON THE RESOLVED LANGUAGE, not the one the fence gave. Written the other way first,
  // and every block already in `render_cache` would have kept serving its uncoloured HTML
  // until somebody cleared the cache by hand: the key said `text`, the row was a hit, and the
  // guesser below never ran. Keying on the answer makes the cache self-versioning — a block
  // that now resolves to `shellscript` is simply a different key, the old row goes inert, and
  // if these rules ever change their mind the same thing happens again with nothing to remember.
  const key = cacheKey(code, language)
  const cached = readRendered(key)
  if (cached !== null) return cached
  try {
    const h = await highlighter()
    if (!await ensureGrammar(h, language)) return plainCode(code)
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
