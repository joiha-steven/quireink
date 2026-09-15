// THE HAND-WRITTEN SCHEMA AGAINST THE ONE IT REPLACES, field by field.
//
// ⚠️ THIS FILE HAS A DEADLINE, AND IT IS THE ONLY REASON IT EXISTS. It compares
// `editor/schema.ts` with the schema `@tiptap/starter-kit` and seven other packages produce, so
// the swap in ADR 0054's step 7 is a MEASURED equivalence rather than a careful reading. It goes
// out with the packages: once `@tiptap/*` is gone there is nothing on the other side of the
// comparison, and `editor-corpus.test.ts` is the permanent guard — 45 fixtures, opened and saved
// and rendered, under two laws.
//
// WHAT IT COMPARES AND WHAT IT DOES NOT. Names, content expressions, groups, attribute names and
// their defaults, and the `toDOM` of every node and mark: those are what `md/to-editor.ts` and
// `md/from-editor.ts` speak to, and what the browser draws. Not `parseDOM`, which differs in
// shape between the two and is exercised by pasting rather than by reading.
//
// ⚠️ TWO DIFFERENCES ARE DELIBERATE and are asserted AS differences below, so that this file
// says what changed rather than hiding it in a tolerance.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filled in beforeAll
let theirs: import('prosemirror-model').Schema
let ours: import('prosemirror-model').Schema

beforeAll(async () => {
  GlobalRegistrator.register()
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const editor = new Editor({ extensions: editorExtensions('Write…'), content: '' })
  theirs = editor.schema
  ours = (await import('./schema')).schema
  editor.destroy()
})

afterAll(async () => { await GlobalRegistrator.unregister() })

/** A spec's attribute names with their defaults, which is the half a serializer reads. */
const defaults = (spec: { attrs?: Record<string, { default?: unknown }> }): Record<string, unknown> =>
  Object.fromEntries(Object.entries(spec.attrs ?? {}).map(([k, v]) => [k, v.default]))

/**
 * `toDOM` output reduced to what the browser actually gets, so two DOM builders can be compared.
 *
 * ⚠️ THREE THINGS ARE NOT DIFFERENCES, and normalising them is what makes the rest of this file
 * mean something. `DOMSerializer` SKIPS an attribute whose value is null; an absent attrs object
 * is the same element as an empty one; and an attribute value goes through `setAttribute`, which
 * stringifies, so `colspan: 1` and `colspan: "1"` are one attribute. Tiptap emits the loose form
 * of all three. Comparing the literal arrays would report seventeen differences no reader could
 * ever see, and the real ones would be lost among them. Elements are reduced to their tag
 * because a node view can put a real DOM node in the output.
 */
const shape = (out: unknown): unknown => {
  const plain = JSON.parse(JSON.stringify(out, (_k, v) =>
    (v && typeof v === 'object' && 'nodeName' in (v as object))
      ? `<${String((v as { nodeName: string }).nodeName).toLowerCase()}>`
      : v))
  const strip = (v: unknown): unknown => {
    if (!Array.isArray(v)) return v
    return v
      .map((part, i) => {
        if (i === 0 || part === 0 || Array.isArray(part)) return strip(part)
        if (part && typeof part === 'object') {
          // Sorted, because the ORDER attributes are written in is not a difference either:
          // `setAttribute` is called once per key and an element has no opinion about which
          // came first.
          const kept = Object.fromEntries(Object.entries(part)
            .filter(([, x]) => x != null)
            .map(([k, x]) => [k, String(x)])
            .sort(([a], [b]) => a.localeCompare(b)))
          return Object.keys(kept).length === 0 ? undefined : kept
        }
        return part
      })
      .filter((part) => part !== undefined)
  }
  return strip(plain)
}

describe('the schema this product writes and the schema it replaces', () => {
  it('hold the same nodes and the same marks, by name', () => {
    expect(Object.keys(ours.nodes).sort()).toEqual(Object.keys(theirs.nodes).sort())
    expect(Object.keys(ours.marks).sort()).toEqual(Object.keys(theirs.marks).sort())
  })

  it('rank the marks in the same order, which is the nesting order a save writes', () => {
    // ⚠️ NOT A TIDINESS CHECK. `Mark.sort()` orders by rank, and rank is position in this map,
    // so a different order here makes the serializer write `**==bold==**` where it wrote
    // `==**bold**==`. Same document, different file, every save, for every reader.
    expect(Object.keys(ours.marks)).toEqual(Object.keys(theirs.marks))
  })

  it('agree on every node: content, group, and the flags that decide how a key behaves', () => {
    for (const name of Object.keys(theirs.nodes)) {
      const a = theirs.nodes[name]!.spec
      const b = ours.nodes[name]!.spec
      const fields = ['content', 'group', 'marks', 'inline', 'atom', 'selectable', 'draggable',
        'code', 'defining', 'isolating', 'tableRole'] as const
      for (const f of fields) {
        expect(`${name}.${f}=${JSON.stringify(b[f as never])}`)
          .toBe(`${name}.${f}=${JSON.stringify(a[f as never])}`)
      }
    }
  })

  it('agree on every node attribute and every default', () => {
    for (const name of Object.keys(theirs.nodes)) {
      expect(`${name}: ${JSON.stringify(defaults(ours.nodes[name]!.spec))}`)
        .toBe(`${name}: ${JSON.stringify(defaults(theirs.nodes[name]!.spec))}`)
    }
  })

  it('agree on every mark attribute and every default', () => {
    for (const name of Object.keys(theirs.marks)) {
      expect(`${name}: ${JSON.stringify(defaults(ours.marks[name]!.spec))}`)
        .toBe(`${name}: ${JSON.stringify(defaults(theirs.marks[name]!.spec))}`)
    }
  })

  it('draw every node the same way', () => {
    for (const name of Object.keys(theirs.nodes)) {
      if (name === 'text' || name === 'doc') continue
      const mine = ours.nodes[name]!.createAndFill()
      const yours = theirs.nodes[name]!.createAndFill()
      if (!mine || !yours) continue
      // `table` is the one exception and it is prosemirror-tables' own doing: its spec adds a
      // `<colgroup>` and a `style="width: 0px"` that the column-resizing plugin maintains, and
      // that plugin is not mounted here. The tag and the content hole are what matter.
      if (name === 'table') {
        expect(String(shape(ours.nodes[name]!.spec.toDOM?.(mine))).startsWith('table')).toBe(true)
        continue
      }
      expect(`${name}: ${JSON.stringify(shape(ours.nodes[name]!.spec.toDOM?.(mine)))}`)
        .toBe(`${name}: ${JSON.stringify(shape(theirs.nodes[name]!.spec.toDOM?.(yours)))}`)
    }
  })

  it('draw every mark the same way', () => {
    for (const name of Object.keys(theirs.marks)) {
      const mine = ours.marks[name]!.create()
      const yours = theirs.marks[name]!.create()
      expect(`${name}: ${JSON.stringify(shape(ours.marks[name]!.spec.toDOM?.(mine, true)))}`)
        .toBe(`${name}: ${JSON.stringify(shape(theirs.marks[name]!.spec.toDOM?.(yours, true)))}`)
    }
  })
})

describe('the two differences that are on purpose', () => {
  /**
   * ⚠️ A HIGHLIGHT MAY NOW RUN ACROSS AN INLINE CODE SPAN, and it could not before.
   *
   * `InkMark.ts` carried a paragraph about this: StarterKit's `code` is `excludes: '_'`, it
   * refuses to share a character with any other mark, and it could not be changed from outside
   * — "the fix is a direct dependency on `@tiptap/extension-code` plus a forked mark". The mark
   * is this repository's own now, so the fix is a named list in place of an underscore.
   *
   * It matters because the server has always rendered ``==a `b` c==`` as ONE stroke. Opening
   * and saving used to end the stroke before the code, which is a save that changes the
   * reader's page — the thing `editor-corpus.test.ts`'s second law exists to forbid.
   */
  it('lets the three pen marks through a code span, where the old one excluded everything', () => {
    expect(theirs.marks.code!.spec.excludes).toBe('_')
    // ⚠️ NOT `'_ ink underline ring'`. `_` is ProseMirror's word for "every mark", so a list
    // that starts with it still excludes every mark — the first term already said all of them.
    // The marks this one excludes are NAMED, and the three pen gestures are the omission.
    expect(ours.marks.code!.spec.excludes).toBe('code bold italic strike link')
    // ⚠️ EVERY MARK IN THE SCHEMA, not a list copied from the one above it. A ninth mark added
    // later lands in one of these two groups by name, and if nobody thought about which, this
    // says so rather than letting it become legal inside a code span by default.
    const PENS = new Set(['ink', 'underline', 'ring'])
    for (const name of Object.keys(ours.marks)) {
      const excluded = ours.marks.code!.excludes(ours.marks[name]!)
      expect(`${name} excluded by code: ${excluded}`)
        .toBe(`${name} excluded by code: ${!PENS.has(name)}`)
    }
    // And the old one excluded all eight, including itself.
    for (const name of Object.keys(theirs.marks)) {
      expect(`old: ${name} excluded by code: ${theirs.marks.code!.excludes(theirs.marks[name]!)}`)
        .toBe(`old: ${name} excluded by code: true`)
    }
  })

  it('keeps the link mark inclusive, which is parity and is probably a fault', () => {
    // Measured on the outgoing build: typing a character immediately after `[word](…)` puts it
    // INSIDE the link. Kept, because step 7 moves which layer the editor stands on and keeps
    // what it does — and this one changes what happens to text a writer has already typed.
    expect(ours.marks.link!.spec.inclusive).toBe(true)
    expect(theirs.marks.link!.spec.inclusive).toBe(true)
  })
})
