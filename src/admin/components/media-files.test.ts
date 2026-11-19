import { describe, expect, test } from 'bun:test'
import { isQuickTime, mediaFiles, mediaKind } from './media-files'

const f = (name: string, type: string) => ({ name, type })

describe('mediaKind', () => {
  test('images go to the image route', () => {
    expect(mediaKind(f('a.png', 'image/png'))).toBe('image')
    expect(mediaKind(f('a.heic', 'image/heic'))).toBe('image')
  })
  test('video by type or by extension', () => {
    expect(mediaKind(f('a.mp4', 'video/mp4'))).toBe('video')
    expect(mediaKind(f('a.webm', 'video/webm'))).toBe('video')
    expect(mediaKind(f('a.MOV', ''))).toBe('video')
    expect(mediaKind(f('a.m4v', 'application/octet-stream'))).toBe('video')
  })
  test('anything else is ignored', () => {
    expect(mediaKind(f('a.pdf', 'application/pdf'))).toBeNull()
    expect(mediaKind(f('notes.txt', 'text/plain'))).toBeNull()
  })
})

describe('mediaFiles', () => {
  test('keeps images and videos in order, drops the rest', () => {
    const a = new File(['x'], 'a.png', { type: 'image/png' })
    const b = new File(['x'], 'b.mp4', { type: 'video/mp4' })
    const c = new File(['x'], 'c.pdf', { type: 'application/pdf' })
    const d = new File(['x'], 'd.jpg', { type: 'image/jpeg' })
    const list = { 0: a, 1: b, 2: c, 3: d, length: 4, item: (i: number) => [a, b, c, d][i] ?? null } as unknown as FileList
    // Array.from needs an iterable or array-like; the object above is array-like.
    expect(mediaFiles(list)).toEqual([a, b, d])
    expect(mediaFiles(null)).toEqual([])
  })
})

describe('isQuickTime', () => {
  test('by type or extension', () => {
    expect(isQuickTime(f('a.mov', ''))).toBe(true)
    expect(isQuickTime(f('a', 'video/quicktime'))).toBe(true)
    expect(isQuickTime(f('a.mp4', 'video/mp4'))).toBe(false)
  })
})

import { isPlayableVideo } from './media-files'
describe('isPlayableVideo', () => {
  test('refuses video types the player does not know', () => {
    expect(isPlayableVideo({ name: 'a.mp4', type: 'video/mp4' })).toBe(true)
    expect(isPlayableVideo({ name: 'a.mov', type: 'video/quicktime' })).toBe(true)
    expect(isPlayableVideo({ name: 'a.mkv', type: 'video/x-matroska' })).toBe(false)
    expect(isPlayableVideo({ name: 'a.avi', type: 'video/x-msvideo' })).toBe(false)
  })
})
