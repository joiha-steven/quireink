// The per-address confirm cooldown follows a letter that LEFT. It was stamped before the send and
// kept when the send failed, so the reader's next try within the hour sent nothing and was told the
// link was on its way (2026-11-03).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { saveSmtpConfig } from '@/news/mail'
import { startRelay } from '@/test/relay'

const DIR = './.tmp/test-subscribe-cooldown'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const post = (path: string, body: unknown, ip: string): Promise<Response> =>
  Promise.resolve(app.request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }))

describe('the confirm cooldown', () => {
  // A mail server that is configured and answers nobody: a closed port, so a send fails at once.
  beforeAll(() => saveSmtpConfig({ host: '127.0.0.1', port: 9, from: 'blog@example.com' }))

  it('starts no cooldown when the confirm email could not be sent', async () => {
    const first = await post('/api/subscribe', { email: 'retry@example.com' }, '198.51.100.50')
    expect((await first.json() as { data: { status: string } }).data.status).toBe('pending_no_mail')
    const row = db().query<{ at: number | null }, []>(`select confirm_sent_at as at from subscribers where email = 'retry@example.com'`).get()
    expect(row?.at).toBeNull()
    const again = await post('/api/subscribe', { email: 'retry@example.com' }, '198.51.100.51')
    expect((await again.json() as { data: { status: string } }).data.status).toBe('pending_no_mail')
  })

  it('cools down per address: the second sign-up inside the hour sends no second email', async () => {
    // A relay that takes the first letter: the hour follows a letter that LEFT (the case above).
    const relay = await startRelay()
    await saveSmtpConfig({ host: '127.0.0.1', port: relay.port, from: 'blog@example.com' })
    try {
      await post('/api/subscribe', { email: 'eager@example.com' }, '198.51.100.33')
      const res = await post('/api/subscribe', { email: 'eager@example.com' }, '198.51.100.34')
      // Same cheerful answer, 'sent': the first link is in the inbox and nothing new was tried.
      expect(res.status).toBe(200)
      const body = (await res.json()) as { data?: { status?: string }; status?: string }
      expect(body.data?.status ?? body.status).toBe('sent')
      expect(relay.rcpt).toEqual(['eager@example.com'])
    } finally {
      relay.close()
      await saveSmtpConfig({ host: '127.0.0.1', port: 9, from: 'blog@example.com' })
    }
  })

})
