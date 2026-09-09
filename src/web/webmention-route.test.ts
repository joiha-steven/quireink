// The receiving endpoint (ADR 0046): what it answers, and that it never waits on anybody.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { resetLimits } from '@/server/rate-limit'
import { listMentions } from '@/server/webmention'

const DIR = './.tmp/test-webmention-route'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
beforeEach(() => { db().run(`delete from webmentions`); resetLimits() })

const send = (fields: Record<string, string>) =>
  app.request('/webmention', { method: 'POST', body: new URLSearchParams(fields) })

describe('POST /webmention', () => {
  it('accepts a mention of a page on this site and keeps it pending', async () => {
    const res = await send({ source: 'https://reader.example/notes/kept', target: 'http://localhost:3000/the-reed-pen' })
    expect(res.status).toBe(202)
    expect(listMentions()[0]).toMatchObject({ source: 'https://reader.example/notes/kept', target: 'http://localhost:3000/the-reed-pen', status: 'pending' })
  })

  it('refuses a target elsewhere, a missing field, and a body that is not a form', async () => {
    expect((await send({ source: 'https://reader.example/a', target: 'https://other.example/p' })).status).toBe(400)
    expect((await send({ source: 'https://reader.example/a' })).status).toBe(400)
    const raw = await app.request('/webmention', { method: 'POST', body: 'source=x', headers: { 'content-type': 'text/plain' } })
    expect(raw.status).toBe(400)
    expect(listMentions()).toEqual([])
  })

  it('is public, and rate-limited by address', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9' }
    let last = 0
    for (let i = 0; i < 25; i++) {
      const res = await app.request('/webmention', {
        method: 'POST', headers, body: new URLSearchParams({ source: `https://reader.example/${i}`, target: 'http://localhost:3000/p' }),
      })
      last = res.status
    }
    expect(last).toBe(429)
  })
})
