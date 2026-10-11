// NOTHING OUTSIDE THE THEME REGISTRY DECIDES WHAT TO DRAW BY A THEME'S NAME (ADR 0072).
//
// Nine places in the renderer used to branch on the look's name: the newspaper's menu in three
// files, its headline face in two, its figure labels, the source-code look's rail rules and its
// letter-spacing. They are fields in `content/themes-builtin.ts` now, which is what lets a theme
// the engine has never heard of ask for the same things. A tenth branch would quietly make one
// of the four special again, and nothing would go red: the page would still look right.
//
// So this reads the source: every `.ts` file under `src/` except the registry itself, the tests
// and the built bundles. In a stylesheet module (`*.css.ts`) the CSS inside its template literals
// is blanked first, because those rules are SUPPOSED to sit behind `html[data-look=<id>]`; the
// TypeScript around them is read like any other file. Comment lines are skipped. It refuses:
//  - the string 'plain', 'paper' or 'notes' anywhere, however it is used (a comparison, a
//    `case`, a Set, `includes`), and the string 'code' on a line that also says look or theme
//  - one of them as an object key (`paper: ...`), the shape every name-keyed table took
//  - the old field, `look`, read in any way: `.look`, `['look']`, `{ look } =`
//  - a built-in sheet's name compared or written ('look-paper'), and a theme's attribute
//    selector written in TS (`html[data-look=code]`, `data-theme="code"`)
// Each exemption below is ONE whole line, compared after trimming, so a new branch written on a
// different line of the same file is still caught. The patterns are proven at the foot of the
// file, on code that shipped before the registry and on the shapes a reviewer asked about.
//
// KNOWN GAPS. This test is a safety net, not proof: a branch written in one of these shapes
// passes it, and only a reviewer reading the diff catches it.
//  - `id === 'code'` on a line that does not also say look or theme
//  - `code:` as an object key (the word is too common in the tree to refuse on its own)
//  - a comparison split over two lines, the name on one and the `===` on the other
//  - any line that starts with `*`, read as a comment line even inside a template literal
//  - an expression inside a `${...}` of a `*.css.ts` template, blanked with the CSS around it
//  - a second copy of an exempt line in the same file, exempt along with the first
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const IDS = '(?:plain|code|paper|notes)'
const Q = `['"\`]`
const PATTERNS: { what: string; re: RegExp }[] = [
  { what: 'a theme name as a string', re: new RegExp(`${Q}(?:plain|paper|notes)${Q}`) },
  { what: "'code' beside a look or a theme", re: new RegExp(`(?=.*${Q}code${Q})(?=.*\\b(?:look|theme)\\b)`, 'i') },
  // A key opening the line or following `{` or `,`; not a parameter typed `notes: Note[]`.
  { what: 'a theme name as an object key', re: /(?:^|[{,]\s*)(?:plain|paper|notes)\s*:(?!\s*[A-Z]\w*(?:\[\])?\s*(?:[,=)]|$))/ },
  { what: 'a read of the old `look` field', re: /\.look\b|\[\s*['"]look['"]\s*\]|\{[^}]*\blook\b[^}]*\}\s*=/ },
  { what: "a built-in sheet's name", re: new RegExp(`${Q}look-${IDS}${Q}|(?:===|!==)\\s*${Q}look-`) },
  { what: "a theme's attribute selector in TS", re: new RegExp(`data-(?:look|theme)=\\\\?["']?${IDS}\\b`) },
]

/** One exempt line: the file, the whole line as written (trimmed), and why it is not a branch. */
type Exempt = { file: string; line: string; why: string }
const NOT_A_THEME: Exempt[] = [
  { file: "src/types-settings.ts", line: "head: 'plain' | 'tint' | 'rule' | 'ink'", why: "the table head style" },
  { file: "src/types.ts", line: "export type SiteLook = 'plain' | 'code' | 'paper' | 'notes'", why: "the type of the old field, which still exists" },
  { file: "src/content/autosave.ts", line: "const TABLE: Record<AutosaveKind, string> = { post: 'posts', page: 'pages', note: 'notes' }", why: "the notes table" },
  { file: "src/content/notes.ts", line: "return all<NoteRow>(`select ${META_COLS} from notes where ${liveOnly('notes')} order by date desc`)", why: "the notes table" },
  { file: "src/content/notes.ts", line: "from notes where ${liveOnly('notes')} and slug = ?`, slug)", why: "the notes table" },
  { file: "src/content/settings-save.ts", line: "const look = isBuiltinThemeId(input.look) ? input.look : null", why: "takes `look` as an alias on a write" },
  { file: "src/content/settings-save.ts", line: "if (look !== null && look !== current.look) return look", why: "takes `look` as an alias on a write" },
  { file: "src/content/settings-table.ts", line: "const HEADS = ['plain', 'tint', 'rule', 'ink'] as const", why: "the table head style" },
  { file: "src/content/settings-table.ts", line: "plain: { bg: 'transparent', fg: 'var(--c-text)', rule: '1' },", why: "the table head style" },
  { file: "src/content/settings.ts", line: "if (isBuiltinThemeId(stored.look)) return stored.look", why: "reads a row written before `theme`" },
  { file: "src/content/slugs.ts", line: "'admin', 'login', 'micropub', 'notes', 'og', 'search', 'setup', 'uploads', 'webmention',", why: "the /notes route reserves its slug" },
  { file: "src/import/quireink.ts", line: "const folderOf = (name: string): 'posts' | 'pages' | 'notes' | null => {", why: "the notes folder of an export" },
  { file: "src/import/quireink.ts", line: "return m ? (m[1] as 'posts' | 'pages' | 'notes') : null", why: "the notes folder of an export" },
  { file: "src/import/quireink.ts", line: "} else if (folder === 'notes') {", why: "the notes folder of an export" },
  { file: "src/media/media-usage.ts", line: "for (const table of ['posts', 'pages', 'notes'] as const) {", why: "the notes table" },
  { file: "src/server/export-md.ts", line: "const counts = { posts: 0, pages: 0, notes: 0 }", why: "the notes count of an export" },
  { file: "src/server/scheduled.ts", line: "const window = (table: 'posts' | 'notes') => all<{ slug: string; date: number; status: string }>(", why: "the notes table" },
  { file: "src/server/scheduled.ts", line: "const rows = [...window('posts'), ...window('notes')]", why: "the notes table" },
  { file: "src/web/api-v1.ts", line: "notes: `${site}/api/v1/notes`,", why: "the notes endpoint" },
  { file: "src/web/served-css.ts", line: "'look-code': minifyCss(LOOK_CODE_CSS),", why: "every served sheet by its file name; the registry names which a theme links" },
  { file: "src/web/served-css.ts", line: "'look-paper': minifyCss(LOOK_PAPER_CSS),", why: "every served sheet by its file name; the registry names which a theme links" },
  { file: "src/web/served-css.ts", line: "'look-notes': minifyCss(LOOK_NOTES_CSS),", why: "every served sheet by its file name; the registry names which a theme links" },
  { file: "src/web/setup-routes.ts", line: "const theme = form.theme ?? form.look", why: "a setup page served before the rename" },
  { file: "src/admin/components/CaptionedImage.ts", line: "(v: FrameInk) => v === '' ? w.siteDefault : v === 'paper' ? w.framePaper : w.frameInk,", why: "the figure frame colour" },
  { file: "src/admin/components/image-frag.ts", line: "export type FrameInk = '' | 'paper' | 'ink'", why: "the figure frame colour" },
  { file: "src/admin/components/image-frag.ts", line: "export const FRAME_INKS: FrameInk[] = ['', 'paper', 'ink']", why: "the figure frame colour" },
  { file: "src/admin/components/image-frag.ts", line: "ink: !tokens.includes('frame') ? '' : tokens.includes('ink') ? 'ink' : tokens.includes('paper') ? 'paper' : '',", why: "the figure frame colour" },
  { file: "src/web/admin/ops.ts", line: "posts: importedPosts, pages: importedPages, notes: importedNotes,", why: "the notes count of an import" },
  { file: "src/web/admin/site.ts", line: "type Kind = 'posts' | 'pages' | 'notes' | 'media' | 'files' | 'comments' | 'subscribers'", why: "the trash kind, the notes table" },
  { file: "src/web/admin/site.ts", line: "const KINDS: Kind[] = ['posts', 'pages', 'notes', 'media', 'files', 'comments', 'subscribers']", why: "the trash kind, the notes table" },
  { file: "src/web/admin/site.ts", line: "posts: 'post', pages: 'page', notes: 'note', media: 'media', files: 'file', comments: 'comment',", why: "the trash kind, the notes table" },
  { file: "src/web/admin/site.ts", line: "case 'notes':", why: "the trash kind, the notes table" },
  { file: "src/web/admin/stale.ts", line: "const TABLE = { post: 'posts', page: 'pages', note: 'notes' } as const", why: "the notes table" },
  { file: "src/admin/island/lib/overlay-toast.ts", line: "const LIFE = { plain: 3200, action: 6000 } as const", why: "a plain toast" },
  { file: "src/admin/island/lib/settings-cloud.ts", line: "key.textContent = s.latest ? fill(w.updateTo, { v: s.latest }) : w.look ?? ''", why: "the Cloudflare card’s words, one of them named look" },
  { file: "src/web/admin/screens/log.ts", line: "const TITLED = { post: 'posts', page: 'pages', note: 'notes' } as const", why: "the notes table" },
  { file: "src/web/admin/screens/settings-post.ts", line: "['plain', t.tableHeadPlain], ['tint', t.tableHeadTint],", why: "the table head style" },
  { file: "src/web/admin/screens/trash.ts", line: "export type Kind = 'posts' | 'pages' | 'notes' | 'media' | 'files' | 'comments' | 'subscribers'", why: "the trash kind, the notes table" },
  { file: "src/web/admin/screens/trash.ts", line: "const KINDS: Kind[] = ['posts', 'pages', 'notes', 'media', 'files', 'comments', 'subscribers']", why: "the trash kind, the notes table" },
  { file: "src/web/admin/screens/trash.ts", line: "posts: all.posts.length, pages: all.pages.length, notes: all.notes.length,", why: "the trash kind, the notes table" },
  { file: "src/web/admin/screens/trash.ts", line: "notes: pageOf(all.notes, 'notes'), media: pageOf(all.media, 'media'),", why: "the trash kind, the notes table" },
  { file: "src/web/admin/screens/trash.ts", line: "{ key: 'notes', label: `${t.tabNotes} (${counts.notes})` },", why: "the trash kind, the notes table" },
  { file: "src/web/admin/screens/trash.ts", line: "+ panel(t, 'notes', open, slugRows(t, settings.language, siteZone(settings.timezone), 'notes', notes), keys('notes'))", why: "the trash kind, the notes table" },
]

const REGISTRY = 'src/content/themes-builtin.ts'

function sources(): string[] {
  return (readdirSync('src', { recursive: true }) as string[])
    .map((name) => join('src', name).replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('.d.ts')
      && path !== REGISTRY && !path.includes('/dist/'))
}

/** The CSS inside a stylesheet module's template literals, blanked, line breaks kept. */
function blankTemplates(source: string): string {
  let out = ''
  let inside = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    if (c === '`' && source[i - 1] !== '\\') { inside = !inside; out += c; continue }
    out += inside && c !== '\n' ? ' ' : c
  }
  return out
}

const isComment = (line: string): boolean => /^(?:\/\/|\*|\/\*)/.test(line)

/** Every line in `source` that names a theme, as `file:line: text (what)`, minus the exempt ones. */
function themeBranches(file: string, raw: string, exempt: Exempt[] = NOT_A_THEME): string[] {
  const source = file.endsWith('.css.ts') ? blankTemplates(raw) : raw
  const out: string[] = []
  source.split('\n').forEach((text, i) => {
    const line = text.trim()
    if (isComment(line)) return
    if (exempt.some((x) => x.file === file && x.line === line)) return
    for (const { what, re } of PATTERNS) {
      if (re.test(line)) out.push(`${file}:${i + 1}: ${line} (${what})`)
    }
  })
  return out
}

describe('the theme registry is the only place that knows a theme by name', () => {
  it('reads all of src, the stylesheets included', () => {
    // A moved directory would make this pass by reading nothing.
    const files = sources()
    expect(files.length).toBeGreaterThan(500)
    for (const f of ['src/web/layout.ts', 'src/render/font-faces.ts', 'src/web/look-paper.css.ts',
      'src/admin/island/lib/overlay-news.ts', 'src/mcp/tools-steward.ts']) expect(files).toContain(f)
    expect(files).not.toContain(REGISTRY)
  })

  it('finds no branch on a theme name outside the registry', () => {
    const found = sources().flatMap((file) => themeBranches(file, readFileSync(file, 'utf8')))
    expect(found).toEqual([])
  })

  it('every exemption is still one line of its file, so none outlives its reason', () => {
    for (const x of NOT_A_THEME) {
      const lines = readFileSync(x.file, 'utf8').split('\n').map((l) => l.trim())
      expect({ file: x.file, line: x.line, found: lines.includes(x.line) })
        .toEqual({ file: x.file, line: x.line, found: true })
    }
  })
})

describe('the patterns catch what they are for', () => {
  const hits = (file: string, source: string): number => themeBranches(file, source).length

  it('catches each shape the nine branches took before the registry', () => {
    // Verbatim from the code before ADR 0072.
    const shipped = [
      "${siteHeader(settings, { mailConfigured, menuInHeader: settings.look === 'paper' })}",
      "  if (look !== 'code') return ''",
      "const LOOKS_OFF_THE_CHROME_FONT = new Set(['paper', 'notes'])",
      "const trackLook = CHROME_TRACKED.map((s) => `html[data-look=code] ${s}`).join(',')",
      '    fontFaceCss(settings.fontPreset, settings.chromeFont, settings.look),',
      "      case 'paper': return paperLabelCss(lang)",
      "  const names: Record<SiteLook, string> = { plain: t.lookPlain, code: t.lookCode }",
    ]
    for (const line of shipped) expect({ line, n: hits('src/web/x.ts', line) > 0 }).toEqual({ line, n: true })
  })

  it('catches the shapes a review named, in the files a review named', () => {
    const named: [string, string][] = [
      ['src/content/settings-save.ts', "  if (input.look === 'paper') return 'paper'"],
      ['src/web/x.ts', "const ONLY = new Set(['paper'])"],
      ['src/web/x.ts', 'const header = { paper: true }[settings.theme] ?? false'],
      ['src/web/x.ts', 'const { look } = settings'],
      ['src/web/x.ts', "if (theme.sheet === 'look-paper') return ''"],
      ['src/web/x.ts', "const worn = settings['look']"],
      ['src/web/x.ts', "if (['code', 'notes'].includes(settings.theme)) return"],
      ['src/web/x.ts', "const mono = settings.theme === 'code'"],
    ]
    for (const [file, line] of named) expect({ line, n: hits(file, line) > 0 }).toEqual({ line, n: true })
  })

  it('reads the TypeScript of a stylesheet module and skips only its CSS', () => {
    const sheet = [
      'export const X_CSS = `',
      'html[data-look=paper] .prose{margin:0}',
      '`.trim()',
      "export const pick = (theme: string): string => theme === 'paper' ? X_CSS : ''",
    ].join('\n')
    expect(themeBranches('src/web/x.css.ts', sheet)).toEqual([
      "src/web/x.css.ts:4: export const pick = (theme: string): string => theme === 'paper' ? X_CSS : '' (a theme name as a string)",
    ])
  })

  it('an exemption covers its one line and no other, even in the same file', () => {
    const exempt: Exempt[] = [{ file: 'src/web/admin/site.ts', line: "case 'notes':", why: 'test' }]
    const source = "      case 'notes':\n      case 'notes': if (settings.theme === 'code') return"
    expect(themeBranches('src/web/admin/site.ts', source, exempt).map((h) => h.split(': ')[0]))
      .toEqual(['src/web/admin/site.ts:2', 'src/web/admin/site.ts:2'])
    // ...and in another file it exempts nothing.
    expect(themeBranches('src/web/x.ts', "case 'notes':", exempt)).toHaveLength(1)
  })

  it('leaves comments and the words in them alone', () => {
    expect(hits('src/web/x.ts', "  // the newspaper ('paper') puts its menu in the masthead")).toBe(0)
    expect(hits('src/web/x.ts', "   * settings.look === 'paper' used to live here")).toBe(0)
  })
})
