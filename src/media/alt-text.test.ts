// The describer's two pure halves are pinned per provider, and the background entry is
// exercised against the real store with a fetch that never leaves the process.

import { describe, it, expect, beforeEach, afterAll, afterEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { buildRequest, parseAlt, describeUpload, DEFAULT_MODELS } from './alt-text'

const DIR = './.tmp/test-alt-text'
freshDatabase(DIR)

const realFetch = globalThis.fetch

beforeEach(() => {
  for (const t of ['media', 'integration_keys', 'settings']) db().run(`delete from ${t}`)
})
afterEach(() => { globalThis.fetch = realFetch })
afterAll(() => dropDatabase(DIR))

const B64 = Buffer.from('fake image bytes').toString('base64')

describe('buildRequest', () => {
  it('shapes each provider the way its API documents, key in a header, never the URL', () => {
    const a = buildRequest('anthropic', 'claude-haiku-4-5', 'sk-ant-x', 'image/webp', B64, 'vi')!
    expect(a.url).toBe('https://api.anthropic.com/v1/messages')
    expect(a.headers['x-api-key']).toBe('sk-ant-x')
    expect(a.body).toContain('"media_type":"image/webp"')
    expect(a.body).toContain('Vietnamese')

    const o = buildRequest('openai', 'gpt-4o-mini', 'sk-x', 'image/png', B64, 'en')!
    expect(o.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(o.headers.authorization).toBe('Bearer sk-x')
    expect(o.body).toContain(`data:image/png;base64,${B64.slice(0, 12)}`)

    const g = buildRequest('gemini', 'gemini-2.0-flash', 'AIza-x', 'image/jpeg', B64, 'ja')!
    expect(g.url).toContain('generativelanguage.googleapis.com')
    expect(g.url).not.toContain('AIza-x') // the key rides in a header, not the query string
    expect(g.headers['x-goog-api-key']).toBe('AIza-x')
    expect(g.body).toContain('"mime_type":"image/jpeg"')

    expect(buildRequest('mystery', 'm', 'k', 'image/png', B64, 'en')).toBeNull()
  })
})

describe('parseAlt', () => {
  it('reads each provider answer shape and cleans what writers wrap in quotes', () => {
    expect(parseAlt('anthropic', { content: [{ type: 'text', text: '"A red bicycle against a wall."' }] }))
      .toBe('A red bicycle against a wall.')
    expect(parseAlt('openai', { choices: [{ message: { content: '  Two cups\nof coffee ' } }] }))
      .toBe('Two cups of coffee')
    expect(parseAlt('gemini', { candidates: [{ content: { parts: [{ text: 'A field at dusk' }] } }] }))
      .toBe('A field at dusk')
    expect(parseAlt('anthropic', { content: [] })).toBeNull()
    expect(parseAlt('openai', {})).toBeNull()
  })
  it('caps a rambling answer at 300 characters', () => {
    expect(parseAlt('gemini', { candidates: [{ content: { parts: [{ text: 'x'.repeat(900) }] } }] })!.length).toBe(300)
  })
})

const plantMedia = (path: string, alt: string | null = null) =>
  db().run(
    `insert into media (path, filename, size, uploaded_at, alt) values (?, ?, 10, 1, ${alt === null ? 'null' : `'${alt}'`})`,
    [path, path],
  )

const altOf = (path: string) => one<{ alt: string | null }>(`select alt from media where path = ?`, path)?.alt ?? null

describe('describeUpload', () => {
  it('makes NO request when no key is stored — pasting the key IS the opt-in', async () => {
    let called = 0
    globalThis.fetch = (async () => { called++; return new Response('{}') }) as unknown as typeof fetch
    plantMedia('media/quiet.webp')
    await describeUpload('media/quiet.webp', new ArrayBuffer(10), 'image/webp')
    expect(called).toBe(0)
    expect(altOf('media/quiet.webp')).toBeNull()
  })

  it('writes the answer onto the row, once configured', async () => {
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'sk-test' })
    let url = ''
    globalThis.fetch = (async (u: string | URL | Request) => {
      url = String(u)
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'A lighthouse at noon' }] }))
    }) as unknown as typeof fetch
    plantMedia('media/light.webp')
    await describeUpload('media/light.webp', new ArrayBuffer(10), 'image/webp')
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(altOf('media/light.webp')).toBe('A lighthouse at noon')
  })

  it("never refills a field the owner cleared: '' is a decision, NULL is an absence", async () => {
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'sk-test' })
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'Overruled' }] }))) as unknown as typeof fetch
    plantMedia('media/cleared.webp', '')
    await describeUpload('media/cleared.webp', new ArrayBuffer(10), 'image/webp')
    expect(altOf('media/cleared.webp')).toBe('')
  })

  it('declines a video, an svg, and an oversized file before any network', async () => {
    await saveIntegrationKeys({ aiProvider: 'openai', aiApiKey: 'sk-test' })
    let called = 0
    globalThis.fetch = (async () => { called++; return new Response('{}') }) as unknown as typeof fetch
    await describeUpload('media/a.mp4', new ArrayBuffer(10), 'video/mp4')
    await describeUpload('media/b.svg', new ArrayBuffer(10), 'image/svg+xml')
    await describeUpload('media/c.png', new ArrayBuffer(9 * 1024 * 1024), 'image/png')
    expect(called).toBe(0)
  })

  it('a failing provider changes nothing and does not throw', async () => {
    await saveIntegrationKeys({ aiProvider: 'gemini', aiApiKey: 'k' })
    globalThis.fetch = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch
    plantMedia('media/denied.webp')
    await describeUpload('media/denied.webp', new ArrayBuffer(10), 'image/webp')
    expect(altOf('media/denied.webp')).toBeNull()
  })

  it('every provider named in DEFAULT_MODELS builds a request', () => {
    for (const [provider, model] of Object.entries(DEFAULT_MODELS)) {
      expect(buildRequest(provider, model, 'k', 'image/png', B64, 'en')).not.toBeNull()
    }
  })
})
