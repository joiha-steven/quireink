// The byte-sniffer behind the upload gate. Families only — validity is sharp's job later.
import { describe, it, expect } from 'bun:test'
import { sniffImage } from './sniff'

const buf = (...bytes: (number | string)[]): ArrayBuffer => {
  const out: number[] = []
  for (const b of bytes) {
    if (typeof b === 'number') out.push(b)
    else for (const ch of b) out.push(ch.charCodeAt(0))
  }
  return new Uint8Array(out).buffer
}

describe('sniffImage', () => {
  it('recognises each accepted family by its magic bytes', () => {
    expect(sniffImage(buf(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImage(buf(0x89, 'PNG\r\n\x1a\n'))).toBe('image/png')
    expect(sniffImage(buf('GIF89a'))).toBe('image/gif')
    expect(sniffImage(buf('GIF87a'))).toBe('image/gif')
    expect(sniffImage(buf('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp')
    expect(sniffImage(buf(0, 0, 0, 0x1c, 'ftypavif'))).toBe('image/avif')
    expect(sniffImage(buf(0, 0, 0, 0x1c, 'ftypavis'))).toBe('image/avif')
  })

  it('recognises SVG through its real-world prologues', () => {
    expect(sniffImage(buf('<svg xmlns="x"></svg>'))).toBe('image/svg+xml')
    // A real export: UTF-8 BOM, XML prolog, a comment and a doctype before the root.
    const exported = new TextEncoder().encode('﻿  <?xml version="1.0"?>\n<!-- exported -->\n<!DOCTYPE svg>\n<svg/>')
    expect(sniffImage(exported.buffer as ArrayBuffer)).toBe('image/svg+xml')
  })

  it('answers null for what it does not know — the caller refuses, never guesses', () => {
    expect(sniffImage(buf('MZ'))).toBe(null) // an executable
    expect(sniffImage(buf('<html><script>1</script></html>'))).toBe(null)
    expect(sniffImage(buf('id,name\n1,a'))).toBe(null)
    expect(sniffImage(new ArrayBuffer(0))).toBe(null)
    // RIFF that is not WEBP (a .wav) stays out of the image families.
    expect(sniffImage(buf('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe(null)
  })
})
