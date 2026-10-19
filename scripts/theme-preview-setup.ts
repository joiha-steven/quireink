// Puts a theme into the seeded instance `theme:preview` photographs, through the product's own
// doors: the installer the `POST /api/themes` route calls, and the settings writer Save uses.
//
//   DATA_DIR=<dir> bun scripts/theme-preview-setup.ts install <theme.zip>
//   DATA_DIR=<dir> bun scripts/theme-preview-setup.ts cell <theme id> <list|front> <image|text> <palette|-> <reading font|-> <chrome font|->
//
// `install` also adds the one kind of post the matrix's fixture lacks: a post with no title
// (ADR 0064), whose list entry and page are drawn differently from a titled one.
import { readFileSync } from 'node:fs'
import { openDatabases } from '@/store/db'

openDatabases(process.env.DATA_DIR ?? './data')
const { getSettings, saveSettings } = await import('@/content/settings')
const { savePost } = await import('@/content/posts')
const { installTheme } = await import('@/content/installed-themes')

// `theme-preview-plan.ts` asks for this address (`post-untitled`).
const UNTITLED_SLUG = 'a-short-post-with-no-title'

const [command, ...rest] = process.argv.slice(2)

if (command === 'install' && rest[0]) {
  const result = await installTheme(new Uint8Array(readFileSync(rest[0])))
  if (!result.ok) {
    throw new Error(`the installer refused the theme: ${result.violations.map((v) => `${v.rule} ${v.file} ${v.subject}`).join('; ')}`)
  }
  await savePost({
    title: '', slug: UNTITLED_SLUG, status: 'published', date: '2026-07-28T09:00:00.000Z',
    content: 'A short post with no title: a thought, a link with a line under it, a small announcement. '
      + 'The list shows its first words where a title would be.',
    tags: ['craft'],
  })
  console.log(`installed ${result.id} ${result.version} ${result.hash.slice(0, 12)}`)
} else if (command === 'cell' && rest.length === 6) {
  const [themeId, mode, kind, palette, reading, chrome] = rest as [string, string, string, string, string, string]
  const before = await getSettings()
  const wantMode = mode === 'front' ? 'front' : 'list'
  const wantKind = kind === 'image' ? 'image' : 'text'
  await saveSettings({
    ...before,
    theme: themeId,
    ...(palette !== '-' ? { themePreset: palette } : {}),
    ...(reading !== '-' ? { fontPreset: reading } : {}),
    ...(chrome !== '-' ? { chromeFont: chrome } : {}),
    home: { ...before.home, mode: wantMode, front: { ...before.home.front, kind: wantKind } },
  })
  // The writer quietly keeps the stored value for anything it does not accept; a cell photographed
  // in the wrong theme is worse than no cell, so what was asked for is read back and checked.
  const after = await getSettings()
  const wrong: string[] = []
  if (after.theme !== themeId) wrong.push(`theme ${after.theme} != ${themeId}`)
  if (palette !== '-' && after.themePreset !== palette) wrong.push(`palette ${after.themePreset} != ${palette}`)
  if (reading !== '-' && after.fontPreset !== reading) wrong.push(`reading font ${after.fontPreset} != ${reading}`)
  if (chrome !== '-' && after.chromeFont !== chrome) wrong.push(`chrome font ${after.chromeFont} != ${chrome}`)
  if (after.home.mode !== wantMode) wrong.push(`home.mode ${after.home.mode} != ${wantMode}`)
  if (after.home.front.kind !== wantKind) wrong.push(`home.front.kind ${after.home.front.kind} != ${wantKind}`)
  if (wrong.length) throw new Error(`settings were not saved as asked: ${wrong.join('; ')}`)
  console.log(`theme=${after.theme} home=${after.home.mode} kind=${after.home.front.kind} palette=${after.themePreset}`)
} else {
  throw new Error('usage: theme-preview-setup.ts install <zip> | cell <theme id> <list|front> <image|text> <palette|-> <reading|-> <chrome|->')
}
