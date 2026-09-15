// A SENTENCE THAT HAS TO SURVIVE A PAGE LOAD, and the undo inside it.
//
// The editor's Trash key asks nothing, and the whole argument for asking nothing is that the
// way back is in the toast. Under ADR 0054 leaving the editor is a real navigation, so the
// toast raised beside the delete is destroyed in the same frame as the delete — the argument
// and the safety net go together. This is the carry that puts it back, and the two facts worth
// pinning are that it ARRIVES and that it arrives ONCE.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { sayAcross, saySettled } from './lib/say-across'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type Said = { message?: string; action?: { label: string; run: () => void } }

/** Everything `quire:toast` carried while `run` was running. */
function heard(run: () => void): Said[] {
  const said: Said[] = []
  const ear = (e: Event): void => { said.push((e as CustomEvent<Said>).detail) }
  window.addEventListener('quire:toast', ear)
  try { run() } finally { window.removeEventListener('quire:toast', ear) }
  return said
}

beforeEach(() => { sessionStorage.clear() })

describe('a sentence carried across a navigation', () => {
  it('says nothing when nothing was left', () => {
    expect(heard(saySettled)).toEqual([])
  })

  it('says what was left, on the other side', () => {
    sayAcross({ message: 'Moved to the Trash' })
    const said = heard(saySettled)
    expect(said).toHaveLength(1)
    expect(said[0]?.message).toBe('Moved to the Trash')
  })

  it('says it ONCE, and not again on the next visit to the same screen', () => {
    // ⚠️ READ AND CLEARED IN THE SAME BREATH. A sentence left in the slot would be raised
    // again the next time this screen is opened, reporting a deletion that happened an hour
    // ago — and offering to undo it.
    sayAcross({ message: 'Moved to the Trash' })
    expect(heard(saySettled)).toHaveLength(1)
    expect(heard(saySettled)).toEqual([])
  })

  it('carries the undo as its INGREDIENTS, because a function cannot cross a page load', () => {
    sayAcross({
      message: 'Moved to the Trash',
      undo: { label: 'Undo', kind: 'posts', ids: ['a-reed-pen'] },
    })
    const said = heard(saySettled)
    expect(said[0]?.action?.label).toBe('Undo')
    expect(typeof said[0]?.action?.run).toBe('function')
  })

  it('asks the trash to put back exactly what was taken', async () => {
    let asked: { url: string; body: unknown } | null = null
    const was = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      asked = { url: String(url), body: JSON.parse(init?.body ?? 'null') as unknown }
      return { ok: true } as Response
    }) as typeof fetch
    try {
      sayAcross({
        message: 'Moved to the Trash',
        undo: { label: 'Undo', kind: 'notes', ids: ['a-reed-pen'] },
      })
      heard(saySettled)[0]?.action?.run()
      await Promise.resolve()
    } finally {
      globalThis.fetch = was
    }
    expect(asked).not.toBeNull()
    expect(asked!.url).toBe('/api/trash')
    expect(asked!.body).toEqual({ kind: 'notes', action: 'restore', ids: ['a-reed-pen'] })
  })

  it('survives storage being switched off, rather than taking the page down with it', () => {
    // A private window throws on read as readily as on write, and losing the screen because a
    // sentence could not be fetched would be the courtesy eating the thing it is attached to.
    const was = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('blocked') },
    })
    try {
      expect(() => sayAcross({ message: 'anything' })).not.toThrow()
      expect(() => saySettled()).not.toThrow()
    } finally {
      if (was) Object.defineProperty(globalThis, 'sessionStorage', was)
    }
  })
})
