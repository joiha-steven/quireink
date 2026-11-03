// The reader's marks follow a renamed page in their own browser: kept under the path, which the
// rename moved, they are taken from the old path the page names the first time the new one loads.
import { beforeEach, describe, expect, it } from 'bun:test'
import { adopt, load, save, type Ann } from './pen-store'

const store = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  },
})

const mark = (exact: string): Ann => ({ exact, prefix: '', suffix: '', id: exact, kind: 'hl', ink: '', note: '', t: 1 })

beforeEach(() => store.clear())

describe('adopt', () => {
  it('takes the marks kept under an old path and keeps them under the new one', () => {
    save('/old', [mark('a sentence')])
    expect(adopt('/new', ['/old']).map((a) => a.exact)).toEqual(['a sentence'])
    expect(load('/new').map((a) => a.exact)).toEqual(['a sentence'])
    expect(store.has('quire:pen:/old')).toBe(false)
  })

  it('never overwrites marks the new path already has', () => {
    save('/old', [mark('old one')])
    save('/new', [mark('new one')])
    expect(adopt('/new', ['/old']).map((a) => a.exact)).toEqual(['new one'])
    expect(store.has('quire:pen:/old')).toBe(true)
  })

  it('finds nothing to take when no old path is named', () => {
    expect(adopt('/new', [])).toEqual([])
  })
})
