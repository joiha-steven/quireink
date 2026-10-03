// The newsletter's outbox inside a Durable Object (`news/outbox.ts`), for `bun run test:cf`.
//
// What a restart leaves behind is written into the object's own SQLite exactly as a runner dies
// with it: one address recorded, one delivered and not yet recorded, one with the relay and no
// answer, two still owed, and a lease nobody renews. A fresh runner — this module's memory
// forgotten, as an evicted or redeployed object forgets it — has to settle the first three from
// the send log and mail only the last two, through `cloudflare:sockets` to the relay
// `scripts/test-cf.ts` runs. `bun test` holds the same story on Bun, including a process killed
// with SIGKILL mid-message (`src/news/broadcast-resume.test.ts`).
import { openDatabases } from '@/store/db'
import { all, run } from '@/store/query'
import { getSettings } from '@/content/settings'
import { saveSmtpConfig } from '@/news/mail'
import { emailBrand } from '@/news/email-brand'
import { broadcastRun, resetBroadcastRun, resumeBroadcast } from '@/news/broadcast'
import { INTERRUPTED, openRun } from '@/news/outbox'

export async function outboxResumes(smtpPort: number): Promise<void> {
  if (!smtpPort) throw new Error('no fake relay port (CF_TEST_SMTP_PORT)')
  openDatabases('./data')
  await saveSmtpConfig({ host: '127.0.0.1', port: smtpPort, secure: false, from: 'blog@blog.test', user: 'u', pass: 'p' })
  const subs = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ email: `${x}@reader.test`, token: `t-${x}` }))
  const letter = JSON.stringify({ posts: [{ slug: 'a-letter', title: 'A letter' }], brand: emailBrand(await getSettings()), lang: 'en' })
  if (!openRun({ slugs: ['a-letter'], letter, subs, now: Date.now() })) throw new Error('a run was already open in a new object')

  const at = Date.now() - 5_000
  run(`update broadcast_outbox set state = 'sent' where email = 'a@reader.test'`)
  run(`update broadcast_outbox set state = 'sending', open_token = 'tok-b', claimed_at = ? where email = 'b@reader.test'`, at)
  run(`update broadcast_outbox set state = 'sending', open_token = 'tok-c', claimed_at = ? where email = 'c@reader.test'`, at)
  run(`update broadcast_runs set sent = 1, lease_owner = 'gone', lease_until = ?`, Date.now() - 1)
  run(`insert into newsletter_sends (email, kind, post_slug, sent_at, ok, open_token) values ('b@reader.test', 'broadcast', 'a-letter', ?, 1, 'tok-b')`, at)

  resetBroadcastRun()
  await resumeBroadcast()

  const log = all<{ email: string; ok: number; error: string | null }>(`select email, ok, error from newsletter_sends order by id`)
  const said = JSON.stringify(log)
  const delivered = (email: string) => log.filter((r) => r.email === email && r.ok === 1).length
  if (delivered('a@reader.test') !== 0 || delivered('b@reader.test') !== 1) throw new Error(`a or b was mailed again: ${said}`)
  if (delivered('d@reader.test') !== 1 || delivered('e@reader.test') !== 1) throw new Error(`d and e were not each mailed once: ${said}`)
  const c = log.filter((r) => r.email === 'c@reader.test')
  if (c.length !== 1 || c[0]!.ok !== 0 || c[0]!.error !== INTERRUPTED) throw new Error(`the message in doubt was not settled as interrupted: ${said}`)
  const r = broadcastRun()
  if (!r || !r.done || r.sent !== 4 || r.failed !== 1) throw new Error(`the run ended as ${JSON.stringify(r)}`)
  if (all(`select id from broadcast_outbox`).length !== 0) throw new Error('the finished run left its outbox behind')
}
