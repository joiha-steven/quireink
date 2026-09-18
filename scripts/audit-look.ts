// Scratch harness for the 2026-09-14 looks audit. Not product.
// Puts the instance into a look through the product's own sanitiser, exactly as Save would.
import { openDatabases } from '@/store/db'
openDatabases(process.env.DATA_DIR ?? './data')
const { getSettings, saveSettings } = await import('@/content/settings')

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=') as [string, string]))
const before = await getSettings()
const next: any = { ...before }
if (args.look) next.look = args.look
if (args.home) next.home = { ...before.home, mode: args.home }
if (args.frontKind) next.home = { ...next.home, front: { ...next.home.front, kind: args.frontKind } }
if (args.chromeFont) next.chromeFont = args.chromeFont
if (args.fontPreset) next.fontPreset = args.fontPreset
if (args.sidebar) next.sidebarLayout = args.sidebar
if (args.scheme) next.defaultScheme = args.scheme
if (args.palette) next.themePreset = args.palette
await saveSettings(next)
const after = await getSettings()
console.log(`look=${after.look} home=${after.home.mode} chrome=${after.chromeFont} font=${after.fontPreset} palette=${after.themePreset}`)
