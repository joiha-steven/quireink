// What macOS and Windows put into a folder or a zip by themselves, which no theme means to ship.
//
// ONE LIST, read by the installer (`read-package.ts`, which leaves these entries out of a zip
// without inflating them) and by `theme:check` on a folder (which leaves them out of the folder it
// packs). Measured 2026-11-03: since macOS 15 every file carries a `com.apple.provenance`
// attribute, so Finder's Compress writes a `__MACOSX/._<name>` copy of every file it zips, the
// theme's own included, and a `.DS_Store` lands in every folder Finder has shown. Refusing them
// refused every zip Finder made. Any OTHER hidden name (`.htaccess`, `.git/`) is still refused:
// nobody's operating system wrote it.

/** The folder Finder puts its resource copies in, at the top of the zip. */
export const OS_LITTER_FOLDERS: readonly string[] = ['__MACOSX']
/** File names, compared without case: Windows writes `Thumbs.db` and `desktop.ini` in either. */
export const OS_LITTER_NAMES: readonly string[] = ['.DS_Store', 'Thumbs.db', 'desktop.ini']
/** AppleDouble files, `._<name>`, which carry a file's attributes beside it. */
export const OS_LITTER_PREFIX = '._'

const folders = new Set(OS_LITTER_FOLDERS.map((n) => n.toLowerCase()))
const names = new Set(OS_LITTER_NAMES.map((n) => n.toLowerCase()))

/** Whether one file or folder NAME (no slash) is something the operating system adds. */
export function isOsLitterName(name: string): boolean {
  const lower = name.toLowerCase()
  return folders.has(lower) || names.has(lower) || name.startsWith(OS_LITTER_PREFIX)
}

/**
 * Whether a zip entry's PATH is one: anything under `__MACOSX/` at the top, or a file whose own
 * name is on the list. A theme's file is never one of these: the package standard already refuses
 * every name that starts with a dot or is not on its short list (`check-files.ts`).
 */
export function isOsLitterPath(path: string): boolean {
  const parts = path.replace(/\/$/, '').split('/')
  if (folders.has((parts[0] ?? '').toLowerCase())) return true
  return isOsLitterName(parts.at(-1) ?? '')
}
