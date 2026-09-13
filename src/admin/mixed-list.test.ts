// A list that mixes bullets and checkboxes.
//
// Found by the kitchen-sink document the tour opens, which is the fourth bug that suite has
// turned up and the only one that ADDS text to a post rather than deleting it: a `- [ ]`
// nobody wrote, appearing at the top and growing a backslash pair on every save after that.
// `components/MixedList.ts` has the mechanism.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function roundTrip(source: string): Promise<string> {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const editor = new Editor({ extensions: editorExtensions(''), content: source })
  const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
  editor.destroy()
  return out.trim()
}

describe('bullets and checkboxes in one list', () => {
  it('does not invent an empty checkbox', async () => {
    const out = await roundTrip('- một\n- hai\n\n- [x] ba\n- [ ] bốn\n')
    // The line that used to appear from nowhere, before anything the author wrote.
    expect(out.startsWith('- [ ]')).toBe(false)
    expect(out).toContain('- một')
    expect(out).toContain('- hai')
    expect(out).toContain('- [x] ba')
    expect(out).toContain('- [ ] bốn')
    expect(await roundTrip(out)).toBe(out)
  })

  it('keeps the order the author wrote', async () => {
    // Checkboxes first, bullets after — the split has to preserve the sequence, not group all
    // the checkboxes together.
    const out = await roundTrip('- [x] một\n\n- hai\n')
    expect(out.indexOf('- [x] một')).toBeLessThan(out.indexOf('- hai'))
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

  it('settles the TIGHT mixed list on the FIRST save, and then holds', async () => {
    // `- a\n- b\n- [x] c` is one list to Markdown and two to this schema, so a save has to put
    // a blank line in to keep the halves apart. That is the whole cost, and it is paid once.
    //
    // ⚠️ IT USED TO COST MORE, and the difference is what `MarkdownTightLists` did. Markdown
    // says a blank line ANYWHERE in a list makes the whole list loose, so the old bridge read
    // its own output back as one loose list and spaced every bullet out on the second save —
    // the test this replaces asserted `twice !== once` and pinned that as unavoidable. It was
    // not. The editor no longer stores looseness as an attribute and `md/from-editor.ts`
    // infers it from what an item HOLDS, so two tight lists read back as two tight lists.
    const once = await roundTrip('- a\n- b\n- [x] c\n')
    expect(once).toBe('- a\n- b\n\n- [x] c')
    expect(await roundTrip(once)).toBe(once)
    // What matters most: every item is still there, and there is no invented one.
    expect(once).toContain('- a')
    expect(once).toContain('- b')
    expect(once).toContain('- [x] c')
    expect(once.startsWith('- [ ]')).toBe(false)
  })
})
