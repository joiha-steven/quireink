// The last row of the contents list, and the one thing it has to be: a link to something
// that is on the page.
//
// It was not, twice over (issue #63). The row names whichever end-of-article sections
// exist — "Tag / Category / Comments" — and picks one anchor to jump to. The comments
// branch pointed at `post-comments`, an id nothing has ever rendered, so on a post with
// no tags and no categories the row moved the page zero pixels. And the taxonomy branch
// points under the article, which above the rail breakpoint is `display:none` because the
// same facts are in the gutter panel; the browser half of that is in `assets/js/toc.ts`,
// and what is asserted here is that BOTH copies carry an id for it to choose between.
//
// The assertion is deliberately "the href resolves to an id in this document" rather than
// a literal name: a rename that keeps the two ends in step is not a regression, and one
// that does not is exactly this bug again.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { TOC_ANCHORS } from '@/render/toc'

const DIR = './.tmp/test-toc-end'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const html = async (path: string): Promise<string> => (await app.request(path)).text()

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
})

/** The href on the last row, and whether the document carries an element with that id. */
function endRow(page: string): { href: string; resolves: boolean } {
  const row = /<a class="rail-row link-accent t-small toc-end" href="#([^"]+)"/.exec(page)
  expect(row).not.toBeNull()
  const id = row![1]!
  return { href: id, resolves: page.includes(`id="${id}"`) }
}

describe('the contents list ends on a real anchor', () => {
  it('lands on the comments section when the post has no tags and no categories', async () => {
    const s = await getSettings()
    await saveSettings({ comments: { ...s.comments, enabled: true } })
    await savePost({ title: 'Bare', content: 'body text here', status: 'published' })

    const page = await html('/bare')
    const { href, resolves } = endRow(page)
    expect(href).toBe(TOC_ANCHORS.comments)
    // The id the section actually carries. It read `post-comments` for as long as the
    // constant existed, and nothing on the page has ever had that id.
    expect(page).toContain('<section id="comments"')
    expect(resolves).toBe(true)
  })

  it('lands on the taxonomy under the article when the post has tags', async () => {
    await savePost({
      title: 'Tagged', content: 'body text here', status: 'published',
      tags: ['craft'], categories: ['Typography'],
    })
    const page = await html('/tagged')
    const { href, resolves } = endRow(page)
    expect(href).toBe(TOC_ANCHORS.tags)
    expect(resolves).toBe(true)
  })

  // The gutter copy. Above the rail breakpoint the block the row points at is hidden and
  // this panel is the only taxonomy on screen, so the island swaps to these ids; without
  // them in the markup that swap has nowhere to go and the desktop bug is back.
  it('gives the gutter panel its own anchors for the island to swap to', async () => {
    await savePost({
      title: 'Tagged', content: 'body text here', status: 'published',
      tags: ['craft'], categories: ['Typography'],
    })
    const page = await html('/tagged')
    expect(page).toContain(`id="${TOC_ANCHORS.infoTags}"`)
    expect(page).toContain(`id="${TOC_ANCHORS.infoCategories}"`)
    // Both copies present, and their names distinct: one id, one element.
    expect(page).toContain(`id="${TOC_ANCHORS.tags}"`)
    expect(new Set(Object.values(TOC_ANCHORS)).size).toBe(Object.values(TOC_ANCHORS).length)
  })
})
