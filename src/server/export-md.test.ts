// THE EXPORT IS ONLY WORTH ANYTHING IF IT COMES BACK.
//
// "It produced a folder of Markdown" is not a property; every mistake in a serializer produces
// a folder of Markdown. So the case that matters here is a round trip: save a piece with every
// field it can hold, export it, read it back with `import/quireink.ts`, and compare — field by
// field, against what the database says, not against what this file expected.
//
// The second thing tested here is a NEGATIVE with a counter-test attached: no credential may
// leave in the bundle. A search that finds nothing is also what a broken search looks like, so
// the same case asserts that a value which SHOULD be in there is found by the same means.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost, getPost, deletePost } from '@/content/posts'
import { savePage, getPage } from '@/content/pages'
import { saveNote, getNote } from '@/content/notes'
import { saveSettings } from '@/content/settings'
import {
  buildExportZip, exportTextFiles, frontMatter, yamlString, yamlValue,
} from '@/server/export-md'
import { isQuireInk, parseFrontMatter, parseQuireInk } from '@/import/quireink'
import { unzip } from '@/import/unzip'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = './.tmp/test-export-md'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const NOW = '2026-09-19T00:00:00.000Z'
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'post_revisions', 'pages', 'notes', 'settings', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

/** Export, then read the one file back. */
const roundTrip = async (path: string) => {
  const files = await exportTextFiles()
  const file = files.find((f) => f.path === path)
  expect(file, `${path} is in the bundle`).toBeDefined()
  return parseQuireInk([{ name: path, text: file!.text }], NOW)
}

describe('the YAML the export writes', () => {
  it('survives every shape a title can take', () => {
    // Each of these means something OTHER than itself as a plain YAML scalar, which is the
    // whole reason `yamlString` has one spelling and no cleverness.
    const awkward = [
      'Plain', '', 'yes', 'no', 'null', '~', '- a list?', ': a colon', '#hash', '[bracket]',
      '{brace}', '"quoted"', 'back\\slash', 'tab\there', 'line\nbreak', 'carriage\rreturn',
      'vertical\u000Btab', 'Ngay mai, 2 gio chieu', 'Thu gui me', 'emoji wave', '   spaces   ',
      '2026-09-19', '3.14', 'a: b: c',
    ]
    for (const raw of awkward) {
      const head = frontMatter([['title', raw], ['slug', 'x']])
      const back = parseFrontMatter(`${head}\nbody\n`)
      expect(back, `front matter for ${JSON.stringify(raw)} reads back`).not.toBeNull()
      // An empty string is OMITTED rather than written as "", so it reads back as absent.
      expect(back!.fields.title ?? '').toBe(raw)
    }
  })

  it('writes numbers, booleans and lists in their own spellings', () => {
    expect(yamlValue(3)).toBe('3')
    expect(yamlValue(true)).toBe('true')
    expect(yamlValue(false)).toBe('false')
    expect(yamlValue(['a', 'b'])).toBe('["a", "b"]')
    expect(yamlString('a"b\\c')).toBe('"a\\"b\\\\c"')
    // A category with a comma is one item, not two — the reader splits between scalars.
    const back = parseFrontMatter(`${frontMatter([['tags', ['Books, read', 'b']]])}\nx\n`)
    expect(back!.fields.tags).toEqual(['Books, read', 'b'])
  })

  it('refuses a block it cannot read rather than guessing at it', () => {
    expect(parseFrontMatter('no front matter here')).toBeNull()
    expect(parseFrontMatter('---\ntitle: unquoted\n---\n\nx')).toBeNull()
    expect(parseFrontMatter('---\nnever closed\n')).toBeNull()
    // A rule in the BODY is a rule, not a second block.
    const doc = parseFrontMatter('---\ntitle: "T"\n---\n\nabove\n\n---\n\nbelow\n')
    expect(doc!.body).toBe('above\n\n---\n\nbelow')
  })
})

describe('a post survives the round trip', () => {
  it('keeps every field the database holds', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
    await savePost({
      title: 'Thu gui me: mot buoi chieu',
      slug: 'thu-gui-me',
      date: PAST,
      status: 'published',
      categories: ['Suy nghi', 'Books, read'],
      tags: ['craft', 'thu'],
      series: 'Nhung la thu',
      seriesOrder: 2,
      excerpt: 'Mot doan "trich" voi dau ngoac kep.',
      coverImage: '/uploads/media/cover.webp',
      featuredImage: '/uploads/media/og.webp',
      metaTitle: 'Thu gui me',
      metaDescription: 'Mo ta co gach dai.',
      content: [
        '## Mot tieu de', '', 'Doan co ==but da==, ++gach chan++ va `ma`.', '',
        '![anh](/uploads/media/photo.webp)', '', '| a | b |', '| - | - |', '| 1 | 2 |', '',
        '> [!NOTE] Mot callout', '', '$$x^2$$', '', '```ts', 'const a: number = 1', '```',
      ].join('\n'),
    })

    const saved = (await getPost('thu-gui-me'))!
    const post = (await roundTrip('posts/thu-gui-me.md')).posts[0]!

    expect(post.title).toBe(saved.title)
    expect(post.slug).toBe(saved.slug)
    expect(post.date).toBe(saved.date)
    expect(post.status).toBe(saved.status)
    expect(post.categories).toEqual(saved.categories)
    expect(post.tags).toEqual(saved.tags)
    expect(post.series).toBe(saved.series!)
    expect(post.seriesOrder).toBe(saved.seriesOrder!)
    expect(post.excerpt).toBe(saved.excerpt!)
    expect(post.coverImage).toBe(saved.coverImage!)
    expect(post.featuredImage).toBe(saved.featuredImage!)
    expect(post.metaTitle).toBe(saved.metaTitle!)
    expect(post.metaDescription).toBe(saved.metaDescription!)
    // The body, character for character. Every other assertion here is about a line of front
    // matter; this is the writing.
    expect(post.content).toBe(saved.content)
  })

  it('carries a draft, and marks it as one', async () => {
    await savePost({ title: 'Dang viet', content: 'chua xong', status: 'draft', date: PAST })
    await savePost({ title: 'Da dang', content: 'xong', status: 'published', date: PAST })
    const names = (await exportTextFiles()).map((f) => f.path)
    // Both halves: a bundle missing the draft would pass "the draft is marked" vacuously.
    expect(names).toContain('posts/dang-viet.md')
    expect(names).toContain('posts/da-dang.md')
    const back = await roundTrip('posts/dang-viet.md')
    expect(back.posts[0]!.status).toBe('draft')
  })

  it('leaves the trash out, and keeps what is live', async () => {
    await savePost({ title: 'O lai', content: 'x', status: 'published', date: PAST })
    await savePost({ title: 'Bo di', content: 'x', status: 'published', date: PAST })
    await deletePost('bo-di')
    const names = (await exportTextFiles()).map((f) => f.path)
    expect(names).toContain('posts/o-lai.md')
    expect(names).not.toContain('posts/bo-di.md')
  })
})

describe('a page and a note survive too', () => {
  it('keeps a page', async () => {
    await savePage({ title: 'Gioi thieu', content: 'Ve toi.', status: 'published',
      featuredImage: '/uploads/media/about.webp' })
    const saved = (await getPage('gioi-thieu'))!
    const page = (await roundTrip('pages/gioi-thieu.md')).pages[0]!
    expect(page.title).toBe(saved.title)
    expect(page.status).toBe(saved.status)
    expect(page.featuredImage).toBe(saved.featuredImage!)
    expect(page.content).toBe(saved.content)
  })

  it('keeps a clip with where it came from', async () => {
    await saveNote({
      title: 'Cay but say', content: 'Toi nghi ve cau nay.', status: 'published', date: PAST,
      sourceUrl: 'https://example.com/reed', sourceTitle: 'The reed pen',
      quote: 'every stroke starts wet, and dries as it goes',
    })
    const saved = (await getNote('cay-but-say'))!
    const note = (await roundTrip('notes/cay-but-say.md')).notes![0]!
    expect(note.title).toBe(saved.title)
    expect(note.date).toBe(saved.date)
    expect(note.sourceUrl).toBe(saved.sourceUrl!)
    expect(note.sourceTitle).toBe(saved.sourceTitle!)
    expect(note.quote).toBe(saved.quote!)
    expect(note.content).toBe(saved.content)
  })
})

describe('what the bundle must not carry', () => {
  it('carries the settings and NOT a credential', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
    // A value in the table this module's header promises it never reads. Bound, not spliced.
    db().run(
      `insert into integration_keys (id, turnstile_secret_key, cloudflare_api_token, smtp_pass)
       values (1, ?, ?, ?)
       on conflict(id) do update set turnstile_secret_key = excluded.turnstile_secret_key,
         cloudflare_api_token = excluded.cloudflare_api_token, smtp_pass = excluded.smtp_pass`,
      ['SECRET-turnstile-9aa', 'SECRET-cloudflare-9bb', 'SECRET-smtp-9cc'],
    )
    const whole = (await exportTextFiles()).map((f) => f.text).join('\n')
    for (const secret of ['SECRET-turnstile-9aa', 'SECRET-cloudflare-9bb', 'SECRET-smtp-9cc']) {
      expect(whole).not.toContain(secret)
    }
    // THE COUNTER-TEST. The three lines above are also satisfied by an empty bundle, or by a
    // `site.json` that failed to render. A value that IS the owner's settings must be found by
    // the same search, or those lines prove nothing.
    expect(whole).toContain('"title": "My Blog"')
    expect(whole).toContain('"siteUrl": "https://example.com"')
  })

  it('names no entry that could escape the folder it is unpacked into', async () => {
    await savePost({ title: '../../etc/passwd', content: 'x', status: 'published', date: PAST })
    await savePost({ title: 'Binh thuong', content: 'x', status: 'published', date: PAST })
    const names = (await exportTextFiles()).map((f) => f.path)
    expect(names.length).toBeGreaterThan(2)
    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
      expect(name.split('/')).not.toContain('..')
    }
  })
})

describe('the archive', () => {
  it('builds a ZIP our own reader recognises as a Quire Ink bundle', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'quire-export-'))
    try {
      await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
      await savePost({ title: 'Hello', content: 'body', status: 'published', date: PAST })
      await saveNote({ title: 'A note', content: 'x', status: 'published', date: PAST })

      const dest = join(dir, 'export.zip')
      const size = await buildExportZip(dest)
      expect(size).toBeGreaterThan(0)

      const dec = new TextDecoder()
      const entries = unzip(new Uint8Array(await Bun.file(dest).arrayBuffer()))
        .map(({ name, bytes }) => ({ name, text: dec.decode(bytes) }))
      const names = entries.map((e) => e.name)
      expect(names).toContain('posts/hello.md')
      expect(names).toContain('notes/a-note.md')
      expect(names).toContain('site.json')
      expect(names).toContain('README.md')
      // The sniff the import route uses. Without it the bundle is a folder of Markdown that
      // nothing claims, which is how an import silently refuses.
      expect(isQuireInk(entries)).toBe(true)
      // And it does not claim somebody else's archive: a folder of Markdown with no settings
      // is what half the static site generators in the world produce.
      expect(isQuireInk([{ name: 'posts/x.md', text: '---\ntitle: "T"\n---\n\nx\n' }])).toBe(false)

      const parsed = parseQuireInk(entries, NOW)
      expect(parsed.posts).toHaveLength(1)
      expect(parsed.notes).toHaveLength(1)
      expect(parsed.skipped).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
