// A PIECE, SAID IN ANOTHER LANGUAGE — the rule, and the three surfaces that read it.
//
// The rule is `groupsOf`, which is pure and is tested here directly. The surfaces are the
// article's `<html lang>` and `<link rel="alternate">`, the sitemap's `<xhtml:link>`, and the
// line a reader presses; all three are asserted against a real request, because the failure
// that matters is not "the function returned the wrong array" but "the two documents disagree",
// and only the documents can show that.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost, getPost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { groupsOf, langOf, siblingsOf, translationGroups, groupMembersLine } from '@/content/translations'

const DIR = './.tmp/test-translations'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'
const html = async (path: string): Promise<string> => (await app.request(path)).text()

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'redirects']) {
    db().run(`delete from ${t}`)
  }
  await saveSettings({ title: 'Blog', siteUrl: 'https://example.com', language: 'vi' })
})

/** A published post in one language and one group. */
const post = (title: string, lang: string | undefined, group?: string, date = PAST) =>
  savePost({ title, content: 'x', status: 'published', date, lang, translationGroup: group } as never)

describe('the rule', () => {
  const piece = (slug: string, lang: string | undefined, group?: string) =>
    ({ piece: { slug, title: slug, lang, translationGroup: group } as never, path: `/${slug}` })

  it('puts every member in the set, INCLUDING itself', () => {
    const groups = groupsOf([piece('vi', 'vi', 'g'), piece('en', 'en', 'g')], 'vi')
    // The classic hreflang fault is a set that names only the others. A crawler that finds an
    // asymmetric set is entitled to ignore the group, so both entries carry both members.
    expect(groups.get('vi')!.map((s) => s.lang).sort()).toEqual(['en', 'vi'])
    expect(groups.get('en')!.map((s) => s.lang).sort()).toEqual(['en', 'vi'])
  })

  it('reads a piece with no language as the site’s, and one alone as nothing', () => {
    expect(langOf({}, 'vi')).toBe('vi')
    expect(langOf({ lang: 'en' }, 'vi')).toBe('en')
    // A group of one is not a group. Without this a piece would advertise an alternate set
    // containing only itself, which says nothing and is one more line on every page.
    expect(groupsOf([piece('only', 'en', 'g')], 'vi').size).toBe(0)
    expect(groupsOf([piece('a', 'en'), piece('b', 'vi')], 'vi').size).toBe(0)
  })

  it('drops a whole group when two pieces resolve to one language', () => {
    // Deduping would be kinder and would produce an INVALID document: the piece that lost the
    // tie publishes a set it is not in. Both are dropped, on every surface, and the editor's
    // panel still lists them so the owner can see what they did.
    expect(groupsOf([piece('a', 'vi', 'g'), piece('b', 'vi', 'g')], 'vi').size).toBe(0)
    // ⚠️ AND THE COLLISION CAN BE IMPLICIT. Neither of these names a language, so both are the
    // site's — a pair somebody made by filling the group and forgetting the language, which is
    // the likeliest way to reach this at all.
    expect(groupsOf([piece('a', undefined, 'g'), piece('b', undefined, 'g')], 'vi').size).toBe(0)
    // The counter-test: the same two, told apart, ARE a group.
    expect(groupsOf([piece('a', undefined, 'g'), piece('b', 'en', 'g')], 'vi').size).toBe(2)
  })

  it('keeps two different groups apart', () => {
    const groups = groupsOf([
      piece('a1', 'vi', 'one'), piece('a2', 'en', 'one'),
      piece('b1', 'vi', 'two'), piece('b2', 'en', 'two'),
    ], 'vi')
    expect(groups.get('a1')!.map((s) => s.path)).toEqual(['/a1', '/a2'])
    expect(groups.get('b1')!.map((s) => s.path)).toEqual(['/b1', '/b2'])
  })
})

describe('what the article says', () => {
  it('names its own language, its siblings, and itself', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await post('A letter', 'en', 'thu')

    const vi = await html('/thu-gui-me')
    expect(vi).toContain('<html lang="vi"')
    expect(vi).toContain('<link rel="alternate" hreflang="vi" href="https://example.com/thu-gui-me">')
    expect(vi).toContain('<link rel="alternate" hreflang="en" href="https://example.com/a-letter">')
    // x-default goes to the site's own language: it is what a search engine offers a reader
    // whose language is in none of the set.
    expect(vi).toContain('<link rel="alternate" hreflang="x-default" href="https://example.com/thu-gui-me">')

    // RECIPROCAL. The other half has to carry the same set, or the pair is asymmetric and a
    // crawler may drop it whole — which is exactly what one side of a pair looks like when
    // somebody wires the links from the piece rather than from the group.
    const en = await html('/a-letter')
    expect(en).toContain('<html lang="en"')
    expect(en).toContain('hreflang="vi" href="https://example.com/thu-gui-me"')
    expect(en).toContain('hreflang="en" href="https://example.com/a-letter"')
    expect(en).toContain('hreflang="x-default" href="https://example.com/thu-gui-me"')
  })

  it('says nothing at all on a piece nobody has paired', async () => {
    await post('Alone', undefined)
    const page = await html('/alone')
    // The counter-test is the case above: without it "no alternates" is also true of a page
    // that failed to render.
    expect(page).toContain('<html lang="vi"')
    expect(page).not.toContain('rel="alternate" hreflang')
  })

  it('prints the switcher in the language of the PIECE, not of the site', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await post('A letter', 'en', 'thu')
    // "Cũng có bằng English" under an English headline is wrong for the only person who reads
    // it. The label follows `<html lang>`; the rest of the chrome does not, and ADR 0056 says
    // why that stops here.
    expect(await html('/thu-gui-me')).toContain('Cũng có bằng')
    const en = await html('/a-letter')
    expect(en).toContain('Also in')
    expect(en).not.toContain('Cũng có bằng')
    // Each link names the language in ITS OWN words and carries `lang`, because a screen
    // reader in a Vietnamese document pronounces "English" as Vietnamese otherwise.
    expect(en).toContain('hreflang="vi" lang="vi">Tiếng Việt</a>')
  })

  it('never advertises a translation that is not published yet', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await savePost({ title: 'A letter', content: 'x', status: 'draft', date: PAST,
      lang: 'en', translationGroup: 'thu' } as never)
    await savePost({ title: 'Tomorrow', content: 'x', status: 'published', date: FUTURE,
      lang: 'de', translationGroup: 'thu' } as never)
    clearCache()

    const vi = await html('/thu-gui-me')
    // A draft and a scheduled piece are not public anywhere else on this site either, and a
    // translation set is the easiest place to forget it: the editor's own panel lists both.
    expect(vi).not.toContain('hreflang="en"')
    expect(vi).not.toContain('hreflang="de"')
    // With both hidden the group is one piece, which is not a group.
    expect(vi).not.toContain('rel="alternate" hreflang')
    // The counter-test: publish the draft and the pair appears.
    const draft = (await getPost('a-letter'))!
    await savePost({ ...draft, status: 'published' }, 'a-letter')
    clearCache()
    expect(await html('/thu-gui-me')).toContain('hreflang="en" href="https://example.com/a-letter"')
  })
})

describe('what the sitemap says', () => {
  it('carries the same set, and declares the namespace only when it used one', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await post('A letter', 'en', 'thu')
    await post('Alone', undefined)
    const map = await html('/sitemap.xml')
    expect(map).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    // ONE RULE, TWO SURFACES: the article and the sitemap have to agree, and a crawler that
    // finds them disagreeing is entitled to believe neither.
    for (const loc of ['/thu-gui-me', '/a-letter']) {
      const entry = map.split('\n').find((l: string) => l.includes(`<loc>https://example.com${loc}</loc>`))!
      expect(entry).toContain('hreflang="vi" href="https://example.com/thu-gui-me"')
      expect(entry).toContain('hreflang="en" href="https://example.com/a-letter"')
    }
    const alone = map.split('\n').find((l: string) => l.includes('/alone</loc>'))!
    expect(alone).not.toContain('xhtml:link')
  })

  it('declares no xhtml namespace on a blog that has never paired anything', async () => {
    await post('Alone', undefined)
    const map = await html('/sitemap.xml')
    expect(map).not.toContain('xmlns:xhtml')
    // The counter-test for the line above: the document really was built.
    expect(map).toContain('<loc>https://example.com/alone</loc>')
  })

  it("carries a PAGE alternates too, not only a post", async () => {
    await savePage({ title: 'About', content: 'x', status: 'published', lang: 'en', translationGroup: 'me' } as never)
    await savePage({ title: 'Gioi thieu', content: 'x', status: 'published', lang: 'vi', translationGroup: 'me' } as never)
    const map = await html('/sitemap.xml')
    const entry = map.split('\n').find((l: string) => l.includes('/about</loc>'))!
    expect(entry).toContain('hreflang="vi" href="https://example.com/gioi-thieu"')
    expect(await html('/about')).toContain('<html lang="en"')
  })
})

describe('what the editor is offered', () => {
  it('offers the groups already in use, drafts included', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await savePost({ title: 'Nhap', content: 'x', status: 'draft', date: PAST,
      lang: 'en', translationGroup: 'ban-nhap' } as never)
    // ⚠️ DRAFTS INCLUDED, and only here. A translation is written before it is published, so
    // offering only the live groups would hide the name at the exact moment it is being typed.
    expect(await translationGroups()).toEqual(['ban-nhap', 'thu'])
  })

  it('lists the group’s other members, drafts included and itself excluded', async () => {
    await post('Thu gui me', 'vi', 'thu')
    await savePost({ title: 'A letter', content: 'x', status: 'draft', date: PAST,
      lang: 'en', translationGroup: 'thu' } as never)
    const line = await groupMembersLine('thu-gui-me', 'thu')
    expect(line).toContain('English')
    expect(line).toContain('A letter')
    expect(line).not.toContain('Thu gui me')
    expect(await groupMembersLine('thu-gui-me', '')).toBe('')
  })
})

describe('what a bad value does', () => {
  it('reads a language this blog does not have as nobody having said', async () => {
    await savePost({ title: 'Odd', content: 'x', status: 'published', date: PAST,
      lang: 'klingon', translationGroup: 'g' } as never)
    // The column is free text and this door is also the MCP tool's and the importer's. An
    // unknown code is the same fact as an empty one, which is what the site already handles.
    expect((await getPost('odd'))!.lang).toBeUndefined()
    expect(await html('/odd')).toContain('<html lang="vi"')
  })

  it('reads a blank group as no group', async () => {
    await savePost({ title: 'Blank', content: 'x', status: 'published', date: PAST,
      lang: 'en', translationGroup: '   ' } as never)
    const saved = (await getPost('blank'))!
    expect(saved.translationGroup).toBeUndefined()
    expect(await siblingsOf(saved, await (await import('@/content/settings')).getSettings())).toEqual([])
  })
})

describe('an agent can set it too', () => {
  it('keeps the pair through an MCP create and update', async () => {
    // ⚠️ `update_post` is a REPLACE — a field the tool's schema does not name comes back
    // undefined and overwrites what was there. So a language an agent cannot SET is a language
    // an agent ERASES the moment it touches the post, silently, on a blog whose whole pitch is
    // that an agent can run it.
    const { registerTools } = await import('@/mcp/tools')
    const tools = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>()
    const shapes = new Map<string, Record<string, unknown>>()
    registerTools({
      registerTool: (
        name: string, spec: { inputSchema?: Record<string, unknown> },
        run: (a: Record<string, unknown>) => Promise<unknown>,
      ) => {
        tools.set(name, run)
        shapes.set(name, spec.inputSchema ?? {})
      },
    } as never)

    // ⚠️ THE DECLARED SHAPE, not the handler. A first cut here called the handler with the
    // fields and passed — because this harness never applies the zod schema, so removing the
    // field from the tool's declaration changed nothing and the guard could not go red. What
    // an agent may SEND is the `inputSchema`, and that is the thing to assert.
    for (const tool of ['create_post', 'update_post', 'create_page', 'update_page']) {
      const shape = shapes.get(tool)
      expect(shape, `${tool} is registered`).toBeDefined()
      expect(Object.keys(shape!), tool).toContain('lang')
      expect(Object.keys(shape!), tool).toContain('translationGroup')
    }

    await tools.get('create_post')!({
      title: 'Agent piece', content: 'x', status: 'published', date: PAST,
      lang: 'en', translationGroup: 'agent',
    })
    expect((await getPost('agent-piece'))!.lang).toBe('en')
    expect((await getPost('agent-piece'))!.translationGroup).toBe('agent')

    // And the counter-test that matters: an update that names them keeps them.
    await tools.get('update_post')!({
      slug: 'agent-piece', title: 'Agent piece', content: 'x2', status: 'published', date: PAST,
      lang: 'en', translationGroup: 'agent',
    })
    const after = (await getPost('agent-piece'))!
    expect(after.lang).toBe('en')
    expect(after.translationGroup).toBe('agent')
    expect(after.content).toBe('x2')
  })
})
