import { describe, it, expect } from '@/test/vitest'
import { normalizePath, isValidDestination } from '@/server/redirect-path'

describe('normalizePath', () => {
  it('forces a leading slash', () => {
    expect(normalizePath('old-post')).toBe('/old-post')
  })

  it('strips a trailing slash but keeps the root', () => {
    expect(normalizePath('/old-post/')).toBe('/old-post')
    expect(normalizePath('/')).toBe('/')
  })

  it('drops the query and hash', () => {
    expect(normalizePath('/p?a=1#frag')).toBe('/p')
  })

  it('collapses duplicate slashes', () => {
    expect(normalizePath('//a///b')).toBe('/a/b')
  })

  it('returns empty for blank input', () => {
    expect(normalizePath('   ')).toBe('')
    expect(normalizePath('')).toBe('')
  })
})

describe('isValidDestination', () => {
  it('accepts a rooted path', () => {
    expect(isValidDestination('/new')).toBe(true)
  })

  it('accepts an absolute http(s) URL', () => {
    expect(isValidDestination('https://example.com/x')).toBe(true)
    expect(isValidDestination('http://example.com')).toBe(true)
  })

  it('rejects the bare root as too-empty and non-url junk', () => {
    expect(isValidDestination('/')).toBe(true) // root is a valid target
    expect(isValidDestination('example.com')).toBe(false) // no scheme, not rooted
    expect(isValidDestination('javascript:alert(1)')).toBe(false)
    expect(isValidDestination('')).toBe(false)
  })
})
