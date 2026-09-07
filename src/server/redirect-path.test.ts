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

// A WordPress export gives permalinks as `<link>` URLs, and `URL.pathname` is always
// percent-encoded. The router hands over a decoded path, so a redirect stored encoded was
// a row that could never match: every inbound link to a non-ASCII permalink answered 404
// while the import report counted the redirect as saved.
describe('one spelling of a path, encoded or not', () => {
  it('stores and looks up the decoded form', () => {
    expect(normalizePath('/2020/05/b%C3%A0i-vi%E1%BA%BFt')).toBe('/2020/05/bài-viết')
    expect(normalizePath('/2020/05/bài-viết')).toBe('/2020/05/bài-viết')
    expect(normalizePath('/caf%C3%A9/')).toBe('/café')
  })

  it('leaves a malformed escape exactly as it was written', () => {
    expect(normalizePath('/100%-real')).toBe('/100%-real')
  })
})
