// The admin shell's reading font when the owner has uploaded one. Kept out of admin.test.ts,
// which sits at the file-size ceiling.
import { describe, it, expect, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { getFontPreset } from '@/content/fonts'
import { saveSettings } from '@/content/settings'

const DIR = './.tmp/test-admin-custom-font'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

describe('the admin shell with an uploaded reading font', () => {
  it('ends the uploaded font chain in the selected preset stack, not in an undefined variable', async () => {
    const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
    const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
    await saveSettings({ fontPreset: 'inter', customFont: { family: 'My Face', faces: [{ weight: 400, url: '/uploads/my-face.woff2' }] } })
    const html = await (await app.request('/admin', { headers: { cookie } })).text()
    expect(html).toContain(`--font-reading:'My Face', ${getFontPreset('inter').stack}}`)
    expect(html).not.toContain('--font-inter')
  })
})
