// THE WRITING, IN A SHAPE THAT OUTLIVES THIS SOFTWARE.
//
// The backup beside this file (`backup.ts`) answers "put my install back": two SQLite files
// and the blob store, restorable by Quire Ink and by nothing else. This answers a different
// question, and until 2.2.13 nothing here answered it at all — "take my writing somewhere
// else". A blog that imports from WordPress, Ghost, Substack and Medium and exports to none
// of them is a blog whose owner is, in the only sense that matters, locked in.
//
// So: Markdown with YAML front matter, one file per piece, plus the uploads tree and the
// settings. That is the shape every static site generator already eats, the shape a human can
// read in ten years with no software at all, and — because `import/quireink.ts` reads it back
// — a shape whose losslessness is a test rather than a hope.
//
// WHAT IS NOT HERE, and deliberately: revisions, the activity log, analytics, subscribers,
// comments, sessions, and every credential. This is the writing, not the install. Anyone who
// wants the install has the backup, which is one button along.

import type { Note, Page, Post, SiteSettings } from '@/types'
import { getIndex, getPost } from '@/content/posts'
import { getPageIndex, getPage } from '@/content/pages'
import { getNoteIndex, getNote } from '@/content/notes'
import { getSettings } from '@/content/settings'
import { uploadsDir } from '@/server/backup'
import { ZipWriter } from '@/import/zip-write'
import { readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'

export type YamlValue = string | number | boolean | string[]

/**
 * ONE SPELLING FOR EVERY STRING: the double-quoted scalar.
 *
 * YAML has nine ways to write a string and eight of them have a case that bites. A title
 * beginning `- `, holding `: `, opening with `[`, reading `yes`, or being empty each mean
 * something other than itself unquoted, and a plain-scalar emitter has to know all of them.
 * The double-quoted form has exactly two characters to escape and no exceptions at all, so
 * that is the only form written here. It is noisier to read and impossible to get wrong.
 */
export function yamlString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (ch === '\\') out += '\\\\'
    else if (ch === '"') out += '\\"'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\r') out += '\\r'
    // Everything else below a space has no printable spelling, and several of them are
    // what arrives from an import or a word processor. `\uXXXX` is YAML's own escape.
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, '0')}`
    else out += ch
  }
  return `${out}"`
}

export function yamlValue(v: YamlValue): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return `[${v.map(yamlString).join(', ')}]`
  return yamlString(v)
}

/**
 * The block, from the fields that have a value.
 *
 * A field is omitted when it is undefined, an empty string or an empty list — not written as
 * `""` — so the file a reader opens carries what the piece actually has and nothing else.
 * `false` and `0` ARE written: they are values somebody chose.
 */
export function frontMatter(fields: readonly (readonly [string, YamlValue | undefined])[]): string {
  const lines = fields
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${yamlValue(v!)}`)
  return `---\n${lines.join('\n')}\n---\n`
}

/** Front matter, a blank line, the body, and exactly one newline at the end. */
const withBody = (head: string, body: string): string => `${head}\n${body.replace(/\s+$/, '')}\n`

export const postFile = (p: Post & { content: string }): string => withBody(frontMatter([
  ['title', p.title], ['slug', p.slug], ['date', p.date], ['status', p.status],
  ['categories', p.categories], ['tags', p.tags],
  ['series', p.series], ['seriesOrder', p.series ? p.seriesOrder ?? 0 : undefined],
  ['excerpt', p.excerpt], ['coverImage', p.coverImage], ['featuredImage', p.featuredImage],
  ['metaTitle', p.metaTitle], ['metaDescription', p.metaDescription],
  ['readingMinutes', p.readingMinutes], ['updatedAt', p.updatedAt],
]), p.content)

export const pageFile = (p: Page & { content: string }): string => withBody(frontMatter([
  ['title', p.title], ['slug', p.slug], ['status', p.status],
  ['featuredImage', p.featuredImage], ['updatedAt', p.updatedAt],
]), p.content)

export const noteFile = (n: Note & { content: string }): string => withBody(frontMatter([
  ['title', n.title], ['slug', n.slug], ['date', n.date], ['status', n.status],
  ['sourceUrl', n.sourceUrl], ['sourceTitle', n.sourceTitle], ['quote', n.quote],
  ['updatedAt', n.updatedAt],
]), n.content)

/**
 * What the bundle says about itself.
 *
 * ENGLISH, like the in-admin Help and for the same reason: it is read by whoever is moving
 * the blog, which may be years from now and may not be the person who wrote it.
 */
const readme = (settings: SiteSettings, counts: Record<string, number>): string =>
  `# ${settings.title || 'A blog'} — export

Written by Quire Ink. Everything here is a plain file; nothing needs Quire Ink to read it.
Every \`.md\` file is Markdown under a YAML front matter block, with the writing unchanged.

    posts/     ${counts.posts}
    pages/     ${counts.pages}
    notes/     ${counts.notes}
    uploads/   the pictures and files the writing points at
    site.json  the blog's settings, as the admin held them

**Image paths are absolute** — a body says \`/uploads/media/photo.webp\`, which is what the
live site serves. Put the \`uploads\` folder at the root of wherever this goes and every
picture resolves. An importer that would rather have relative paths can drop the leading
slash; nothing else in the text needs touching.

**Drafts are included**, marked \`status: "draft"\` in their front matter. So is every piece
that was scheduled for a date that has not arrived.

**Not included:** revisions, comments, subscribers, analytics, the activity log, and every
password, key and token. This is the writing. A full install lives in the backup archive
instead, which the same screen offers.
`

/** A name that cannot escape the folder it is unpacked into, whatever produced it. */
const SAFE_ENTRY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
const safeName = (name: string): boolean =>
  SAFE_ENTRY.test(name) && !name.split('/').includes('..')

/**
 * `quire-writing-2026-09-19T2040.zip` — a sibling of `snapshotName`, and deliberately NOT the
 * same word. Both land in the same Downloads folder and they are not interchangeable: one puts
 * the install back, the other carries the writing somewhere else.
 */
export function exportName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `quire-writing-${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`
    + `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}.zip`
}

export type ExportFile = { path: string; text: string }

/**
 * Every text file the bundle carries: the writing, the settings and the note to the reader.
 *
 * Separated from the archive because this is the part with a FORMAT, and a format is worth
 * testing without a container around it — `export-md.test.ts` reads these strings straight,
 * and `import/quireink.ts` reads them back to prove the round trip.
 */
export async function exportTextFiles(): Promise<ExportFile[]> {
  const settings = await getSettings()
  const files: ExportFile[] = []
  const counts = { posts: 0, pages: 0, notes: 0 }

  // Drafts included, trash excluded: `getIndex` and its two siblings are the admin's own
  // lists, which is exactly the set the owner would say is "my writing".
  for (const meta of await getIndex()) {
    const full = await getPost(meta.slug)
    if (full) { files.push({ path: `posts/${full.slug}.md`, text: postFile(full) }); counts.posts++ }
  }
  for (const meta of await getPageIndex()) {
    const full = await getPage(meta.slug)
    if (full) { files.push({ path: `pages/${full.slug}.md`, text: pageFile(full) }); counts.pages++ }
  }
  for (const meta of await getNoteIndex()) {
    const full = await getNote(meta.slug)
    if (full) { files.push({ path: `notes/${full.slug}.md`, text: noteFile(full) }); counts.notes++ }
  }

  // THE WHOLE SETTINGS OBJECT, and it holds no credential: keys, tokens and passwords live
  // in `integration_keys` and the `users` table, which nothing here reads. `media-usage.ts`
  // made the opposite argument about a HAND-PICKED list of fields and was right both times —
  // a list goes stale, an object does not. `export-md.test.ts` plants a secret and looks for
  // it, so this stays true as settings grow.
  files.push({ path: 'site.json', text: `${JSON.stringify(settings, null, 2)}\n` })
  files.push({ path: 'README.md', text: readme(settings, counts) })
  return files.filter((f) => safeName(f.path))
}

/** Every file under the blob store, as `uploads/<relative path>` and its place on disk. */
async function uploadEntries(root: string): Promise<{ name: string; from: string }[]> {
  const out: { name: string; from: string }[] = []
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const from = join(dir, item.name)
      const name = posix.join(prefix, item.name)
      if (item.isDirectory()) await walk(from, name)
      else if (item.isFile() && safeName(name)) out.push({ name, from })
    }
  }
  await walk(root, 'uploads')
  return out
}

/**
 * Build the bundle at `dest`. Returns its size in bytes.
 *
 * Streamed to disk rather than assembled in memory, for the reason `buildArchive` learned by
 * being OOM-killed: the blob store may be gigabytes, and a download is not worth holding one.
 */
export async function buildExportZip(dest: string): Promise<number> {
  const sink = Bun.file(dest).writer()
  const zip = new ZipWriter(sink)
  for (const file of await exportTextFiles()) zip.addText(file.path, file.text)
  const root = uploadsDir()
  if (existsSync(root)) {
    for (const entry of await uploadEntries(root)) await zip.addFile(entry.name, entry.from)
  }
  zip.finish()
  await sink.end()
  return (await stat(dest)).size
}
