// THE HAND-WRITTEN SCHEMA AGAINST THE ONE IT REPLACED, field by field.
//
// ⚠️ THE OTHER SIDE OF THIS COMPARISON IS A RECORDED FILE, AND IT MUST NEVER BE REGENERATED.
// `golden/editor/schema-before-step-7.json` is the schema `@tiptap/starter-kit` and seven other
// packages produced, captured from a worktree at `main` on 2026-09-15 — the last commit where
// those packages were installed. Regenerating it from the schema it guards would turn a guard
// into a copy of the thing it is guarding, which is a mistake this repository has already paid
// for (`golden/v1/corpus/` carries the same warning, for the same reason).
//
// While both existed, this file compared against a RUNNING Tiptap editor and 310 assertions
// passed. What it does now is hold the answer: a change to any node, any mark, any attribute
// default or any `toDOM` shows up here as a diff somebody has to accept on purpose.
//
// WHAT IT COMPARES AND WHAT IT DOES NOT. Names, content expressions, groups, the flags that
// decide how a key behaves, attribute names with their defaults, the `toDOM` of everything, the
// mark ORDER (which is the nesting order a save writes), and which marks each one excludes. Not
// `parseDOM`, which has no comparable shape between the two and is exercised by pasting.
//
// ⚠️ THREE DIFFERENCES ARE DELIBERATE and are asserted AS differences below, so that this file
// says what changed rather than hiding it in a tolerance.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readFileSync } from 'node:fs'

/** ⚠️ NEVER REGENERATED. See the warning at the top of this file. */
const FIXTURE = 'golden/editor/schema-before-step-7.json'

type Recorded = {
  markOrder: string[]
  nodes: Record<string, Record<string, unknown>>
  marks: Record<string, Record<string, unknown>>
}

let was: Recorded
let ours: import('prosemirror-model').Schema

beforeAll(async () => {
  GlobalRegistrator.register()
  was = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Recorded
  ours = (await import('./schema')).schema
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

describe('the schema this product writes and the schema it replaced', () => {
  it('holds the same nodes and the same marks, by name', () => {
    expect(Object.keys(ours.nodes).sort()).toEqual(Object.keys(was.nodes).sort())
    expect(Object.keys(ours.marks).sort()).toEqual(Object.keys(was.marks).sort())
  })

  it('ranks the marks in the same order, which is the nesting order a save writes', () => {
    // ⚠️ NOT A TIDINESS CHECK. `Mark.sort()` orders by rank, and rank is position in the
    // schema's map, so a different order makes the serializer write `**==bold==**` where it
    // wrote `==**bold**==`. Same document, different file, every save, for every reader.
    expect(Object.keys(ours.marks)).toEqual(was.markOrder)
  })

  it('agrees on every node: content, group, and the flags that decide how a key behaves', () => {
    const FIELDS = ['content', 'group', 'marks', 'inline', 'atom', 'selectable', 'draggable',
      'code', 'defining', 'isolating', 'tableRole'] as const
    for (const name of Object.keys(was.nodes)) {
      const mine = ours.nodes[name]!.spec as Record<string, unknown>
      for (const f of FIELDS) {
        expect(`${name}.${f}=${JSON.stringify(mine[f] ?? null)}`)
          .toBe(`${name}.${f}=${JSON.stringify(was.nodes[name]![f] ?? null)}`)
      }
    }
  })

  it('agrees on every node attribute and every default', () => {
    for (const name of Object.keys(was.nodes)) {
      const mine = defaults(ours.nodes[name]!.spec)
      // `loose` on the three lists is the third deliberate difference, asserted below.
      if (LISTS.includes(name)) delete mine.loose
      expect(`${name}: ${JSON.stringify(mine, sorted)}`)
        .toBe(`${name}: ${JSON.stringify(was.nodes[name]!.attrs, sorted)}`)
    }
  })

  it('agrees on every mark attribute and every default', () => {
    for (const name of Object.keys(was.marks)) {
      const mine = defaults(ours.marks[name]!.spec)
      expect(`${name}: ${JSON.stringify(mine, sorted)}`)
        .toBe(`${name}: ${JSON.stringify(was.marks[name]!.attrs, sorted)}`)
    }
  })

  it('draws every node the same way', () => {
    for (const name of Object.keys(was.nodes)) {
      const recorded = was.nodes[name]!.toDOM
      if (recorded === null) continue
      const filled = ours.nodes[name]!.createAndFill()
      if (!filled) continue
      // `table` is prosemirror-tables' own doing: the previous spec added a `<colgroup>` and a
      // `style="width: 0px"` that the column-resizing plugin maintains, and that plugin was not
      // mounted then and is not mounted now. The tag and the content hole are what matter.
      if (name === 'table') {
        expect(String(shape(ours.nodes[name]!.spec.toDOM?.(filled))).startsWith('table')).toBe(true)
        continue
      }
      expect(`${name}: ${JSON.stringify(shape(ours.nodes[name]!.spec.toDOM?.(filled)))}`)
        .toBe(`${name}: ${JSON.stringify(recorded)}`)
    }
  })

  it('draws every mark the same way', () => {
    for (const name of Object.keys(was.marks)) {
      const mine = shape(ours.marks[name]!.spec.toDOM?.(ours.marks[name]!.create(), true))
      expect(`${name}: ${JSON.stringify(mine)}`).toBe(`${name}: ${JSON.stringify(was.marks[name]!.toDOM)}`)
    }
  })

  it('agrees on which marks refuse to share a character, except where it does not', () => {
    for (const name of Object.keys(was.marks)) {
      if (name === 'code') continue // the one deliberate difference, asserted below
      const recorded = was.marks[name]!.excludesByName as Record<string, boolean>
      for (const other of Object.keys(recorded)) {
        expect(`${name} excludes ${other}: ${ours.marks[name]!.excludes(ours.marks[other]!)}`)
          .toBe(`${name} excludes ${other}: ${recorded[other]}`)
      }
    }
  })
})

describe('the three differences that are on purpose', () => {
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
    // ⚠️ NOT `'_ ink underline ring'`. `_` is ProseMirror's word for "every mark", so a list
    // that starts with it still excludes every mark — the first term already said all of them.
    expect(ours.marks.code!.spec.excludes).toBe('code bold italic strike link')
    // The recorded schema excluded all eight, itself included.
    const before = was.marks.code!.excludesByName as Record<string, boolean>
    expect(Object.values(before).every(Boolean)).toBe(true)

    // ⚠️ EVERY MARK IN THE SCHEMA, not a list copied from the one above it. A ninth mark added
    // later lands in one of these two groups by name, and if nobody thought about which, this
    // says so rather than letting it become legal inside a code span by default.
    const PENS = new Set(['ink', 'underline', 'ring'])
    for (const name of Object.keys(ours.marks)) {
      expect(`${name} excluded by code: ${ours.marks.code!.excludes(ours.marks[name]!)}`)
        .toBe(`${name} excluded by code: ${!PENS.has(name)}`)
    }
  })

  it('keeps the link mark inclusive, which is parity and is probably a fault', () => {
    // Measured on the outgoing build: typing a character immediately after `[word](…)` puts it
    // INSIDE the link. Kept, because step 7 moves which layer the editor stands on and keeps
    // what it does — and this one changes what happens to text a writer has already typed.
    expect(ours.marks.link!.spec.inclusive).toBe(true)
    expect(was.marks.link!.inclusive).toBe(true)
  })
})

describe('the third difference: a list remembers it was loose', () => {
  /**
   * ⚠️ THE RECORDED SCHEMA HAD NO WAY TO SAY IT, and a save paid for that. A list with blank
   * lines between one-paragraph items is loose — every item a paragraph, with a paragraph's space
   * — and `md/from-editor.ts` could only infer tightness from what the items held, which calls
   * that list tight. Measured 2026-09-23 over 142 published posts opened and saved: two lost the
   * space between their items. The attribute defaults to false and draws nothing when it is, so
   * every list the writer makes in the editor is the same node it always was.
   */
  it('adds `loose`, default false, to exactly the three list nodes', () => {
    for (const name of Object.keys(ours.nodes)) {
      const mine = defaults(ours.nodes[name]!.spec)
      expect(`${name}: ${'loose' in mine ? String(mine.loose) : '-'}`)
        .toBe(`${name}: ${LISTS.includes(name) ? 'false' : '-'}`)
      expect(`${name} recorded: ${'loose' in ((was.nodes[name]?.attrs ?? {}) as object)}`).toBe(`${name} recorded: false`)
    }
  })

  it('writes it to the DOM only when it is true, and reads it back from a paste', async () => {
    const { DOMParser: PMParser } = await import('prosemirror-model')
    for (const name of LISTS) {
      const node = ours.nodes[name]!.createAndFill({ loose: true })!
      const dom = shape(ours.nodes[name]!.spec.toDOM?.(node))
      expect(JSON.stringify(dom)).toContain('"data-loose":"true"')
    }
    const host = document.createElement('div')
    host.innerHTML = '<ul data-loose="true"><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>'
    const doc = PMParser.fromSchema(ours).parse(host)
    expect([doc.child(0).attrs.loose, doc.child(1).attrs.loose]).toEqual([true, false])
  })
})

const LISTS = ['bulletList', 'orderedList', 'taskList']

/** Keys in a stable order, so two objects that hold the same thing compare equal. */
function sorted(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as object).sort(([a], [b]) => a.localeCompare(b)))
  }
  return value
}
