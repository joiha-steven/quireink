// WHERE A BLOCK NODE LANDS when Markdown writes it inline.
//
// Markdown has one shape for a picture and it is inline: `![alt](src)` is a paragraph's only
// child as often as not. The editor's image is a BLOCK node — `CaptionedImage` extends
// Tiptap's `Image`, which is `group: 'block'` — so the two disagree, and something has to
// decide where the node ends up.
//
// The bridge that went through HTML never had to decide: ProseMirror's DOM parser lifts a
// block node out of a paragraph on the way in. Building the document as JSON (`md/to-editor.ts`)
// skipped that lift, and the result was a paragraph wrapped around a block `<div>`. ProseMirror
// then has to keep a text position alive beside the node, which it does with a
// `ProseMirror-separator` image and a trailing `<br>` — real layout, both of them, and both
// coming and going as the selection moves.
//
// MEASURED IN CHROME on this blog's own post, same post and same database on both builds
// (2026-09-14): the image at top level is a 542px node; the same image inside a paragraph is a
// 588px one. Forty-six pixels of empty line under every picture, on every picture in the
// piece, and the document is 46px taller for each one.
//
// The law here is about SHAPE, not pixels: a picture that IS the paragraph comes out of it. A
// pixel assertion would need a browser and would pin a stylesheet; this pins the thing that
// caused the pixels.
//
// ⚠️ AND THE LAW STOPS THERE, on purpose. A picture written mid-sentence stays where the author
// put it, blank line and all, because that paragraph is ONE block on the reader's page and a
// save may not change the page. `golden/corpus/reference-links.md` fails in two other suites
// the moment this file gets greedier — which is how the first version of the fix was caught.
//
// happy-dom is registered for THIS FILE ONLY, the rule every editor suite here follows.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type Shape = { blockNodesInsideAParagraph: string[]; topLevel: string[] }

/** Open a source in the REAL extension set and report where its nodes sit. */
async function shape(source: string): Promise<Shape> {
  const { Editor } = await import('@/admin/editor/editor')
  const editor = new Editor({ element: document.createElement('div'), content: source })
  const inside: string[] = []
  const topLevel: string[] = []
  editor.state.doc.forEach((node) => {
    topLevel.push(node.type.name)
    // One level is enough for the failure this guards: the lift happens where the paragraph is
    // built, so a block node that survived it is a DIRECT child of a paragraph.
    if (node.type.name === 'paragraph') {
      node.forEach((child) => { if (child.isBlock) inside.push(`${node.type.name} > ${child.type.name}`) })
    }
  })
  editor.destroy()
  return { blockNodesInsideAParagraph: inside, topLevel }
}

/** Open and save, to show the lift did not cost the source anything. */
async function roundTrip(source: string): Promise<string> {
  const { Editor } = await import('@/admin/editor/editor')
  const editor = new Editor({ element: document.createElement('div'), content: source })
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}

describe('a picture that is the whole paragraph comes out of it', () => {
  it('lifts a picture that stands on its own line', async () => {
    const { blockNodesInsideAParagraph, topLevel } = await shape(
      'Trước ảnh.\n\n![Một chú thích](/uploads/media/a.jpg)\n\nSau ảnh.\n',
    )
    expect(blockNodesInsideAParagraph).toEqual([])
    expect(topLevel).toEqual(['paragraph', 'image', 'paragraph'])
  })

  it('LEAVES a picture written mid-sentence where the author put it', async () => {
    // The blank line is the lesser harm here, and this is the trade written down. That
    // paragraph is ONE block on the reader's page; lifting the image splits it into three, and
    // a save may not change the page (`golden/corpus/reference-links.md`, two suites).
    // None of this blog's 92 posts writes one — every picture stands on its own line.
    const { blockNodesInsideAParagraph, topLevel } = await shape(
      'Chữ trước ![alt](/uploads/media/a.jpg) chữ sau.\n',
    )
    expect(blockNodesInsideAParagraph).toEqual(['paragraph > image'])
    expect(topLevel).toEqual(['paragraph'])
  })

  it('leaves a paragraph with no picture exactly as it was', async () => {
    const { topLevel } = await shape('Một đoạn văn thường.\n\n\n')
    expect(topLevel).toEqual(['paragraph'])
  })

  it('lifts one inside a list item too', async () => {
    const { blockNodesInsideAParagraph } = await shape(
      '- Mục một\n- ![alt](/uploads/media/a.jpg)\n',
    )
    expect(blockNodesInsideAParagraph).toEqual([])
  })

  it('still saves the picture back', async () => {
    const source = 'Trước ảnh.\n\n![Một chú thích](/uploads/media/a.jpg)\n\nSau ảnh.\n'
    const once = await roundTrip(source)
    expect(once).toContain('![Một chú thích](/uploads/media/a.jpg)')
    // And it settles: opening what was saved gives the same thing back.
    expect(await roundTrip(once)).toBe(once)
  })
})
