// What a Vietnamese sentence SOUNDS like, typed through each kind of input method.
//
// "Tiếng Việt có dấu, gõ nhanh không lỗi." is 49 keys in Telex. Before 2026-10-04 the editor
// struck 65 times for it through EVKey or OpenKey (each synthetic Backspace heard as a delete)
// and 57 times through the Mac's own Telex (each word's commit echo heard as a key). These
// cases feed `keyFeedback` the events a browser delivers for each, with the times keys were
// made, and count what it plays. The same sentence is driven through real Chrome by
// `scripts/typing-check.ts`, which also reads back the text that landed.
//
// happy-dom is registered for this file only, the rule every DOM suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Strike } from './key-voices'
import type { KeySound } from './key-sound'
import { BURST_MS } from './key-burst'
import { TELEX_STEPS } from './key-feedback.fixture'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => { await GlobalRegistrator.unregister() })

const SOUND: KeySound = { mode: 'crisp', volume: 50 }
const KEYS = TELEX_STEPS.reduce((n, w) => n + w.length, 0) + TELEX_STEPS.length - 1

type Ev = { key?: { at: number; repeat?: boolean }; input?: { type: string; data: string | null; composing?: boolean; at: number }; compose?: true }

async function hear(events: Ev[]): Promise<Strike[]> {
  const { keyFeedback } = await import('./key-feedback')
  const struck: Strike[] = []
  const fb = keyFeedback(() => null, SOUND, (_s, kind) => struck.push(kind))
  const view = {} as never
  for (const e of events) {
    if (e.compose) fb.composition()
    if (e.key) fb.key({ timeStamp: e.key.at, repeat: e.key.repeat ?? false } as KeyboardEvent)
    if (e.input) {
      fb.input(view, {
        inputType: e.input.type, data: e.input.data, isComposing: e.input.composing ?? false, timeStamp: e.input.at,
      } as InputEvent)
    }
  }
  await Bun.sleep(BURST_MS * 3)
  return struck
}

/** What a writer's own key looks like: a keydown, then the edit. */
const typed = (at: number, data: string): Ev[] => [{ key: { at } }, { input: { type: 'insertText', data, at } }]

/** The sentence as a backspace-based input method sends it; `keyed` inserts carry a keydown. */
function rewrites(keyed: boolean, gap = 90): Ev[] {
  const out: Ev[] = []
  let t = 1000
  TELEX_STEPS.forEach((steps, w) => {
    if (w > 0) { out.push(...typed(t, ' ')); t += gap }
    let shown = ''
    for (const next of steps) {
      let same = 0
      while (same < shown.length && shown[same] === next[same]) same++
      const drop = shown.length - same
      const add = next.slice(same)
      if (drop === 0 && add.length === 1) out.push(...typed(t, add))
      else {
        let at = t
        for (let i = 0; i < drop; i++, at++) {
          out.push({ key: { at } }, { input: { type: 'deleteContentBackward', data: null, at } })
        }
        for (const ch of add) {
          if (keyed) out.push(...typed(at, ch))
          // Text posted with no key in front of it: only the page's own (late) clock.
          else out.push({ input: { type: 'insertText', data: ch, at: at + 20 } })
          at++
        }
      }
      shown = next
      t += gap
    }
  })
  return out
}

/** The sentence as the Mac's built-in Telex sends it: a composition per word, committed by the space. */
function composed(): Ev[] {
  const out: Ev[] = []
  let t = 1000
  TELEX_STEPS.forEach((steps, w) => {
    if (w > 0) { out.push(...typed(t, ' ')); t += 90 }
    out.push({ compose: true })
    for (const next of steps) {
      out.push({ key: { at: t } }, { input: { type: 'insertCompositionText', data: next, composing: true, at: t } })
      t += 90
    }
    // The commit: the same word inserted once more, still composing, then compositionend.
    out.push({ input: { type: 'insertCompositionText', data: steps.at(-1)!, composing: true, at: t } }, { compose: true })
  })
  return out
}

describe('Vietnamese through a backspace-based input method (EVKey, OpenKey, Unikey)', () => {
  it('strikes once per key pressed, never a delete, when every event has its keydown', async () => {
    const struck = await hear(rewrites(true))
    expect(struck.length).toBe(KEYS)
    expect(struck.filter((k) => k === 'back')).toEqual([])
    expect(struck.filter((k) => k === 'space').length).toBe(TELEX_STEPS.length - 1)
  })

  it('strikes once per key when the rewritten text arrives with no keydown and late', async () => {
    const struck = await hear(rewrites(false))
    expect(struck.length).toBe(KEYS)
    expect(struck.filter((k) => k === 'back')).toEqual([])
  })

  it('still does at a very fast 40 ms a key', async () => {
    expect((await hear(rewrites(true, 40))).length).toBe(KEYS)
  })
})

describe('Vietnamese through a composing input method (macOS and Windows Telex)', () => {
  it('strikes once per key, and not again for the commit that repeats the word', async () => {
    const struck = await hear(composed())
    expect(struck.length).toBe(KEYS)
    expect(struck.filter((k) => k === 'space').length).toBe(TELEX_STEPS.length - 1)
  })

  it('hears a Backspace inside the composition as a delete', async () => {
    const struck = await hear([
      { compose: true },
      { key: { at: 0 } }, { input: { type: 'insertCompositionText', data: 'ti', composing: true, at: 0 } },
      { key: { at: 90 } }, { input: { type: 'insertCompositionText', data: 't', composing: true, at: 90 } },
    ])
    expect(struck).toEqual(['tap', 'back'])
  })

  it('stays silent for the bookkeeping: a composition cleared and anything else mid-word', async () => {
    const struck = await hear([
      { compose: true },
      { input: { type: 'deleteCompositionText', data: null, composing: true, at: 0 } },
      { input: { type: 'insertFromComposition', data: 'x', composing: true, at: 1 } },
      { input: { type: 'insertText', data: 'x', composing: true, at: 2 } },
    ])
    expect(struck).toEqual([])
  })
})

describe('what is a key and what is not', () => {
  it('a real Backspace is a delete', async () => {
    expect(await hear([{ key: { at: 0 } }, { input: { type: 'deleteContentBackward', data: null, at: 0 } }])).toEqual(['back'])
  })

  it('a held key strikes once, however long it repeats', async () => {
    const held: Ev[] = [...typed(0, 'a')]
    for (let i = 1; i <= 20; i++) held.push({ key: { at: 500 + i * 33, repeat: true } }, { input: { type: 'insertText', data: 'a', at: 500 + i * 33 } })
    expect(await hear(held)).toEqual(['tap'])
  })

  it('a paste, a drop, a cut, the spelling checker and undo make no sound', async () => {
    const at = 0
    const struck = await hear(['insertFromPaste', 'insertFromDrop', 'deleteByCut', 'insertReplacementText', 'historyUndo']
      .map((type, i) => ({ input: { type, data: 'x', at: at + i * 100 } })))
    expect(struck).toEqual([])
  })

  it('a return is a return, and a space a space', async () => {
    expect(await hear([...typed(0, ' '), { key: { at: 100 } }, { input: { type: 'insertParagraph', data: null, at: 100 } }]))
      .toEqual(['space', 'return'])
  })

  it('makes nothing at all with the instrument off', async () => {
    const { keyFeedback } = await import('./key-feedback')
    const struck: Strike[] = []
    const fb = keyFeedback(() => null, { mode: 'off', volume: 50 }, (_s, k) => struck.push(k))
    fb.key({ timeStamp: 0, repeat: false } as KeyboardEvent)
    fb.input({} as never, { inputType: 'insertText', data: 'a', isComposing: false, timeStamp: 0 } as InputEvent)
    await Bun.sleep(BURST_MS * 2)
    expect(struck).toEqual([])
  })
})
