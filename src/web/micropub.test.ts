// Micropub into the notebook (ADR 0046): a bearer, an h-entry, a note.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { createToken } from '@/mcp/tokens'
import { getNote, getNoteIndex } from '@/content/notes'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-micropub'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let full = ''
let read = ''

beforeEach(async () => {
  clearCache()
  for (const t of ['notes', 'mcp_tokens', 'settings', 'server_secrets', 'activity_log']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  await saveSettings({ mcp: { enabled: true } })
  full = (await createToken('writer', 'full')).token
  read = (await createToken('reader', 'read')).token
})

const post = (token: string, body: URLSearchParams | string, contentType: string) =>
  app.request('/micropub', { method: 'POST', body, headers: { authorization: `Bearer ${token}`, 'content-type': contentType } })

describe('/micropub', () => {
  it('needs a bearer token, and a token that may write', async () => {
    expect((await app.request('/micropub?q=config')).status).toBe(401)
    const res = await post(read, new URLSearchParams({ h: 'entry', content: 'x' }), 'application/x-www-form-urlencoded')
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('insufficient_scope')
  })

  it('answers q=config', async () => {
    const res = await app.request('/micropub?q=config', { headers: { authorization: `Bearer ${read}` } })
    expect(res.status).toBe(200)
    expect((await res.json()) as object).toMatchObject({ 'syndicate-to': [] })
  })

  it('creates a note from a form-encoded h-entry and points at it', async () => {
    const res = await post(full, new URLSearchParams({ h: 'entry', name: 'From a client', content: 'Posted by Micropub.' }),
      'application/x-www-form-urlencoded')
    expect(res.status).toBe(201)
    expect(res.headers.get('location')).toBe('http://localhost:3000/notes/from-a-client')
    expect(await getNote('from-a-client')).toMatchObject({ title: 'From a client', content: 'Posted by Micropub.', status: 'published' })
  })

  it('creates a clip from JSON with quotation-of, as a draft when asked', async () => {
    const res = await post(full, JSON.stringify({ type: ['h-entry'], properties: {
      content: ['worth keeping'], 'quotation-of': ['https://a.example/reed'], quote: ['every stroke starts wet'],
      'post-status': ['draft'], 'mp-slug': ['reed'],
    } }), 'application/json')
    expect(res.status).toBe(201)
    expect(await getNote('reed')).toMatchObject({
      status: 'draft', sourceUrl: 'https://a.example/reed', quote: 'every stroke starts wet', content: 'worth keeping',
    })
  })

  it('gives a note back as source, and moves it to the Trash on delete', async () => {
    await post(full, new URLSearchParams({ h: 'entry', name: 'Gone soon', content: 'x' }), 'application/x-www-form-urlencoded')
    const src = await app.request('/micropub?q=source&url=http%3A%2F%2Flocalhost%3A3000%2Fnotes%2Fgone-soon',
      { headers: { authorization: `Bearer ${full}` } })
    expect((await src.json()) as object).toMatchObject({ type: ['h-entry'], properties: { name: ['Gone soon'] } })
    const del = await post(full, JSON.stringify({ action: 'delete', url: 'http://localhost:3000/notes/gone-soon' }), 'application/json')
    expect(del.status).toBe(204)
    expect(await getNote('gone-soon')).toBeNull()
  })

  it('refuses anything that is not an h-entry, and an entry with nothing in it', async () => {
    const other = await post(full, new URLSearchParams({ h: 'event', name: 'x' }), 'application/x-www-form-urlencoded')
    expect(other.status).toBe(400)
    const empty = await post(full, new URLSearchParams({ h: 'entry' }), 'application/x-www-form-urlencoded')
    expect(empty.status).toBe(400)
    expect(await getNoteIndex()).toEqual([])
  })
})
