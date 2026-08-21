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
    expect(await roundTrip('- [x] một\n- [ ] hai\n')).toBe('- [x] một\n\n- [ ] hai')
  })

  it('keeps a numbered list numbered when a checkbox joins it', async () => {
    const out = await roundTrip('1. một\n2. hai\n\n- [x] ba\n')
    expect(out).toContain('1. một')
    expect(out).toContain('- [x] ba')
    expect(await roundTrip(out)).toBe(out)
  })

  it('settles the TIGHT mixed list on the next save, and then holds', async () => {
    // The one case that is not a fixed point on the first pass, pinned rather than hidden.
    // `- a\n- b\n- [x] c` has no blank lines, so its bullets are tight; splitting it puts a
    // blank line between the two lists, and CommonMark says a list with a blank line in it is
    // LOOSE. So the second save reads its own output honestly and spaces the bullets out.
    //
    // It costs one blank line per item, once, and nothing else: no text is added, removed or
    // reordered, and the third save changes nothing. There is no version of this that both
    // splits the list and keeps the source tight — two adjacent lists in Markdown need a blank
    // line between them, and that blank line is what makes the list loose.
    const once = await roundTrip('- a\n- b\n- [x] c\n')
    const twice = await roundTrip(once)
    expect(twice).not.toBe(once)
    expect(await roundTrip(twice)).toBe(twice)
    // What matters: every item is still there, and there is no invented one.
    expect(twice).toContain('- a')
    expect(twice).toContain('- b')
    expect(twice).toContain('- [x] c')
    expect(twice.startsWith('- [ ]')).toBe(false)
  })
})
