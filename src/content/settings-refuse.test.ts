// The three free-text settings a save refuses rather than rewrites (`settings-refuse.ts`).
import { describe, expect, it } from 'bun:test'
import type { SiteSettings } from '@/types'
import { refusedSetting } from './settings-refuse'

const ask = (input: Record<string, unknown>) => refusedSetting(input as Partial<SiteSettings>)

describe('the site address', () => {
  it('refuses a string that is not a web address', () => {
    for (const v of ['not a url', 'example.com', 'ftp://example.com', 'javascript:alert(1)', 5, null]) {
      expect(ask({ siteUrl: v })).toEqual({ k: 'siteUrl', why: 'url' })
    }
  })

  it('lets an empty answer through, because "no address" is a real one', () => {
    expect(ask({ siteUrl: '' })).toBeNull()
    expect(ask({ siteUrl: '   ' })).toBeNull()
  })

  it('lets an http(s) address through, path and all (the save keeps its origin)', () => {
    expect(ask({ siteUrl: 'https://example.com' })).toBeNull()
    expect(ask({ siteUrl: 'http://localhost:3000/blog/' })).toBeNull()
  })

  it('says nothing when the save does not mention it', () => {
    expect(ask({ title: 'Anything' })).toBeNull()
  })
})

describe('the author link', () => {
  it('refuses one that is not a web address, and allows one that is, or none', () => {
    expect(ask({ author: { url: 'my site' } })).toEqual({ k: 'author.url', why: 'url' })
    expect(ask({ author: { url: 'https://example.com/about' } })).toBeNull()
    expect(ask({ author: { url: '' } })).toBeNull()
    expect(ask({ author: { name: 'Only a name' } })).toBeNull()
  })
})

describe('the source repository', () => {
  it('refuses a name GitHub would not have, and allows a real one, a pasted address, or none', () => {
    expect(ask({ sourceRepo: 'just-a-name' })).toEqual({ k: 'sourceRepo', why: 'invalid' })
    expect(ask({ sourceRepo: 'https://gitlab.com/jane/blog' })).toEqual({ k: 'sourceRepo', why: 'invalid' })
    expect(ask({ sourceRepo: 'jane/blog' })).toBeNull()
    expect(ask({ sourceRepo: 'https://github.com/jane/blog.git' })).toBeNull()
    expect(ask({ sourceRepo: '' })).toBeNull()
  })
})
