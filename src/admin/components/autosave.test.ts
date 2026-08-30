// The editor's save-bar line, and the two things it used to get wrong.
//
// The owner asked for an autosave on 2026-07-30 that had existed since M2. It read as absent
// because the bar only ever spoke about the SERVER: `saving` → `saved at HH:MM` → `unsaved`.
// Thirty seconds into typing, "unsaved" was not even true — a local snapshot was already on
// disk, the sentence just never said so.
import { describe, expect, it } from 'bun:test'
import { saveStatusLine } from './useLocalDraft'

const T = {
  saving: 'Saving…',
  savedAtPrefix: 'saved at',
  keptLocallyPrefix: 'kept on this device at',
  keptOnServerPrefix: 'kept on the server at',
  unsaved: 'unsaved',
}

/** The real one, from `@/utils`, so the format is the format. */
const at = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

describe('saveStatusLine', () => {
  it('says nothing on an untouched, never-saved editor', () => {
    expect(saveStatusLine(T, false, null, false, null, at)).toBe('')
  })

  it('lets the server win the line whenever it has something to say', () => {
    expect(saveStatusLine(T, true, null, true, Date.now(), at)).toBe('Saving…')
  })

  it('reports the server save once the work is clean', () => {
    const saved = '2026-08-11T09:05:00Z'
    expect(saveStatusLine(T, false, saved, false, null, at)).toBe(`saved at ${at(saved)}`)
  })

  /** The line this whole item existed for. */
  it('says the work is held on this device once a snapshot exists', () => {
    const kept = new Date('2026-08-11T09:07:00Z').getTime()
    expect(saveStatusLine(T, false, null, true, kept, at))
      .toBe(`kept on this device at ${at(new Date(kept).toISOString())}`)
  })

  /**
   * Still honest before the first tick: there IS nothing kept yet, so claiming otherwise would
   * be the opposite failure — a bar that says work is safe when it is not.
   */
  it('says unsaved while dirty and no snapshot has been written yet', () => {
    expect(saveStatusLine(T, false, null, true, null, at)).toBe('unsaved')
  })

  /**
   * Editing again after a server save: the local snapshot is the current truth, not the older
   * server one. Showing "saved at 09:05" while the author types past it is how a bar teaches
   * somebody to trust it wrongly.
   */
  it('prefers the local snapshot over a STALE server save', () => {
    const kept = new Date('2026-08-11T09:09:00Z').getTime()
    expect(saveStatusLine(T, false, '2026-08-11T09:05:00Z', true, kept, at))
      .toBe(`kept on this device at ${at(new Date(kept).toISOString())}`)
  })
})

// The server half, added 2026-08-30 with `serverDraft.ts`. The line has to be able to say
// which machine the work is on, because that is the difference between a dead laptop costing
// nothing and costing the morning.
describe('saveStatusLine, once the server holds a snapshot too', () => {
  const t0 = Date.parse('2026-08-30T09:15:00Z')

  it('names the SERVER when it holds the newer of the two', () => {
    expect(saveStatusLine(T, false, null, true, t0 - 60_000, at, t0)).toBe(`kept on the server at ${at(new Date(t0).toISOString())}`)
  })

  it('names the DEVICE when the local snapshot is the newer one', () => {
    expect(saveStatusLine(T, false, null, true, t0, at, t0 - 60_000)).toBe(`kept on this device at ${at(new Date(t0).toISOString())}`)
  })

  it('names the server on a tie — the same keystrokes, and the stronger claim', () => {
    expect(saveStatusLine(T, false, null, true, t0, at, t0)).toBe(`kept on the server at ${at(new Date(t0).toISOString())}`)
  })

  it('still says unsaved when neither copy has been written yet', () => {
    expect(saveStatusLine(T, false, null, true, null, at, null)).toBe('unsaved')
  })

  it('lets a real save outrank both', () => {
    expect(saveStatusLine(T, false, '2026-08-30T09:20:00Z', false, t0, at, t0)).toBe(`saved at ${at('2026-08-30T09:20:00Z')}`)
  })
})
