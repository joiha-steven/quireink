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

  it('settles the TIGHT mixed list on the FIRST save, and then holds', async () => {
    // `- a\n- b\n- [x] c` is one list to Markdown and two to this schema, so a save has to keep
    // the halves apart. That is the whole cost, and it is paid once.
    //
    // ⚠️ A BLANK LINE DOES NOT KEEP THEM APART, which is the correction of 2026-09-19 and the
    // reason the second marker below is `*`. This test used to pin `- a\n- b\n\n- [x] c` and
    // called the blank line the whole cost, on the reasoning that looseness is inferred from
    // what an item holds rather than stored — true of `md/from-editor.ts`, and not the
    // question. The question is what the READER'S parser does with that text, and measured:
    //
    //     - a / - b / (blank) / - [x] c   →   ONE list, tight=false, three <li><p>
    //
    // So the save that was supposed to cost a blank line in the source actually spaced every
    // item of the list out on the published page, on a list whose author had written it tight.
    // Markdown's own way to say "a new list starts here" is a different marker, and the two
    // halves then read back as two TIGHT lists, which is what the editor is holding.
    const once = await roundTrip('- a\n- b\n- [x] c\n')
    expect(once).toBe('- a\n- b\n\n* [x] c')
    expect(await roundTrip(once)).toBe(once)
    // The law that the string above cannot state: no item gained a paragraph, so no item
    // gained the space around one.
    expect(toHtml(once)).not.toContain('<li>\n<p>')
    expect(toHtml(once)).toBe(toHtml('- a\n- b\n\n* [x] c\n'))
    // What matters most: every item is still there, and there is no invented one.
    expect(once).toContain('- a')
    expect(once).toContain('- b')
    expect(once).toContain('[x] c')
    expect(once.startsWith('- [ ]')).toBe(false)
    expect(once.startsWith('* [ ]')).toBe(false)
  })
})
