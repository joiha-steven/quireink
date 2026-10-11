// resolveSafe is the one gate every Bun blob read and write passes through.
import { describe, expect, it } from 'bun:test'
import { resolveSafe } from '@/runtime/bun/blob'

describe('resolveSafe', () => {
  it('refuses a colon, which on Windows reaches a directory through an NTFS stream name', () => {
    expect(() => resolveSafe('themes::$INDEX_ALLOCATION/abc/x.css')).toThrow('Invalid blob path')
    expect(() => resolveSafe('media/a:b.webp')).toThrow('Invalid blob path')
  })

  it('refuses a path that climbs out of the store and keeps an ordinary one', () => {
    expect(() => resolveSafe('../outside.txt')).toThrow('Invalid blob path')
    expect(resolveSafe('media/photo.webp').split(/[\\/]/).slice(-2)).toEqual(['media', 'photo.webp'])
  })
})
