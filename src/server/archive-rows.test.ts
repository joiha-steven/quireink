// What a path inside a backup may name in the blob store. The archive may have come from
// anywhere, so every way a name could leave the store is refused, on every system it is read on.
import { describe, expect, it } from 'bun:test'
import { uploadPath } from '@/server/archive-rows'

describe('uploadPath', () => {
  it('names a file inside the store', () => {
    expect(uploadPath('uploads/media/a.webp')).toBe('media/a.webp')
    expect(uploadPath('content.db')).toBeNull()
  })

  it('refuses every way out, a Windows one included', () => {
    for (const name of [
      'uploads/../x', 'uploads/media/../../x', 'uploads//x', 'uploads/./x', 'uploads/',
      'uploads/..\\..\\Users\\Public\\x.txt', 'uploads/media\\a.webp', 'uploads/C:/x', 'uploads/media/c:x',
    ]) expect(() => uploadPath(name)).toThrow('unsafe-path')
  })
})
