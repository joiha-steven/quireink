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
    expect((await first.json() as { data: { status: string } }).data.status).toBe('sent')
    // The send runs after the answer: the stamp is lifted once the refused connection comes back.
    const sentAt = () => db().query<{ at: number | null }, []>(`select confirm_sent_at as at from subscribers where email = 'retry@example.com'`).get()?.at
    for (let i = 0; i < 100 && sentAt() != null; i++) await Bun.sleep(10)
    expect(sentAt()).toBeNull()
    const again = await post('/api/subscribe', { email: 'retry@example.com' }, '198.51.100.51')
    expect((await again.json() as { data: { status: string } }).data.status).toBe('sent')
    for (let i = 0; i < 100 && sentAt() != null; i++) await Bun.sleep(10)
    expect(sentAt()).toBeNull()
  })

  it('answers a new address without waiting on the relay, as fast as one already on the list', async () => {
    // An awaited send made a new address wait one SMTP round trip and a confirmed one none, so the
    // answer's timing said who was subscribed (1.1 ms against 0.1 ms with a relay on this machine).
    // A relay that holds its 250 makes that round trip as long as the mail timeout.
    const relay = await startRelay()
    relay.stallAt(1)
    await saveSmtpConfig({ host: '127.0.0.1', port: relay.port, from: 'blog@example.com' })
    try {
      const started = performance.now()
      const res = await Promise.race([
        post('/api/subscribe', { email: 'slow-relay@example.com' }, '198.51.100.52'),
        Bun.sleep(2_000).then(() => null),
      ])
      expect(res).not.toBeNull()
      expect(performance.now() - started).toBeLessThan(2_000)
      expect((await res!.json() as { data: { status: string } }).data.status).toBe('sent')
      await relay.received(1) // and the letter still went out
      expect(relay.rcpt).toEqual(['slow-relay@example.com'])
    } finally {
      relay.close()
      await saveSmtpConfig({ host: '127.0.0.1', port: 9, from: 'blog@example.com' })
    }
  })

  it('cools down per address: the second sign-up inside the hour sends no second email', async () => {
    // A relay that takes the first letter: the hour follows a letter that LEFT (the case above).
    const relay = await startRelay()
    await saveSmtpConfig({ host: '127.0.0.1', port: relay.port, from: 'blog@example.com' })
    try {
      await post('/api/subscribe', { email: 'eager@example.com' }, '198.51.100.33')
      await relay.received(1)
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
