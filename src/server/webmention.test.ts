// Webmention, both ways (ADR 0046), with the network stood in for.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import {
  discoverEndpoint, keptPassage, listMentions, mostKept, receiveWebmention, sendWebmention, verifyMention,
} from '@/server/webmention'

const DIR = './.tmp/test-webmention'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => db().run(`delete from webmentions`))

const SITE = 'https://blog.example'
const page = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html', ...headers } })

describe('discovering the endpoint', () => {
  it('reads a Link header first, then a link tag, then an anchor, resolving relative paths', () => {
    expect(discoverEndpoint('', '<https://a.example/wm>; rel="webmention"', 'https://a.example/p')).toBe('https://a.example/wm')
    expect(discoverEndpoint('<html><head><link rel="webmention" href="/wm"></head></html>', null, 'https://a.example/p/q'))
      .toBe('https://a.example/wm')
    expect(discoverEndpoint('<a href="hooks/wm" rel="webmention stylesheet">x</a>', null, 'https://a.example/p/q'))
      .toBe('https://a.example/p/hooks/wm')
    expect(discoverEndpoint('<link rel="stylesheet" href="/s.css">', null, 'https://a.example/')).toBeNull()
  })
})

describe('sending', () => {
  it('posts source and target to the endpoint the target advertises', async () => {
    const calls: { url: string; body?: string }[] = []
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url === 'https://a.example/post') return page('<link rel="webmention" href="/wm">')
      return new Response('', { status: 202 })
    }
    expect(await sendWebmention(`${SITE}/notes/kept`, 'https://a.example/post', fetcher)).toBe('sent')
    expect(calls[1]).toEqual({ url: 'https://a.example/wm', body: `source=${encodeURIComponent(`${SITE}/notes/kept`)}&target=${encodeURIComponent('https://a.example/post')}` })
  })

  it('says so when the target has no endpoint, and never throws on a network failure', async () => {
    expect(await sendWebmention(`${SITE}/notes/x`, 'https://a.example/plain', async () => page('<p>hi</p>'))).toBe('no-endpoint')
    expect(await sendWebmention(`${SITE}/notes/x`, 'https://a.example/down', async () => { throw new Error('refused') })).toBe('failed')
  })
})

describe('receiving', () => {
  it('refuses a target off this site, a non-http source, and a source that is the target', () => {
    expect(receiveWebmention('https://b.example/a', 'https://other.example/p', SITE)).toBe('invalid')
    expect(receiveWebmention('ftp://b.example/a', `${SITE}/p`, SITE)).toBe('invalid')
    expect(receiveWebmention(`${SITE}/p`, `${SITE}/p`, SITE)).toBe('invalid')
  })

  it('keeps a pending row, verifies that the source links here, and reads the kept passage off a clip', async () => {
    const id = receiveWebmention('https://b.example/notes/kept', `${SITE}/the-reed-pen`, SITE)
    expect(typeof id).toBe('number')
    expect(listMentions()[0]).toMatchObject({ source: 'https://b.example/notes/kept', status: 'pending' })
    const html = `<article class="h-entry"><a class="u-quotation-of" href="${SITE}/the-reed-pen">x</a>`
      + `<blockquote class="note-quote"><p>every stroke starts wet &amp; ends dry</p></blockquote></article>`
    const m = await verifyMention(id as number, async () => page(html))
    expect(m).toMatchObject({ status: 'verified', quote: 'every stroke starts wet & ends dry' })
  })

  it('marks a source that does not link here as failed, and a second receipt re-verifies', async () => {
    const id = receiveWebmention('https://b.example/nope', `${SITE}/p`, SITE) as number
    expect((await verifyMention(id, async () => page('<p>nothing about you</p>')))?.status).toBe('failed')
    const again = receiveWebmention('https://b.example/nope', `${SITE}/p`, SITE)
    expect(again).toBe(id)
    expect(listMentions()[0]?.status).toBe('pending')
  })

  it('counts which passage readers keep most, from verified clips only', async () => {
    const keep = async (source: string, quote: string) => {
      const id = receiveWebmention(source, `${SITE}/p`, SITE) as number
      await verifyMention(id, async () => page(`<a href="${SITE}/p">x</a><blockquote class="note-quote"><p>${quote}</p></blockquote>`))
    }
    await keep('https://b.example/1', 'one sentence')
    await keep('https://c.example/1', 'one sentence')
    await keep('https://d.example/1', 'another')
    receiveWebmention('https://e.example/1', `${SITE}/p`, SITE) // pending, not counted
    expect(mostKept()).toEqual([
      { target: `${SITE}/p`, quote: 'one sentence', count: 2 },
      { target: `${SITE}/p`, quote: 'another', count: 1 },
    ])
  })

  it('reads only a clip passage, and never markup', () => {
    expect(keptPassage('<blockquote class="note-quote"><p>a <b>bold</b> line</p></blockquote>')).toBe('a bold line')
    expect(keptPassage('<blockquote><p>plain</p></blockquote>')).toBe('')
  })
})
