// Maths in the WRITING surface: open a post, and save it again unchanged.
//
// This is the test the feature actually needed. The server renderer was correct before a line
// of `MathNode.tsx` existed; what was not correct was the editor, and it failed SILENTLY —
// nothing threw, the post looked fine on screen, and the saved Markdown was a different
// document. Both regressions below were measured on the real extension set:
//
//     $$M \times V$$   ->   $$M \\times V$$      every backslash doubled
//     \(a_1 + b_2\)    ->   (a_1 + b_2)          delimiters eaten by markdown-it's escape rule
//
// happy-dom is registered for THIS FILE ONLY, the same rule `ink-mark.test.ts` follows:
// registering globally hands every other suite happy-dom's `fetch`.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

/** A fresh editor with the extension set `Editor.tsx` actually mounts — the REAL list, not
 *  a copy of it. This file used to rebuild the array by hand under a comment making exactly
 *  that claim, which meant a node added to the editor was silently absent from its own
 *  round-trip test. `editorExtensions.ts` is now the one list. */
async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

async function roundTrip(md: string): Promise<string> {
  const editor = await open(md)
  const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
  editor.destroy()
  return out.trim()
}

describe('a save does not rewrite the author\'s formula', () => {
  for (const md of [
    '$$M \\times V = P \\times Q$$',
    '\\[\\int_0^\\infty e^{-x}\\,dx = 1\\]',
    'inline $M$ here',
    '\\(a_1 + b_2\\)',
    'trước $x^2$ giữa \\(y_3\\) sau',
  ]) {
    it(JSON.stringify(md), async () => {
      expect(await roundTrip(md)).toBe(md)
    })
  }

  /**
   * A fixed point, not merely "unchanged once". A serializer can be wrong in a way that only
   * shows on the second pass, and a post is opened and saved many times.
   */
  it('is stable across two saves', async () => {
    const once = await roundTrip('$$a \\times b$$')
    expect(await roundTrip(once)).toBe(once)
  })
})

describe('the delimiter the author chose is the one that comes back', () => {
  it('keeps \\[…\\] rather than normalising it to $$…$$', async () => {
    expect(await roundTrip('\\[x^2\\]')).toBe('\\[x^2\\]')
  })

  it('keeps \\(…\\) rather than normalising it to $…$', async () => {
    expect(await roundTrip('\\(x^2\\)')).toBe('\\(x^2\\)')
  })
})

describe('the two measured regressions', () => {
  it('does not double the backslashes in a control word', async () => {
    expect(await roundTrip('$$M \\times V$$')).not.toContain('\\\\times')
  })

  it('does not eat the \\(…\\) delimiters', async () => {
    const out = await roundTrip('\\(a_1 + b_2\\)')
    expect(out).toContain('\\(')
    expect(out).toContain('\\)')
  })

  /**
   * The unclosed-span bug. A `nesting: 0` markdown-it token renders as a bare `<span …>`,
   * and everything after it in the paragraph became a child of an atom node — which discards
   * its children. `inline $M$ here` saved back as `inline $M$` and the word was gone.
   */
  it('does not swallow the text after an inline formula', async () => {
    expect(await roundTrip('inline $M$ here')).toContain('here')
  })
})

describe('prose the editor must leave alone', () => {
  for (const md of ['giá $5 và $10', 'giá $5-$8 hôm nay', 'gói $9.99 và $19.99']) {
    it(JSON.stringify(md), async () => {
      expect(await roundTrip(md)).toBe(md)
    })
  }
})
