// "Image upload failed" said nothing about why: the server knew the size and the limit and the
// client threw them away (2026-09-30).
import { describe, expect, it } from 'bun:test'
import { UploadRefused, refusalWords } from '@/admin/upload-client'

const w = {
  badType: 'bad type', failed: 'failed',
  tooLarge: 'file {size} MB over {limit} MB', noRoom: 'store {size} MB over {limit} MB',
}
const MB = 1048576

describe('what an upload refusal says', () => {
  it('names the size and the limit of a file that is too large', () => {
    expect(refusalWords(new UploadRefused('file_too_large', 1 * MB, 7.8 * MB), w)).toBe('file 7.8 MB over 1.0 MB')
    expect(refusalWords(new UploadRefused('quota_exceeded', 5120 * MB, 5121 * MB), w)).toBe('store 5121 MB over 5120 MB')
  })

  it('keeps the type refusal, and falls back when there is nothing to name', () => {
    expect(refusalWords(new UploadRefused('unsupported_type'), w)).toBe('bad type')
    expect(refusalWords(new UploadRefused('file_too_large'), w)).toBe('failed')
    expect(refusalWords(new Error('upload failed'), w)).toBe('failed')
  })
})
