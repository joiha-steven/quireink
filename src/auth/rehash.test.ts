// ADR 0069: the proved password moves an old hash to today's parameters; a wrong one moves nothing.
import { it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { one, run } from '@/store/query'
import { createUser, setTotpSecret } from './users'
import { generateSecret } from './totp'
import { resetPending, submitPassword } from './login'
import { resetSecretCache } from './secret'
import { resetLimits } from '@/server/rate-limit'

const DIR = './.tmp/test-rehash'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'a long enough passphrase'
const stored = () => one<{ h: string }>(`select password_hash as h from users where username = 'owner'`)!.h

beforeEach(async () => {
  for (const table of ['sessions', 'users', 'activity_log', 'server_secrets']) db().run(`delete from ${table}`)
  resetPending()
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: PASSWORD })
  setTotpSecret(user.id, generateSecret())
})

it('stores an old 64 MiB hash again at 19 MiB once the password is proved', async () => {
  const old = await Bun.password.hash(PASSWORD, { algorithm: 'argon2id', memoryCost: 65536, timeCost: 2 })
  run(`update users set password_hash = ? where username = 'owner'`, old)
  await submitPassword({ username: 'owner', password: 'not the password at all', ip: '198.51.100.7' })
  expect(stored()).toBe(old)
  const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: '198.51.100.8' })
  expect(result.status).toBe('need-2fa')
  expect(stored()).toMatch(/\$m=19456,t=2,p=1\$/)
  expect(await Bun.password.verify(PASSWORD, stored())).toBe(true)
})

it('leaves a hash already at today\'s parameters exactly as it was', async () => {
  const before = stored()
  await submitPassword({ username: 'owner', password: PASSWORD, ip: '198.51.100.9' })
  expect(stored()).toBe(before)
})
