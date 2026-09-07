// One dictionary at a time, and English until the one asked for arrives.
//
// The admin used to import all eleven, which put 780 KB of dictionaries in the chunk the
// entry waits for so that about 71 KB of them could be read. The eager payload measured
// 1063 KB before this and 374 KB after.
import { describe, expect, it } from 'bun:test'
import { adminStrings, adminStringsReady, loadAdminStrings } from '@/admin/admin-strings'
import en from '@/locales/admin/en'
import vi from '@/locales/admin/vi'

describe('the admin dictionaries', () => {
  it('holds English from the start, because a render cannot wait for a chunk', () => {
    expect(adminStringsReady('en')).toBe(true)
    expect(adminStrings('en').navHome).toBe(en.navHome)
  })

  it('answers in English for a language it has not fetched, then in the language itself', async () => {
    expect(adminStringsReady('vi')).toBe(false)
    expect(adminStrings('vi').navHome).toBe(en.navHome)

    await loadAdminStrings('vi')
    expect(adminStringsReady('vi')).toBe(true)
    expect(adminStrings('vi').navHome).toBe(vi.navHome)
    // The two really are different words, or this test would pass without the load.
    expect(vi.navHome).not.toBe(en.navHome)
  })

  it('fetches a dictionary once', async () => {
    await loadAdminStrings('de')
    const first = adminStrings('de')
    await loadAdminStrings('de')
    expect(adminStrings('de')).toBe(first)
  })
})
