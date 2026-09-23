// A list that mixes bullets and checkboxes.
//
// Found by the kitchen-sink document the tour opens, which is the fourth bug that suite has
// turned up and the only one that ADDS text to a post rather than deleting it: a `- [ ]`
// nobody wrote, appearing at the top and growing a backslash pair on every save after that.
// `components/MixedList.ts` has the mechanism.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { toHtml } from '@/md/index'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function roundTrip(source: string): Promise<string> {
  const { Editor } = await import('@/admin/editor/editor')
  const editor = new Editor({ element: document.createElement('div'), content: source })
  const out = editor.getMarkdown()
  editor.destroy()
  return out.trim()
}

describe('bullets and checkboxes in one list', () => {
  it('does not invent an empty checkbox', async () => {
    const out = await roundTrip('- một\n- hai\n\n- [x] ba\n- [ ] bốn\n')
    // The line that used to appear from nowhere, before anything the author wrote.
    expect(out.startsWith('- [ ]')).toBe(false)
    expect(out).toContain('một')
    expect(out).toContain('hai')
    expect(out).toContain('[x] ba')
    expect(out).toContain('[ ] bốn')
    expect(await roundTrip(out)).toBe(out)
  })

  it('keeps the order the author wrote', async () => {
    // Checkboxes first, bullets after — the split has to preserve the sequence, not group all
    // the checkboxes together.
    const out = await roundTrip('- [x] một\n\n- hai\n')
    // By the words, not by the marker: which bullet character the halves are written with is
    // the serializer's business and changed once already (see the last test in this file).
    expect(out.indexOf('[x] một')).toBeLessThan(out.indexOf('hai'))
    expect(await roundTrip(out)).toBe(out)
  })

  it('leaves an unmixed list exactly alone', async () => {
    // The split must be invisible to every list that is not mixed, which is nearly all of them.
    expect(await roundTrip('- một\n- hai\n- ba\n')).toBe('- một\n- hai\n- ba')
    expect(await roundTrip('1. một\n2. hai\n')).toBe('1. một\n2. hai')
    // A TIGHT CHECKLIST STAYS TIGHT since 2026-09-13. It came back `- [x] một\n\n- [ ] hai`
    // under the old bridge, whose list extension marked every task list loose — a blank line
    // per item, added to a file whose author had not written them.
    expect(await roundTrip('- [x] một\n- [ ] hai\n')).toBe('- [x] một\n- [ ] hai')
  })

  it('keeps a numbered list numbered when a checkbox joins it', async () => {
    const out = await roundTrip('1. một\n2. hai\n\n- [x] ba\n')
    expect(out).toContain('1. một')
    expect(out).toContain('- [x] ba')
    expect(await roundTrip(out)).toBe(out)
  })

  it('saves a mixed list as the ONE list it was, tight or loose', async () => {
    // `- a\n- b\n- [x] c` is one list to Markdown and two to this schema. Until 2026-09-23 the
    // save kept the halves apart with a second marker (`- a\n- b\n\n* [x] c`), which was the
    // honest reading of what the editor held — and it cost the published page: two lists
    // where there had been one, and a loose list's paragraph spacing gone from every item.
    // The parse now marks each run after the first as JOINED to the one above, and the save
    // puts them back together (release review, 2026-09-23).
    for (const source of ['- a\n- b\n- [x] c', '- a\n\n- [ ] b', '- a\n- [x] b\n- c', '3. one\n4. [ ] two\n5. three']) {
      const once = await roundTrip(`${source}\n`)
      expect(once).toBe(source)
      expect(toHtml(`${once}\n`)).toBe(toHtml(`${source}\n`))
    }
  })

  it('does not join two lists the author kept apart', async () => {
    // Anything written between them makes them two lists, and they stay two.
    const source = '- a\n\nbetween\n\n- [ ] b'
    expect(await roundTrip(`${source}\n`)).toBe(source)
  })
})
