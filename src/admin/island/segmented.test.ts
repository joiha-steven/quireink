// A segmented strip keeps each key's own corners when the choice moves (2026-09-30). The islands
// copied one pressed key's class onto the others, so the last key picked wore the first key's
// rounding and stood square against the end of the track.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { choice } from '@/web/admin/fields-pick'
import { wireControls } from '@/admin/island/lib/settings-controls'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

describe('a choice strip', () => {
  it('gives the key that is picked its own corners, and takes the pressed face off the rest', () => {
    document.body.innerHTML = choice({
      k: 'figure.frame', label: 'Frame', value: 'none',
      options: [['none', 'None'], ['thin', 'Thin'], ['thick', 'Thick']],
    } as never)
    wireControls(document.body, () => {})
    const keys = [...document.querySelectorAll<HTMLElement>('[data-choice]')]
    keys[2]!.click()
    expect(keys.map((k) => k.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(keys[2]!.className).toBe(keys[2]!.dataset.on!)
    expect(keys[2]!.className).toContain('rounded-r-[5px]')
    expect(keys[0]!.className).toContain('rounded-l-[5px]')
    expect(keys[0]!.className).toBe(keys[0]!.dataset.off!)
  })
})
